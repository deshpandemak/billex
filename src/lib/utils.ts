import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DateLike = Date | Timestamp | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Formats a Date, Firestore Timestamp, or ISO date string as DD-MM-YYYY. */
export function formatDate(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Formats a Date, Firestore Timestamp, or ISO date string as DD-MM-YYYY, HH:MM AM/PM. */
export function formatDateTime(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "—";
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${formatDate(d)}, ${time}`;
}

const DISPLAY_DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Converts a DD-MM-YYYY display date back to YYYY-MM-DD, for native <input type="date"> values. */
export function displayToIso(display: string): string {
  const m = display.match(DISPLAY_DATE_RE);
  if (!m) return display;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Resolves the YYYY-MM-DD form of a stored date field for use as a Firestore
 * query bound. Prefers the `*ISO` shadow field; falls back to the display
 * field itself for documents written before that field existed — pre-migration
 * documents still hold a raw YYYY-MM-DD value there, and undefined would
 * otherwise crash the where() call.
 */
export function resolveDateISO(display: string, iso: string | undefined | null): string {
  if (iso) return iso;
  return ISO_DATE_RE.test(display) ? display : displayToIso(display);
}
