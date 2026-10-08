import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveHotelUpdates } from "@/lib/availability";
import { formatINR, nightsBetween, roomImage, STATUS_LABEL, toISODate } from "@/lib/hotel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/my-bookings")({
  head: () => ({
    meta: [
      { title: "My stays — The Verdant" },
      { name: "description", content: "View and manage your upcoming and past reservations." },
      { property: "og:title", content: "My stays — The Verdant" },
      { property: "og:description", content: "View and manage your upcoming and past reservations." },
    ],
  }),
  component: MyBookings,
});

function MyBookings() {
  const { session } = useAuth();
  const qc = useQueryClient();
  useLiveHotelUpdates();
  const userId = session?.user.id;
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, rooms(name, number, room_type, image_url)")
        .eq("user_id", userId!)
        .order("check_in", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const today = toISODate(new Date());

  async function cancel(id: string) {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reservation cancelled");
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <p className="eyebrow">Your account</p>
      <h1 className="mt-2 text-5xl text-primary">My stays</h1>
      {isLoading && <p className="mt-8 text-muted-foreground">Loading…</p>}
      {data?.length === 0 && (
        <div className="mt-10 rounded-md border bg-card p-10 text-center">
          <p className="text-muted-foreground">No reservations yet.</p>
          <Button asChild className="mt-4"><Link to="/rooms">Find a room</Link></Button>
        </div>
      )}
      <div className="mt-8 grid gap-4">
        {data?.map((b) => {
          const canCancel = (b.status === "confirmed" || b.status === "pending") && b.check_in >= today;
          return (
            <div key={b.id} className="flex flex-col gap-4 overflow-hidden rounded-md border bg-card sm:flex-row">
              {b.rooms && <img src={roomImage(b.rooms)} alt={b.rooms.name} loading="lazy" width={1200} height={800} className="h-40 w-full object-cover sm:h-auto sm:w-48" />}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl">{b.rooms?.name}</h2>
                  <Badge variant={b.status === "cancelled" ? "destructive" : "secondary"}>{STATUS_LABEL[b.status]}</Badge>
                  <Badge variant="outline">{b.payment_status === "paid" ? "Paid" : b.payment_status === "refunded" ? "Refunded" : "Pay at hotel"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {b.check_in} → {b.check_out} · {nightsBetween(b.check_in, b.check_out)} nights · {b.guests} guest{b.guests > 1 ? "s" : ""}
                </p>
                <p className="font-semibold">{formatINR(b.total_price)}</p>
                <p className="text-xs text-muted-foreground">Booking ref: {b.id.slice(0, 8).toUpperCase()}</p>
                {canCancel && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-fit">Cancel reservation</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this reservation?</AlertDialogTitle>
                        <AlertDialogDescription>The room will be released for other guests.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancel(b.id)}>Yes, cancel</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
