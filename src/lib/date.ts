import type { Timestamp } from "firebase/firestore";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;

/** "YYYY-MM-DD" -> "DD-MM-YYYY" */
export function isoToDisplay(iso: string): string {
  const m = iso.match(ISO_DATE_RE);
  if (!m) return iso;
  const [, yyyy, mm, dd] = m;
  return `${dd}-${mm}-${yyyy}`;
}

/** "DD-MM-YYYY" -> "YYYY-MM-DD" (for native <input type="date"> values) */
export function displayToIso(display: string): string {
  const m = display.match(DISPLAY_DATE_RE);
  if (!m) return display;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Firestore Timestamp -> "DD-MM-YYYY" */
export function formatTimestampDate(ts: Timestamp | null | undefined): string {
  if (!ts?.toDate) return "—";
  return formatDisplayDate(ts.toDate());
}

/** Firestore Timestamp -> "DD-MM-YYYY HH:MM" */
export function formatTimestampDateTime(ts: Timestamp | null | undefined): string {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${formatDisplayDate(d)} ${hh}:${min}`;
}
