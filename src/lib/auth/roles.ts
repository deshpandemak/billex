import type { UserRole } from "@/types";

export function isAdmin(role: UserRole | null): boolean {
  return role === "admin";
}
