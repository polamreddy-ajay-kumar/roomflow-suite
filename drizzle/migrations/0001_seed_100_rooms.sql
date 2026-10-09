-- Remove old seed rooms that have no bookings, then seed 100 rooms across 12 types.
delete from public.rooms r where not exists (select 1 from public.bookings b where b.room_id = r.id);

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Studio ' || n, 'Studio',
  'Smart, space-savvy studio with a comfy bed, kitchenette and everything a solo traveller or couple needs.',
  2800, 2, 'studio', 'available'
from generate_series(101, 112) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Standard ' || n, 'Standard',
  'A calm, well-appointed room with a queen bed, warm lighting and a work nook — our most popular stay.',
  3500, 2, 'standard', 'available'
from generate_series(201, 214) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Twin ' || n, 'Twin',
  'Two plush single beds in a bright, minimalist room — perfect for friends or colleagues travelling together.',
  3800, 2, 'twin', 'available'
from generate_series(301, 310) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Business ' || n, 'Business',
  'A sleek room with a proper work desk, ergonomic chair and skyline views — built for productive trips.',
  4500, 2, 'business', 'available'
from generate_series(401, 412) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Deluxe ' || n, 'Deluxe',
  'A spacious king room with velvet accents, a reading armchair and sweeping evening city views.',
  6000, 3, 'deluxe', 'available'
from generate_series(501, 514) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Family ' || n, 'Family',
  'A cheerful family room with a king bed plus bunk beds for the kids and space to spread out.',
  7500, 5, 'family', 'available'
from generate_series(601, 610) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Ocean View ' || n, 'Ocean View',
  'Wake up to the sea — a resort-style king room with a private balcony over the water.',
  9000, 3, 'ocean', 'available'
from generate_series(701, 710) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Junior Suite ' || n, 'Junior Suite',
  'A classic junior suite with a canopy queen bed and a cosy sitting nook for slow mornings.',
  11000, 3, 'junior', 'available'
from generate_series(801, 808) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Heritage ' || n, 'Heritage',
  'A royal heritage chamber with a carved four-poster bed, rich textiles and palace views.',
  14000, 3, 'heritage', 'available'
from generate_series(901, 906) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
select n::text, 'Executive Suite ' || n, 'Executive Suite',
  'A full suite with a separate living room, marble bathroom and floor-to-ceiling skyline views.',
  18000, 4, 'suite', 'available'
from generate_series(1101, 1103) as n
on conflict (number) do nothing;

insert into public.rooms (number, name, room_type, description, price_per_night, capacity, image_url, status)
values ('1201', 'Presidential Suite', 'Presidential',
  'Our finest address: a grand presidential suite with chandeliered living room, dining for eight and sunset ocean views.',
  45000, 6, 'presidential', 'available')
on conflict (number) do nothing;
