import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { HOTEL_NAME } from "@/lib/hotel";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { session, isStaff } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pending = 0 } = useQuery({
    queryKey: ["bookings", "pending-count"],
    enabled: isStaff,
    refetchInterval: 15000,
    queryFn: async () => {
      const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = "text-sm text-muted-foreground hover:text-foreground transition-colors";
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="font-display text-2xl tracking-wide text-primary">
          {HOTEL_NAME}
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link to="/rooms" className={link} activeProps={{ className: "text-foreground" }}>
            Rooms
          </Link>
          {session && (
            <Link to="/my-bookings" className={link} activeProps={{ className: "text-foreground" }}>
              My stays
            </Link>
          )}
          {isStaff && (
            <Link to="/admin" className={`${link} relative`} activeProps={{ className: "text-foreground" }}>
              Admin
              {pending > 0 && (
                <span className="absolute -right-4 -top-2 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{pending}</span>
              )}
            </Link>
          )}
          {session ? (
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
