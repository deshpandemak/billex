import type { UserRole } from "@/types";

export function isAdmin(role: UserRole | null): boolean {
  return role === "admin";
}

export function isDataOperator(role: UserRole | null): boolean {
  return role === "data_operator";
}

export function isBillViewer(role: UserRole | null): boolean {
  return role === "bill_viewer";
}
