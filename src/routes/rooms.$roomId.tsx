import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBookedRanges, useLiveHotelUpdates, useRooms } from "@/lib/availability";
import { addDays, formatINR, friendlyDbError, nightsBetween, rangesOverlap, roomImage, toISODate } from "@/lib/hotel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/rooms/$roomId")({
  validateSearch: z.object({
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    guests: z.coerce.number().int().min(1).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Book your room — A4MP ROOMS" },
      { name: "description", content: "Choose your dates and reserve this room instantly." },
      { property: "og:title", content: "Book your room — A4MP ROOMS" },
      { property: "og:description", content: "Choose your dates and reserve this room instantly." },
    ],
  }),
  component: RoomDetail,
});

function RoomDetail() {
  const { roomId } = Route.useParams();
  const search = Route.useSearch();
  const today = toISODate(new Date());
  const [checkIn, setCheckIn] = useState(search.checkIn && search.checkIn >= today ? search.checkIn : today);
  const [checkOut, setCheckOut] = useState(search.checkOut ?? addDays(checkIn, 1));
  const [guests, setGuests] = useState(search.guests ?? 1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  useLiveHotelUpdates();

  const rooms = useRooms();
  const room = rooms.data?.find((r) => r.id === roomId);
  const validRange = checkOut > checkIn;
  const booked = useBookedRanges(checkIn, validRange ? checkOut : addDays(checkIn, 1));
  const taken = booked.data?.some((b) => b.room_id === roomId && rangesOverlap(checkIn, checkOut, b.check_in, b.check_out));
  const nights = nightsBetween(checkIn, checkOut);

  if (rooms.isLoading) return <main className="mx-auto max-w-6xl px-4 py-12"><Skeleton className="h-[480px]" /></main>;
  if (!room)
    return (
      <main className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 className="text-4xl">Room not found</h1>
        <Button asChild className="mt-6"><Link to="/rooms">Back to rooms</Link></Button>
      </main>
    );

  const blocked = !validRange || taken || room.status !== "available" || guests > room.capacity;

  async function book() {
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("bookings").insert({
      room_id: roomId,
      user_id: session.user.id,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      special_requests: notes || null,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      qc.invalidateQueries({ queryKey: ["booked"] });
      return;
    }
    toast.success("Reservation confirmed!");
    navigate({ to: "/my-bookings" });
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <img src={roomImage(room)} alt={room.name} width={1200} height={800} className="aspect-[3/2] w-full rounded-md object-cover shadow-elegant" />
        <p className="eyebrow mt-8">{room.room_type} · Room {room.number} · Floor {room.floor}</p>
        <h1 className="mt-2 text-5xl text-primary">{room.name}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{room.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {room.amenities.map((a) => <Badge key={a} variant="secondary">{a}</Badge>)}
        </div>
      </div>

      <aside className="h-fit rounded-md border bg-card p-6 shadow-elegant lg:sticky lg:top-24">
        <p className="text-2xl font-semibold">{formatINR(room.price_per_night)} <span className="text-sm font-normal text-muted-foreground">/ night</span></p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ci">Check-in</Label>
            <Input id="ci" type="date" min={today} value={checkIn} onChange={(e) => {
              setCheckIn(e.target.value);
              if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
            }} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="co">Check-out</Label>
            <Input id="co" type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="g">Guests (max {room.capacity})</Label>
          <Input id="g" type="number" min={1} max={room.capacity} value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} />
        </div>
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="n">Special requests</Label>
          <Textarea id="n" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Late arrival, extra pillows…" />
        </div>
        <div className="mt-6 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between"><span>{formatINR(room.price_per_night)} × {nights} night{nights === 1 ? "" : "s"}</span><span>{formatINR(Number(room.price_per_night) * nights)}</span></div>
          <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatINR(Number(room.price_per_night) * nights)}</span></div>
          <p className="text-xs text-muted-foreground">Pay at the hotel on arrival.</p>
        </div>
        {taken && <p className="mt-4 text-sm text-destructive">Already booked for these dates — try different dates.</p>}
        {room.status !== "available" && <p className="mt-4 text-sm text-destructive">This room is temporarily closed.</p>}
        <Button className="mt-6 w-full" variant="brass" size="lg" disabled={blocked || busy} onClick={book}>
          {busy ? "Reserving…" : session ? "Reserve now" : "Sign in to reserve"}
        </Button>
      </aside>
    </main>
  );
}
