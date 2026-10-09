import type { Tables } from "@/integrations/supabase/types";
import stdImg from "@/assets/room-std-1.jpg";
import deluxeImg from "@/assets/room-deluxe-1.jpg";
import suiteImg from "@/assets/room-suite-1.jpg";
import twinImg from "@/assets/room-twin-1.jpg";
import presidentialImg from "@/assets/room-presidential-1.jpg";
import familyImg from "@/assets/room-family-1.jpg";
import oceanImg from "@/assets/room-ocean-1.jpg";
import businessImg from "@/assets/room-business-1.jpg";
import penthouseImg from "@/assets/room-penthouse-1.jpg";
import juniorImg from "@/assets/room-junior-1.jpg";
import heritageImg from "@/assets/room-heritage-1.jpg";
import studioImg from "@/assets/room-studio-1.jpg";

export type Room = Tables<"rooms">;
export type Booking = Tables<"bookings">;
export type Profile = Tables<"profiles">;

export const HOTEL_NAME = "A4MP ROOMS";

const ROOM_IMAGES: Record<string, string> = {
  studio: studioImg,
  standard: stdImg,
  twin: twinImg,
  business: businessImg,
  deluxe: deluxeImg,
  family: familyImg,
  ocean: oceanImg,
  junior: juniorImg,
  heritage: heritageImg,
  suite: suiteImg,
  presidential: presidentialImg,
  penthouse: penthouseImg,
};

export function roomImage(room: Pick<Room, "image_url" | "room_type">) {
  if (room.image_url && ROOM_IMAGES[room.image_url]) return ROOM_IMAGES[room.image_url];
  const t = room.room_type.toLowerCase();
  if (t.includes("penthouse")) return penthouseImg;
  if (t.includes("presidential")) return presidentialImg;
  if (t.includes("heritage")) return heritageImg;
  if (t.includes("junior")) return juniorImg;
  if (t.includes("suite")) return suiteImg;
  if (t.includes("ocean")) return oceanImg;
  if (t.includes("family")) return familyImg;
  if (t.includes("deluxe")) return deluxeImg;
  if (t.includes("business")) return businessImg;
  if (t.includes("twin")) return twinImg;
  if (t.includes("studio")) return studioImg;
  return stdImg;
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
