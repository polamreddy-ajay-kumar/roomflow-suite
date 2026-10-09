import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BookingUpdate = Database["public"]["Tables"]["bookings"]["Update"];
import { useAuth } from "@/lib/auth";
import { useLiveHotelUpdates } from "@/lib/availability";
import { formatINR, STATUS_LABEL } from "@/lib/hotel";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Front desk — The Verdant" },
      { name: "description", content: "Manage reservations, check-ins and payments." },
      { property: "og:title", content: "Front desk — The Verdant" },
      { property: "og:description", content: "Manage reservations, check-ins and payments." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isStaff, loading } = useAuth();
  const qc = useQueryClient();
  useLiveHotelUpdates();
  const { data } = useQuery({
    queryKey: ["bookings"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, rooms(name, number), profiles(full_name, email)")
        .order("check_in", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function update(id: string, patch: BookingUpdate) {
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["bookings"] });
  }

  if (loading) return <main className="p-12">Loading…</main>;
  if (!isStaff) return <main className="mx-auto max-w-4xl px-4 py-20 text-center">Staff access only.</main>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow">Staff</p>
      <h1 className="mt-2 text-5xl text-primary">Front desk</h1>
      <div className="mt-8 overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>{["Guest", "Room", "Dates", "Total", "Status", "Payment"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {data?.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3">{b.profiles?.full_name || b.profiles?.email}</td>
                <td className="p-3">{b.rooms?.number} · {b.rooms?.name}</td>
                <td className="p-3">{b.check_in} → {b.check_out}</td>
                <td className="p-3">{formatINR(b.total_price)}</td>
                <td className="p-3">
                  <select className="rounded border bg-background p-1" value={b.status} onChange={(e) => update(b.id, { status: e.target.value })}>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <select className="rounded border bg-background p-1" value={b.payment_status} onChange={(e) => update(b.id, { payment_status: e.target.value })}>
                    <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
