"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import type { AuditAction, AuditLog } from "@/types";

const ACTION_LABELS: Record<AuditAction, string> = {
  board_entry_created: "Entry Created",
  board_entry_updated: "Entry Updated",
  board_entry_deleted: "Entry Deleted",
  board_entry_correction_requested: "Correction Requested",
  bill_generated: "Bill Generated",
  bill_submitted: "Bill Submitted",
  bill_finalized: "Bill Submitted for Billing",
};

const ACTION_COLORS: Partial<Record<AuditAction, string>> = {
  board_entry_deleted: "bg-red-100 text-red-700",
  board_entry_correction_requested: "bg-orange-100 text-orange-800",
  bill_finalized: "bg-green-100 text-green-700",
  bill_generated: "bg-blue-100 text-blue-700",
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

interface OperatorMetrics {
  uid: string;
  name: string;
  created: number;
  updated: number;
  deleted: number;
  billsGenerated: number;
  billsFinalized: number;
}

export default function AuditPage() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  const admin = isAdmin(role);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range defaults to today
  const [filterDateFrom, setFilterDateFrom] = useState(todayISO());
  const [filterDateTo, setFilterDateTo] = useState(todayISO());

  // Detail-log filters (applied client-side to the already-loaded logs)
  const [filterAction, setFilterAction] = useState<AuditAction | "">("");
  const [filterEntityType, setFilterEntityType] = useState<"" | "boardEntry" | "bill">("");
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
      // Use Firestore timestamp range when dates are set — avoids a fixed row limit
      // and relies only on the auto-indexed `timestamp` single-field index.
      let q;
      if (filterDateFrom || filterDateTo) {
        const constraints = [orderBy("timestamp", "desc")] as Parameters<typeof query>[1][];
        if (filterDateFrom) {
          constraints.push(where("timestamp", ">=", Timestamp.fromDate(new Date(filterDateFrom + "T00:00:00"))));
        }
        if (filterDateTo) {
          constraints.push(where("timestamp", "<=", Timestamp.fromDate(new Date(filterDateTo + "T23:59:59"))));
        }
        q = query(collection(db, "auditLogs"), ...constraints);
      } else {
        q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(200));
      }

      const snap = await getDocs(q);
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load audit logs: ${msg}`);
      console.error("[admin/audit] loadLogs", err);
    } finally {
      setLoading(false);
    }
  }

  // Per-operator metrics derived from loaded logs (board entry actions only)
  const operatorMetrics = useMemo<OperatorMetrics[]>(() => {
    const map = new Map<string, OperatorMetrics>();
    for (const log of logs) {
      if (!["board_entry_created", "board_entry_updated", "board_entry_deleted",
            "bill_generated", "bill_finalized"].includes(log.action)) continue;
      if (!map.has(log.performedBy)) {
        map.set(log.performedBy, {
          uid: log.performedBy,
          name: log.performedByName,
          created: 0, updated: 0, deleted: 0,
          billsGenerated: 0, billsFinalized: 0,
        });
      }
      const m = map.get(log.performedBy)!;
      if (log.action === "board_entry_created") m.created++;
      else if (log.action === "board_entry_updated") m.updated++;
      else if (log.action === "board_entry_deleted") m.deleted++;
      else if (log.action === "bill_generated") m.billsGenerated++;
      else if (log.action === "bill_finalized") m.billsFinalized++;
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.created + b.updated + b.deleted) - (a.created + a.updated + a.deleted)
    );
  }, [logs]);

  // Filtered log list for the detail table (client-side only)
  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filterEntityType) result = result.filter((l) => l.entityType === filterEntityType);
    if (filterAction) result = result.filter((l) => l.action === filterAction);
    if (filterUser.trim()) {
      const q = filterUser.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.performedByName?.toLowerCase().includes(q) ||
          l.performedBy?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filterEntityType, filterAction, filterUser]);

  if (!admin) return null;

  const dateLabel =
    filterDateFrom === filterDateTo && filterDateFrom
      ? filterDateFrom === todayISO() ? "Today" : formatDate(filterDateFrom)
      : filterDateFrom && filterDateTo
      ? `${formatDate(filterDateFrom)} → ${formatDate(filterDateTo)}`
      : "All dates";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Date range — controls both metrics and log fetch */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label>From Date</Label>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>To Date</Label>
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
        <Button onClick={loadLogs} disabled={loading}>
          {loading ? "Loading..." : "Apply"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Operator Metrics ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data Operator Activity — {dateLabel}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : operatorMetrics.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No activity recorded for this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Operator</th>
                  <th className="px-4 py-3 text-center font-medium text-green-700">Created</th>
                  <th className="px-4 py-3 text-center font-medium text-blue-700">Updated</th>
                  <th className="px-4 py-3 text-center font-medium text-red-600">Deleted</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Total Entries</th>
                  <th className="px-4 py-3 text-center font-medium text-purple-700">Bills Generated</th>
                  <th className="px-4 py-3 text-center font-medium text-teal-700">Bills Finalized</th>
                </tr>
              </thead>
              <tbody>
                {operatorMetrics.map((m) => {
                  const total = m.created + m.updated + m.deleted;
                  return (
                    <tr key={m.uid} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums text-green-700">
                        {m.created > 0 ? m.created : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums text-blue-700">
                        {m.updated > 0 ? m.updated : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums text-red-600">
                        {m.deleted > 0 ? m.deleted : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-bold tabular-nums">{total}</td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums text-purple-700">
                        {m.billsGenerated > 0 ? m.billsGenerated : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums text-teal-700">
                        {m.billsFinalized > 0 ? m.billsFinalized : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {operatorMetrics.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 bg-gray-50 font-bold text-gray-700">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-center tabular-nums text-green-700">
                      {operatorMetrics.reduce((s, m) => s + m.created, 0)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-blue-700">
                      {operatorMetrics.reduce((s, m) => s + m.updated, 0)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-red-600">
                      {operatorMetrics.reduce((s, m) => s + m.deleted, 0)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {operatorMetrics.reduce((s, m) => s + m.created + m.updated + m.deleted, 0)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-purple-700">
                      {operatorMetrics.reduce((s, m) => s + m.billsGenerated, 0)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-teal-700">
                      {operatorMetrics.reduce((s, m) => s + m.billsFinalized, 0)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Filters ───────────────────────────────────────── */}
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
          <Label>User</Label>
          <Input
            placeholder="Name or UID..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* ── Detail Log Table ─────────────────────────────────────── */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : filteredLogs.length === 0 ? (
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
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
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
              <p className="px-4 py-3 text-xs text-gray-400">
                {filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""}
                {filteredLogs.length < logs.length ? ` (filtered from ${logs.length})` : ""}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
