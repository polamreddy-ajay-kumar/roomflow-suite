CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Main',
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  is_veg boolean NOT NULL DEFAULT true,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views menu" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage menu" ON public.menu_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.bookings ADD COLUMN guest_names text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bookings ADD COLUMN contact_phone text;
ALTER TABLE public.bookings ADD COLUMN food_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN food_total numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN admin_seen boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.booking_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.rooms; f numeric := 0; items jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id = NEW.room_id;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_staff(auth.uid()) THEN
      IF NEW.check_in < current_date THEN RAISE EXCEPTION 'Check-in date cannot be in the past'; END IF;
      IF r.status <> 'available' THEN RAISE EXCEPTION 'Room is not available'; END IF;
      IF coalesce(trim(NEW.contact_phone),'') = '' THEN RAISE EXCEPTION 'Phone number is required'; END IF;
      NEW.status := 'pending';
      NEW.payment_status := 'unpaid';
      NEW.admin_seen := false;
    END IF;
    IF NEW.guests > r.capacity THEN RAISE EXCEPTION 'Too many guests for this room'; END IF;
    -- recompute food from trusted menu prices
    SELECT coalesce(sum(m.price * greatest(1, least(50, (e->>'qty')::int))),0),
           coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'qty', greatest(1, least(50, (e->>'qty')::int)))), '[]'::jsonb)
      INTO f, items
      FROM jsonb_array_elements(coalesce(NEW.food_items,'[]'::jsonb)) e
      JOIN public.menu_items m ON m.id = (e->>'id')::uuid AND m.available;
    NEW.food_items := items;
    NEW.food_total := f;
    NEW.total_price := r.price_per_night * (NEW.check_out - NEW.check_in) + f;
  ELSIF TG_OP = 'UPDATE' AND NOT public.is_staff(auth.uid()) THEN
    IF NEW.status <> 'cancelled' OR NEW.room_id <> OLD.room_id OR NEW.check_in <> OLD.check_in
       OR NEW.check_out <> OLD.check_out OR NEW.payment_status <> OLD.payment_status
       OR NEW.total_price <> OLD.total_price OR NEW.user_id <> OLD.user_id
       OR NEW.food_total <> OLD.food_total THEN
      RAISE EXCEPTION 'Guests can only cancel their bookings';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.room_id <> OLD.room_id OR NEW.check_in <> OLD.check_in OR NEW.check_out <> OLD.check_out THEN
      NEW.total_price := r.price_per_night * (NEW.check_out - NEW.check_in) + NEW.food_total;
    END IF;
  END IF;
  RETURN NEW;
END $function$;