import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, toISODate } from "@/lib/hotel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Verdant — Boutique Hotel, Book Direct" },
      { name: "description", content: "Check live room availability and book your stay at The Verdant in seconds." },
      { property: "og:title", content: "The Verdant — Boutique Hotel, Book Direct" },
      { property: "og:description", content: "Check live room availability and book your stay at The Verdant in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const today = toISODate(new Date());
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 2));
  const [guests, setGuests] = useState(2);
  const navigate = useNavigate();

  return (
    <main>
      <section className="relative min-h-[88vh] overflow-hidden bg-ink text-ink-foreground">
        <img src={hero} alt="The Verdant lobby at dusk" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-veil" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-14">
          <p className="eyebrow mb-4">Boutique hotel · Book direct</p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] sm:text-7xl">Quiet rooms, warm light, and a bed ready when you are.</h1>
          <form
            className="mt-10 grid gap-3 rounded-md bg-card p-4 text-card-foreground shadow-elegant sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/rooms", search: { checkIn, checkOut, guests } });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="ci">Check-in</Label>
              <Input id="ci" type="date" min={today} value={checkIn} onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
              }} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="co">Check-out</Label>
              <Input id="co" type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g">Guests</Label>
              <Input id="g" type="number" min={1} max={8} value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} />
            </div>
            <Button type="submit" variant="brass" size="lg">Check availability</Button>
          </form>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:grid-cols-3">
        {[
          ["Live availability", "Rooms update the moment they're booked — no double bookings, ever."],
          ["Instant confirmation", "Your reservation is confirmed right away and saved to your account."],
          ["Manage anytime", "View or cancel upcoming stays from My stays."],
        ].map(([t, d]) => (
          <div key={t}>
            <h3 className="text-2xl text-primary">{t}</h3>
            <p className="mt-2 text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
