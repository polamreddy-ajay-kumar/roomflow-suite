import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useLiveHotelUpdates, useRooms } from "@/lib/availability";
import { formatINR, STATUS_LABEL, type Room } from "@/lib/hotel";
import { useMenu, type FoodLine, type MenuItem } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type BookingUpdate = Database["public"]["Tables"]["bookings"]["Update"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — A4MP ROOMS" },
      { name: "description", content: "Confirm bookings, edit rooms and manage the food menu." },
      { property: "og:title", content: "Admin dashboard — A4MP ROOMS" },
      { property: "og:description", content: "Confirm bookings, edit rooms and manage the food menu." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isStaff, loading } = useAuth();
  const [tab, setTab] = useState<"bookings" | "rooms" | "menu">("bookings");
  const qc = useQueryClient();
  useLiveHotelUpdates();

  useEffect(() => {
    if (!isStaff) return;
    const ch = supabase
      .channel("admin-new-bookings")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings" }, () => {
        toast.info("🔔 New booking received — please review and confirm.");
        qc.invalidateQueries({ queryKey: ["bookings"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isStaff, qc]);

  if (loading) return <main className="p-12">Loading…</main>;
  if (!isStaff) return <main className="mx-auto max-w-4xl px-4 py-20 text-center">Admin access only.</main>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-5xl text-primary">Dashboard</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {(["bookings", "rooms", "menu"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t === "menu" ? "Food menu" : t}</Button>
        ))}
      </div>
      {tab === "bookings" && <Bookings />}
      {tab === "rooms" && <RoomsEditor />}
      {tab === "menu" && <MenuEditor />}
    </main>
  );
}

