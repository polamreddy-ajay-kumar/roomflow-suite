import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBookedRanges, useLiveHotelUpdates, useRooms } from "@/lib/availability";
import { foodTotal, useMenu } from "@/lib/menu";
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
  const [names, setNames] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const menu = useMenu();
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

  const guestNames = Array.from({ length: guests }, (_, i) => names[i] ?? "");
  const namesOk = guestNames.every((n) => n.trim().length > 1);
  const phoneOk = /^[+0-9 ()-]{8,16}$/.test(phone.trim());
  const roomTotal = Number(room.price_per_night) * nights;
  const food = foodTotal(menu.data ?? [], qty);
  const grand = roomTotal + food;
  const blocked = !validRange || taken || room.status !== "available" || guests > room.capacity;

  function setQ(id: string, d: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(50, (q[id] ?? 0) + d)) }));
  }

  async function book() {
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    if (!namesOk) { toast.error("Please enter the name of every guest."); return; }
    if (!phoneOk) { toast.error("Please enter a valid phone number."); return; }
    setBusy(true);
    const { error } = await supabase.from("bookings").insert({
      room_id: roomId,
      user_id: session.user.id,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      guest_names: guestNames.map((n) => n.trim()),
      contact_phone: phone.trim(),
      food_items: Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ id, qty: n })),
      special_requests: notes || null,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      qc.invalidateQueries({ queryKey: ["booked"] });
      return;
    }
    toast.success("Booking request sent! The hotel will confirm shortly.");
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
          <Input id="g" type="number" min={1} max={room.capacity} value={guests} onChange={(e) => setGuests(Math.max(1, Math.min(room.capacity, Number(e.target.value) || 1)))} />
        </div>
        <div className="mt-3 grid gap-2">
          <Label>Names of guests staying</Label>
          {guestNames.map((n, i) => (
            <Input key={i} value={n} maxLength={80} placeholder={`Guest ${i + 1} full name`} onChange={(e) => {
              const next = [...guestNames];
              next[i] = e.target.value;
              setNames(next);
            }} />
          ))}
        </div>
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="ph">Contact phone number</Label>
          <Input id="ph" type="tel" value={phone} maxLength={16} placeholder="+91 98765 43210" onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="mt-5">
          <Label>Add food (optional)</Label>
          <div className="mt-2 max-h-72 space-y-3 overflow-y-auto rounded-md border p-3">
            {Array.from(new Set((menu.data ?? []).filter((m) => m.available).map((m) => m.category))).map((cat) => (
              <div key={cat}>
                <p className="eyebrow mb-1">{cat}</p>
                {(menu.data ?? []).filter((m) => m.available && m.category === cat).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{m.is_veg ? "🟢" : "🔴"} {m.name}</p>
                      <p className="text-xs text-muted-foreground">{formatINR(m.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQ(m.id, -1)}>−</Button>
                      <span className="w-5 text-center">{qty[m.id] ?? 0}</span>
                      <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQ(m.id, 1)}>+</Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="n">Special requests</Label>
          <Textarea id="n" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Late arrival, extra pillows…" />
        </div>
        <div className="mt-6 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between"><span>{formatINR(room.price_per_night)} × {nights} night{nights === 1 ? "" : "s"}</span><span>{formatINR(roomTotal)}</span></div>
          {food > 0 && <div className="flex justify-between"><span>Food</span><span>{formatINR(food)}</span></div>}
          <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatINR(grand)}</span></div>
          <p className="text-xs text-muted-foreground">Your request goes to the hotel for confirmation. Pay at the hotel or as instructed.</p>
        </div>
        {taken && <p className="mt-4 text-sm text-destructive">Already booked for these dates — try different dates.</p>}
        {room.status !== "available" && <p className="mt-4 text-sm text-destructive">This room is temporarily closed.</p>}
        <Button className="mt-6 w-full" variant="brass" size="lg" disabled={blocked || busy} onClick={book}>
          {busy ? "Sending…" : session ? `Book now · ${formatINR(grand)}` : "Sign in to reserve"}
        </Button>
      </aside>
    </main>
  );
}
