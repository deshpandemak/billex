"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import type { AuditAction, AuditLog } from "@/types";

const ACTION_LABELS: Record<AuditAction, string> = {
  board_entry_created: "Entry Created",
  board_entry_updated: "Entry Updated",
  board_entry_deleted: "Entry Deleted",
  bill_generated: "Bill Generated",
  bill_submitted: "Bill Submitted",
  bill_remarks_added: "Remarks Added",
  bill_finalized: "Bill Finalized",
};

const ACTION_COLORS: Partial<Record<AuditAction, string>> = {
  board_entry_deleted: "bg-red-100 text-red-700",
  bill_finalized: "bg-green-100 text-green-700",
  bill_remarks_added: "bg-orange-100 text-orange-800",
  bill_generated: "bg-blue-100 text-blue-700",
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[];
const PAGE_SIZE = 100;

export default function AuditPage() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  const admin = isAdmin(role);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState<AuditAction | "">("");
  const [filterEntityType, setFilterEntityType] = useState<"" | "boardEntry" | "bill">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterUser, setFilterUser] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!admin) { router.push("/dashboard"); return; }
    loadLogs();
  }, [authLoading, admin]);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const constraints: Parameters<typeof query>[1][] = [
        orderBy("timestamp", "desc"),
        limit(PAGE_SIZE),
      ];
      if (filterEntityType) constraints.push(where("entityType", "==", filterEntityType));
      if (filterAction) constraints.push(where("action", "==", filterAction));

      const snap = await getDocs(query(collection(db, "auditLogs"), ...constraints));
      let results = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog);

      // Client-side date and user filtering (Firestore can't combine arbitrary fields without composite indexes)
      if (filterDateFrom) {
        const from = new Date(filterDateFrom).getTime();
        results = results.filter((l) => l.timestamp?.toDate?.().getTime() >= from);
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo + "T23:59:59").getTime();
        results = results.filter((l) => l.timestamp?.toDate?.().getTime() <= to);
      }
      if (filterUser.trim()) {
        const q = filterUser.trim().toLowerCase();
        results = results.filter(
          (l) =>
            l.performedByName?.toLowerCase().includes(q) ||
            l.performedBy?.toLowerCase().includes(q)
        );
      }

      setLogs(results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load audit logs: ${msg}`);
      console.error("[admin/audit] loadLogs", err);
    } finally {
      setLoading(false);
    }
  }

  if (!admin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label>Action</Label>
          <Select value={filterAction} onChange={(e) => setFilterAction(e.target.value as AuditAction | "")} className="w-44">
            <option value="">All actions</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Entity Type</Label>
          <Select value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value as "" | "boardEntry" | "bill")} className="w-36">
            <option value="">All</option>
            <option value="boardEntry">Board Entry</option>
            <option value="bill">Bill</option>
          </Select>
        </div>
        <div>
          <Label>From Date</Label>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>To Date</Label>
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
        <div>
          <Label>User</Label>
          <Input
            placeholder="Name or UID..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={loadLogs} disabled={loading}>
          {loading ? "Loading..." : "Apply Filters"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No audit logs found.</p>
          ) : (
            <>
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Performed By</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {log.timestamp?.toDate?.().toLocaleString("en-IN") ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{log.performedByName}</div>
                        <div className="text-xs text-gray-400">{log.performedByRole}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="text-xs">{log.entityType}</div>
                        <div className="font-mono text-xs truncate max-w-[120px]" title={log.entityId}>{log.entityId}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[360px]">{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length >= PAGE_SIZE && (
                <p className="px-4 py-3 text-xs text-gray-400">Showing first {PAGE_SIZE} results. Use filters to narrow down.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
