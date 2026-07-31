import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { AuditAction, UserRole } from "@/types";

interface AuditActor {
  uid: string;
  displayName: string;
  role: UserRole;
}

export async function logAudit(
  action: AuditAction,
  entityType: "boardEntry" | "bill",
  entityId: string,
  description: string,
  actor: AuditActor,
  metadata: Record<string, string | number | boolean | null> = {}
): Promise<void> {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      entityType,
      entityId,
      description,
      performedBy: actor.uid,
      performedByName: actor.displayName,
      performedByRole: actor.role,
      timestamp: Timestamp.now(),
      metadata,
    });
  } catch (err) {
    // Audit failures must never crash the main flow — log and continue
    console.error("[audit] failed to write audit log", { action, entityId, err });
  }
}
