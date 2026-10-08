import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatINR, nightsBetween, rangesOverlap, roomImage, toISODate } from "@/lib/hotel";
import { useBookedRanges, useLiveHotelUpdates, useRooms } from "@/lib/availability";

const searchSchema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  guests: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute("/rooms/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Rooms & Suites — The Verdant" },
      { name: "description", content: "Browse rooms and suites with live availability and nightly rates." },
      { property: "og:title", content: "Rooms & Suites — The Verdant" },
      { property: "og:description", content: "Browse rooms and suites with live availability and nightly rates." },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const today = toISODate(new Date());
  const search = Route.useSearch();
  const checkIn = search.checkIn ?? today;
  const checkOut = search.checkOut && search.checkOut > checkIn ? search.checkOut : addDays(checkIn, 1);
  const guests = search.guests ?? 1;
  const navigate = useNavigate({ from: "/rooms/" });
  useLiveHotelUpdates();

  const rooms = useRooms();
  const booked = useBookedRanges(checkIn, checkOut);
  const nights = nightsBetween(checkIn, checkOut);

  const set = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow">Stay with us</p>
      <h1 className="mt-2 text-5xl text-primary">Rooms & suites</h1>

      <div className="mt-8 grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ci">Check-in</Label>
          <Input id="ci" type="date" min={today} value={checkIn} onChange={(e) => set({ checkIn: e.target.value, checkOut: e.target.value >= checkOut ? addDays(e.target.value, 1) : checkOut })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="co">Check-out</Label>
          <Input id="co" type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => set({ checkOut: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="g">Guests</Label>
          <Input id="g" type="number" min={1} max={8} value={guests} onChange={(e) => set({ guests: Number(e.target.value) || 1 })} />
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {nights} night{nights === 1 ? "" : "s"} · availability updates live
      </p>

      {rooms.error && <p className="mt-8 text-destructive">Couldn't load rooms. Please refresh.</p>}

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rooms.isLoading &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
        {rooms.data?.map((room) => {
          const taken = booked.data?.some((b) => b.room_id === room.id && rangesOverlap(checkIn, checkOut, b.check_in, b.check_out));
          const tooSmall = room.capacity < guests;
          const unavailable = room.status !== "available" || taken;
          return (
            <article key={room.id} className="group overflow-hidden rounded-md border bg-card shadow-elegant">
              <div className="relative aspect-[3/2] overflow-hidden">
                <img src={roomImage(room)} alt={room.name} loading="lazy" width={1200} height={800} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <Badge className="absolute left-3 top-3" variant={unavailable ? "destructive" : "secondary"}>
                  {room.status === "maintenance" ? "Closed" : taken ? "Booked" : "Available"}
                </Badge>
              </div>
              <div className="p-5">
                <p className="eyebrow">{room.room_type} · Room {room.number}</p>
                <h2 className="mt-1 text-3xl">{room.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{room.description}</p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <span className="text-xl font-semibold">{formatINR(room.price_per_night)}</span>
                    <span className="text-sm text-muted-foreground"> / night · up to {room.capacity}</span>
                  </div>
                  <Button asChild size="sm" disabled={unavailable || tooSmall} variant={unavailable || tooSmall ? "outline" : "default"}>
                    <Link to="/rooms/$roomId" params={{ roomId: room.id }} search={{ checkIn, checkOut, guests }}>
                      {tooSmall ? "Too small" : unavailable ? "View" : "Book"}
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
