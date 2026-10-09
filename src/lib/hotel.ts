import type { Tables } from "@/integrations/supabase/types";
import standardImg from "@/assets/room-standard.jpg";
import deluxeImg from "@/assets/room-deluxe.jpg";
import suiteImg from "@/assets/room-suite.jpg";

export type Room = Tables<"rooms">;
export type Booking = Tables<"bookings">;
export type Profile = Tables<"profiles">;

export const HOTEL_NAME = "A4MP ROOMS";

export function roomImage(room: Pick<Room, "image_url" | "room_type">) {
  if (room.image_url) return room.image_url;
  const t = room.room_type.toLowerCase();
  if (t.includes("suite")) return suiteImg;
  if (t.includes("deluxe")) return deluxeImg;
  return standardImg;
}

export function formatINR(n: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function nightsBetween(checkIn: string, checkOut: string) {
  const a = new Date(checkIn + "T00:00:00").getTime();
  const b = new Date(checkOut + "T00:00:00").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string) {
  return aIn < bOut && aOut > bIn;
}

export function friendlyDbError(message: string) {
  if (message.includes("no_double_booking")) return "Sorry, this room was just booked for those dates. Please choose other dates.";
  return message;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
};