function Bookings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, rooms(name, number), profiles(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function update(id: string, patch: BookingUpdate) {
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["bookings"] });
  }

  const pending = data?.filter((b) => b.status === "pending") ?? [];

  return (
    <section className="mt-8">
      {pending.length > 0 && (
        <div className="mb-6 rounded-md border border-accent bg-accent/10 p-4">
          <p className="font-semibold">🔔 {pending.length} new booking{pending.length > 1 ? "s" : ""} waiting for confirmation</p>
        </div>
      )}
      <div className="grid gap-4">
        {data?.map((b) => {
          const food = (b.food_items as FoodLine[] | null) ?? [];
          return (
            <div key={b.id} className={`rounded-md border bg-card p-4 ${b.status === "pending" ? "ring-2 ring-accent" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">Room {b.rooms?.number} · {b.rooms?.name}</p>
                  <p className="text-sm text-muted-foreground">{b.check_in} → {b.check_out} · {b.guests} guest(s) · Ref {b.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={b.status === "pending" ? "default" : "secondary"}>{STATUS_LABEL[b.status]}</Badge>
                  <span className="font-semibold">{formatINR(b.total_price)}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Account:</span> {b.profiles?.full_name || b.profiles?.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {b.contact_phone || "—"}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Guests:</span> {b.guest_names.length ? b.guest_names.join(", ") : "—"}</p>
                {food.length > 0 && (
                  <p className="sm:col-span-2"><span className="text-muted-foreground">Food ({formatINR(b.food_total)}):</span> {food.map((f) => `${f.name} × ${f.qty}`).join(", ")}</p>
                )}
                {b.special_requests && <p className="sm:col-span-2"><span className="text-muted-foreground">Notes:</span> {b.special_requests}</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {b.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => update(b.id, { status: "confirmed", admin_seen: true })}>Confirm booking</Button>
                    <Button size="sm" variant="outline" onClick={() => update(b.id, { status: "cancelled", admin_seen: true })}>Reject</Button>
                  </>
                )}
                <select className="rounded border bg-background p-1 text-sm" value={b.status} onChange={(e) => update(b.id, { status: e.target.value as NonNullable<BookingUpdate["status"]> })}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select className="rounded border bg-background p-1 text-sm" value={b.payment_status} onChange={(e) => update(b.id, { payment_status: e.target.value as NonNullable<BookingUpdate["payment_status"]> })}>
                  <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
                </select>
              </div>
            </div>
          );
        })}
        {data?.length === 0 && <p className="text-muted-foreground">No bookings yet.</p>}
      </div>
    </section>
  );
}

function RoomsEditor() {
  const { data } = useRooms();
  return (
    <section className="mt-8 grid gap-3">
      {data?.map((r) => <RoomRow key={r.id} room={r} />)}
    </section>
  );
}

function RoomRow({ room }: { room: Room }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: room.name, price: String(room.price_per_night), capacity: String(room.capacity), description: room.description, status: room.status });
  async function save() {
    const { error } = await supabase.from("rooms").update({
      name: f.name, price_per_night: Number(f.price), capacity: Number(f.capacity), description: f.description, status: f.status,
    }).eq("id", room.id);
    if (error) toast.error(error.message);
    else { toast.success(`Room ${room.number} saved`); qc.invalidateQueries({ queryKey: ["rooms"] }); }
  }
  return (
    <div className="grid gap-2 rounded-md border bg-card p-3 md:grid-cols-[60px_1fr_110px_80px_1.5fr_130px_auto] md:items-center">
      <span className="font-semibold">#{room.number}</span>
      <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} title="Price per night" />
      <Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} title="Max guests" />
      <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <select className="h-9 rounded border bg-background px-2 text-sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Room["status"] })}>
        <option value="available">Available</option><option value="maintenance">Maintenance</option>
      </select>
      <Button size="sm" onClick={save}>Save</Button>
    </div>
  );
}

function MenuEditor() {
  const { data } = useMenu();
  const qc = useQueryClient();
  const [n, setN] = useState({ name: "", category: "Main", price: "", is_veg: true });
  async function add() {
    if (!n.name.trim() || !Number(n.price)) { toast.error("Enter a name and price"); return; }
    const { error } = await supabase.from("menu_items").insert({ name: n.name.trim(), category: n.category, price: Number(n.price), is_veg: n.is_veg });
    if (error) toast.error(error.message);
    else { setN({ ...n, name: "", price: "" }); qc.invalidateQueries({ queryKey: ["menu"] }); }
  }
  return (
    <section className="mt-8">
      <div className="grid gap-2 rounded-md border bg-card p-3 md:grid-cols-[1fr_140px_110px_100px_auto] md:items-center">
        <Input placeholder="New dish name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <Input placeholder="Category" value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })} />
        <Input type="number" placeholder="Price" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} />
        <select className="h-9 rounded border bg-background px-2 text-sm" value={n.is_veg ? "veg" : "non"} onChange={(e) => setN({ ...n, is_veg: e.target.value === "veg" })}>
          <option value="veg">Veg</option><option value="non">Non-veg</option>
        </select>
        <Button onClick={add}>Add dish</Button>
      </div>
      <div className="mt-4 grid gap-2">
        {data?.map((m) => <MenuRow key={m.id} item={m} />)}
      </div>
    </section>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: item.name, category: item.category, price: String(item.price), available: item.available });
  const refresh = () => qc.invalidateQueries({ queryKey: ["menu"] });
  async function save() {
    const { error } = await supabase.from("menu_items").update({ name: f.name, category: f.category, price: Number(f.price), available: f.available }).eq("id", item.id);
    if (error) toast.error(error.message); else { toast.success("Saved"); refresh(); }
  }
  async function remove() {
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) toast.error(error.message); else refresh();
  }
  return (
    <div className="grid gap-2 rounded-md border bg-card p-3 md:grid-cols-[1fr_140px_110px_130px_auto_auto] md:items-center">
      <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
      <Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.available} onChange={(e) => setF({ ...f, available: e.target.checked })} /> Available</label>
      <Button size="sm" onClick={save}>Save</Button>
      <Button size="sm" variant="outline" onClick={remove}>Delete</Button>
    </div>
  );
}
