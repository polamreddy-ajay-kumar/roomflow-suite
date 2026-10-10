import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MenuItem = Tables<"menu_items">;
export type FoodLine = { id: string; name: string; price: number; qty: number };

export function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").order("category").order("name");
      if (error) throw error;
      return data as MenuItem[];
    },
  });
}

export function foodTotal(menu: MenuItem[], qty: Record<string, number>) {
  return menu.reduce((s, m) => s + Number(m.price) * (qty[m.id] ?? 0), 0);
}
