import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/hotel";

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("*").order("number");
      if (error) throw error;
      return data as Room[];
    },
  });
}

export function useBookedRanges(from: string, to: string) {
  return useQuery({
    queryKey: ["booked", from, to],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("booked_ranges", { _from: from, _to: to });
      if (error) throw error;
      return data;
    },
  });
}

/** Refresh room/booking data live whenever bookings or rooms change. */
export function useLiveHotelUpdates() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("hotel-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["booked"] });
        qc.invalidateQueries({ queryKey: ["bookings"] });
        qc.invalidateQueries({ queryKey: ["my-bookings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
        qc.invalidateQueries({ queryKey: ["rooms"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
