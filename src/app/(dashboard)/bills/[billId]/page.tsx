"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  collection, doc, getDoc, getDocs, orderBy, query, Timestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin, isBillViewer, isDataOperator } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle } from "lucide-react";
import type { Bill, BoardEntry, CorrectionType } from "@/types";
import { BILL_STATUS_LABELS, CORRECTION_TYPES, DESIGNATION_LABELS, RESULT_STATUS_LABELS } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  open_for_review: "bg-yellow-100 text-yellow-800",
  final: "bg-green-100 text-green-700",
};

export default function BillDetailPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const billId = params.billId as string;

  const admin = isAdmin(role);
  const dataOp = isDataOperator(role);
  const billViewer = isBillViewer(role);
  const canAccess = admin || dataOp || billViewer;

  const [bill, setBill] = useState<Bill | null>(null);
  const [entries, setEntries] = useState<BoardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bill viewer corrections
  const [corrections, setCorrections] = useState<Record<string, CorrectionType | "">>({});
  const [submittingCorrections, setSubmittingCorrections] = useState(false);
  // canEditCorrections also requires the bill to still be open — once
  // submitted for billing, it's frozen and no more corrections can be added.
  const canEditCorrections = billViewer && bill?.status !== "final";

  // Data operator / admin: submit for billing (finalize)
  const [submittingBill, setSubmittingBill] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) { router.push("/dashboard"); return; }
    loadBill();
  }, [authLoading, canAccess, billId]);

  async function loadBill() {
    setLoading(true);
    setError(null);
    try {
      const billSnap = await getDoc(doc(db, "bills", billId));
      if (!billSnap.exists()) {
        setError("Bill not found.");
        setLoading(false);
        return;
      }
      const billData = { id: billSnap.id, ...billSnap.data() } as Bill;
      setBill(billData);

      // Load board entries for this bill's pleader + date range
      const entriesSnap = await getDocs(
        query(
          collection(db, "boardEntries"),
          where("pleaderId", "==", billData.pleaderId),
          where("date", ">=", billData.dateFrom),
          where("date", "<=", billData.dateTo),
          orderBy("date", "asc")
        )
      );
      const loadedEntries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardEntry);
      setEntries(loadedEntries);
      const initialCorrections: Record<string, CorrectionType | ""> = {};
      loadedEntries.forEach((e) => {
        initialCorrections[e.id] = e.correctionRequested || "";
      });
      setCorrections(initialCorrections);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load bill: ${msg}`);
      console.error("[bill-detail] loadBill", err);
    } finally {
      setLoading(false);
    }
  }

  const dirtyRows = entries.filter((e) => (corrections[e.id] || "") !== (e.correctionRequested || ""));
  const pendingCorrectionsCount = entries.filter((e) => e.correctionRequested).length;

  async function handleSubmitCorrections() {
    if (!user || !role || dirtyRows.length === 0) return;
    setSubmittingCorrections(true);
    setError(null);
    const actor = { uid: user.uid, displayName: user.displayName || user.email || "", role };
    const now = Timestamp.now();
    const rowSnapshot = dirtyRows;
    try {
      const results = await Promise.allSettled(
        rowSnapshot.map(async (row) => {
          const value = corrections[row.id] || "";
          await updateDoc(doc(db, "boardEntries", row.id), {
            correctionRequested: value,
            correctionRequestedBy: actor.displayName,
            correctionRequestedAt: now,
          });
          logAudit(
            "board_entry_correction_requested",
            "boardEntry",
            row.id,
            value
              ? `Flagged correction "${value}" for entry ${row.caseType}/${row.caseNo}/${row.year} (${row.date})`
              : `Cleared correction flag for entry ${row.caseType}/${row.caseNo}/${row.year} (${row.date})`,
            actor,
            { date: row.date, correctionRequested: value, billId }
          );
          return row.id;
        })
      );

      const succeededIds = new Set(
        results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
      );
      setEntries((prev) =>
        prev.map((e) =>
          succeededIds.has(e.id)
            ? { ...e, correctionRequested: corrections[e.id] || "", correctionRequestedBy: actor.displayName, correctionRequestedAt: now }
            : e
        )
      );

      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        setError(`${failedCount} correction(s) failed to save. Please try again.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to submit corrections: ${msg}`);
      console.error("[bill-detail] handleSubmitCorrections", err);
    } finally {
      setSubmittingCorrections(false);
    }
  }

  async function handleSubmitForBilling() {
    if (!bill || !user || !role) return;
    if (!confirm("Submit this bill for billing? It will be frozen — no further corrections or changes will be possible.")) return;
    setSubmittingBill(true);
    setError(null);
    try {
      await updateDoc(doc(db, "bills", billId), {
        status: "final",
        finalizedAt: Timestamp.now(),
        finalizedBy: user.uid,
        finalizedByName: user.displayName || user.email || "",
      });

      // Freeze the underlying entries so bill viewers can no longer add
      // or change corrections on them.
      const batch = writeBatch(db);
      entries.forEach((entry) => {
        batch.update(doc(db, "boardEntries", entry.id), { billLocked: true });
      });
      await batch.commit();

      logAudit("bill_finalized", "bill", billId,
        `Bill submitted for billing: ${bill.pleaderName} (${bill.dateFrom} to ${bill.dateTo})`,
        { uid: user.uid, displayName: user.displayName || user.email || "", role },
        { billId, pleaderName: bill.pleaderName, totalFees: bill.totalFees }
      );
      await loadBill();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to submit bill: ${msg}`);
      console.error("[bill-detail] handleSubmitForBilling", err);
    } finally {
      setSubmittingBill(false);
    }
  }

  if (!canAccess) return null;

  // Live total recomputed from current board entries (may differ from bill.totalFees if entries were edited after generation)
  const liveTotal = entries.reduce((s, e) => s + (e.fees || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/bills" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">Bill Detail</h1>
        {bill && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[bill.status]}`}>
            {BILL_STATUS_LABELS[bill.status]}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !bill ? null : (
        <>
          {/* Bill Summary */}
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
                <div><dt className="text-gray-500">Pleader</dt><dd className="font-semibold">{bill.pleaderName}</dd></div>
                <div><dt className="text-gray-500">Designation</dt><dd>{DESIGNATION_LABELS[bill.designation]}</dd></div>
                <div><dt className="text-gray-500">Period</dt><dd>{formatDate(bill.dateFrom)} → {formatDate(bill.dateTo)}</dd></div>
                <div><dt className="text-gray-500">Generated By</dt><dd>{bill.createdByName}</dd></div>
                <div><dt className="text-gray-500">Total Entries</dt><dd>{entries.length}</dd></div>
                <div><dt className="text-gray-500">Total Fees</dt><dd className="font-bold text-blue-700">₹{bill.totalFees.toLocaleString()}</dd></div>
                {bill.finalizedByName && (
                  <div><dt className="text-gray-500">Finalized By</dt><dd className="text-green-700">{bill.finalizedByName}</dd></div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Data Operator / Admin: Submit for Billing */}
          {(dataOp || admin) && bill.status !== "final" && (
            <div className="flex items-center gap-4">
              <Button onClick={handleSubmitForBilling} disabled={submittingBill} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4" />
                {submittingBill ? "Submitting..." : "Submit for Billing"}
              </Button>
              <p className="text-sm text-gray-500">
                {pendingCorrectionsCount > 0
                  ? `The Bill Viewer has flagged ${pendingCorrectionsCount} correction(s) below. Review and fix them, then submit for billing.`
                  : "Once all entries are verified, submit this bill for billing. It will be frozen after that."}
              </p>
            </div>
          )}

          {/* Bill Viewer: Submit Corrections */}
          {canEditCorrections && entries.length > 0 && (
            <div className="flex items-center gap-4">
              <Button onClick={handleSubmitCorrections} disabled={submittingCorrections || dirtyRows.length === 0}>
                {submittingCorrections ? "Submitting..." : `Submit Corrections${dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ""}`}
              </Button>
              <p className="text-sm text-gray-500">Flag any entries below that need correction, then submit.</p>
            </div>
          )}

          {/* Entries Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Board Entries ({entries.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {entries.length === 0 ? (
                <p className="p-6 text-sm text-gray-400">No board entries found for this period and pleader.</p>
              ) : (
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Case</th>
                      <th className="px-4 py-3 font-medium">Party</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Fees (₹)</th>
                      <th className="px-4 py-3 font-medium">Corrections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">{formatDate(e.date)}</td>
                        <td className="px-4 py-3 font-mono">{e.caseType} {e.caseNo}/{e.year}</td>
                        <td className="px-4 py-3">{e.petitioner}</td>
                        <td className="px-4 py-3">{e.status ? RESULT_STATUS_LABELS[e.status] : "—"}</td>
                        <td className="px-4 py-3 font-semibold">₹{(e.fees || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {canEditCorrections ? (
                            <Select
                              className="w-56"
                              value={corrections[e.id] || ""}
                              onChange={(ev) =>
                                setCorrections((prev) => ({ ...prev, [e.id]: ev.target.value as CorrectionType | "" }))
                              }
                            >
                              <option value="">None</option>
                              {CORRECTION_TYPES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </Select>
                          ) : (
                            e.correctionRequested || "—"
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold bg-gray-50">
                      <td className="px-4 py-3" colSpan={5}>Total</td>
                      <td className="px-4 py-3 text-blue-700">₹{liveTotal.toLocaleString()}</td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
