CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'guest');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'refunded');
CREATE TYPE public.room_status AS ENUM ('available', 'maintenance');

-- Profiles (customers)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'))
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- New user trigger: profile + role (first user = admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), NEW.email);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'guest');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rooms
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  name text NOT NULL,
  room_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  capacity int NOT NULL DEFAULT 2 CHECK (capacity > 0),
  price_per_night numeric(10,2) NOT NULL CHECK (price_per_night >= 0),
  floor int NOT NULL DEFAULT 1,
  amenities text[] NOT NULL DEFAULT '{}',
  image_url text,
  status public.room_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views rooms" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage rooms" ON public.rooms FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Bookings
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests int NOT NULL DEFAULT 1 CHECK (guests > 0),
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  special_requests text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in),
  CONSTRAINT no_double_booking EXCLUDE USING gist (
    room_id WITH =, daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status <> 'cancelled')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or staff read bookings" ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Guests create own bookings" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Own or staff update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Staff delete bookings" ON public.bookings FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Server-side price + guest-safe updates
CREATE OR REPLACE FUNCTION public.booking_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rooms;
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id = NEW.room_id;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_staff(auth.uid()) THEN
      IF NEW.check_in < current_date THEN RAISE EXCEPTION 'Check-in date cannot be in the past'; END IF;
      IF r.status <> 'available' THEN RAISE EXCEPTION 'Room is not available'; END IF;
      NEW.status := 'confirmed';
      NEW.payment_status := 'unpaid';
    END IF;
    IF NEW.guests > r.capacity THEN RAISE EXCEPTION 'Too many guests for this room'; END IF;
    NEW.total_price := r.price_per_night * (NEW.check_out - NEW.check_in);
  ELSIF TG_OP = 'UPDATE' AND NOT public.is_staff(auth.uid()) THEN
    -- guests may only cancel
    IF NEW.status <> 'cancelled' OR NEW.room_id <> OLD.room_id OR NEW.check_in <> OLD.check_in
       OR NEW.check_out <> OLD.check_out OR NEW.payment_status <> OLD.payment_status
       OR NEW.total_price <> OLD.total_price OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Guests can only cancel their bookings';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.room_id <> OLD.room_id OR NEW.check_in <> OLD.check_in OR NEW.check_out <> OLD.check_out THEN
      NEW.total_price := r.price_per_night * (NEW.check_out - NEW.check_in);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_guard BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_guard();

-- Public availability (no personal data)
CREATE OR REPLACE FUNCTION public.booked_ranges(_from date, _to date)
RETURNS TABLE (room_id uuid, check_in date, check_out date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT room_id, check_in, check_out FROM public.bookings
  WHERE status <> 'cancelled' AND check_in < _to AND check_out > _from
$$;
GRANT EXECUTE ON FUNCTION public.booked_ranges(date, date) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

INSERT INTO public.rooms (number, name, room_type, description, capacity, price_per_night, floor, amenities) VALUES
('101','Garden Classic','Standard','A calm room overlooking the courtyard garden.',2,3500,1,ARRAY['Wi-Fi','AC','TV']),
('102','Garden Twin','Standard','Two single beds, ideal for friends or colleagues.',2,3500,1,ARRAY['Wi-Fi','AC','TV']),
('201','Deluxe King','Deluxe','Spacious king room with a work desk and city views.',2,5500,2,ARRAY['Wi-Fi','AC','TV','Minibar']),
('202','Deluxe Family','Deluxe','King bed plus sofa bed for small families.',4,6800,2,ARRAY['Wi-Fi','AC','TV','Minibar']),
('301','Executive Suite','Suite','Separate living area, bathtub and lounge access.',3,9500,3,ARRAY['Wi-Fi','AC','TV','Minibar','Bathtub','Lounge']),
('401','Penthouse Suite','Suite','Top-floor suite with a private terrace.',4,15000,4,ARRAY['Wi-Fi','AC','TV','Minibar','Bathtub','Terrace']);