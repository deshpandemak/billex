"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  collection, doc, getDoc, getDocs, orderBy, query, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { formatTimestampDateTime } from "@/lib/date";
import { useAuth } from "@/lib/auth/context";
import { isAdmin, isBillViewer, isDataOperator } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle } from "lucide-react";
import type { Bill, BoardEntry } from "@/types";
import { BILL_STATUS_LABELS, DESIGNATION_LABELS, RESULT_STATUS_LABELS } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  open_for_review: "bg-yellow-100 text-yellow-800",
  under_revision: "bg-orange-100 text-orange-800",
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

  // Bill viewer remarks form
  const [remarks, setRemarks] = useState("");
  const [submittingRemarks, setSubmittingRemarks] = useState(false);

  // Data operator finalize
  const [finalizing, setFinalizing] = useState(false);

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
      setRemarks(billData.reviewerRemarks || "");

      // Load board entries for this bill's pleader + date range
      const entriesSnap = await getDocs(
        query(
          collection(db, "boardEntries"),
          where("pleaderId", "==", billData.pleaderId),
          where("dateISO", ">=", billData.dateFromISO),
          where("dateISO", "<=", billData.dateToISO),
          orderBy("dateISO", "asc")
        )
      );
      setEntries(entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardEntry));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load bill: ${msg}`);
      console.error("[bill-detail] loadBill", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitRemarks() {
    if (!bill || !user || !role) return;
    setSubmittingRemarks(true);
    setError(null);
    try {
      await updateDoc(doc(db, "bills", billId), {
        reviewerRemarks: remarks,
        reviewerRemarksBy: user.displayName || user.email || "",
        reviewerRemarksAt: Timestamp.now(),
        status: "under_revision",
      });
      logAudit("bill_remarks_added", "bill", billId,
        `Remarks submitted for bill by ${user.displayName || user.email}: "${remarks.slice(0, 80)}"`,
        { uid: user.uid, displayName: user.displayName || user.email || "", role },
        { billId, pleaderName: bill.pleaderName }
      );
      await loadBill();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to submit remarks: ${msg}`);
      console.error("[bill-detail] handleSubmitRemarks", err);
    } finally {
      setSubmittingRemarks(false);
    }
  }

  async function handleFinalize() {
    if (!bill || !user || !role) return;
    if (!confirm("Mark this bill as Final? This cannot be undone.")) return;
    setFinalizing(true);
    setError(null);
    try {
      await updateDoc(doc(db, "bills", billId), {
        status: "final",
        finalizedAt: Timestamp.now(),
        finalizedBy: user.uid,
        finalizedByName: user.displayName || user.email || "",
      });
      logAudit("bill_finalized", "bill", billId,
        `Bill finalized for ${bill.pleaderName} (${bill.dateFrom} to ${bill.dateTo})`,
        { uid: user.uid, displayName: user.displayName || user.email || "", role },
        { billId, pleaderName: bill.pleaderName, totalFees: bill.totalFees }
      );
      await loadBill();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to finalize bill: ${msg}`);
      console.error("[bill-detail] handleFinalize", err);
    } finally {
      setFinalizing(false);
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
                <div><dt className="text-gray-500">Period</dt><dd>{bill.dateFrom} → {bill.dateTo}</dd></div>
                <div><dt className="text-gray-500">Generated By</dt><dd>{bill.createdByName}</dd></div>
                <div><dt className="text-gray-500">Total Entries</dt><dd>{entries.length}</dd></div>
                <div><dt className="text-gray-500">Total Fees</dt><dd className="font-bold text-blue-700">₹{bill.totalFees.toLocaleString()}</dd></div>
                {bill.finalizedByName && (
                  <div><dt className="text-gray-500">Finalized By</dt><dd className="text-green-700">{bill.finalizedByName}</dd></div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Reviewer Remarks */}
          {bill.reviewerRemarks && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader><CardTitle className="text-orange-800 text-base">Reviewer Remarks</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-orange-900 whitespace-pre-wrap">{bill.reviewerRemarks}</p>
                <p className="mt-2 text-xs text-orange-600">
                  — {bill.reviewerRemarksBy}, {bill.reviewerRemarksAt ? formatTimestampDateTime(bill.reviewerRemarksAt) : ""}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Bill Viewer: Add/Edit Remarks */}
          {billViewer && bill.status !== "final" && (
            <Card>
              <CardHeader><CardTitle className="text-base">
                {bill.reviewerRemarks ? "Update Remarks" : "Add Remarks"}
              </CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Add your remarks here if you see any discrepancy..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <Button onClick={handleSubmitRemarks} disabled={submittingRemarks || !remarks.trim()}>
                  {submittingRemarks ? "Submitting..." : "Submit Remarks"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Data Operator / Admin: Finalize */}
          {(dataOp || admin) && bill.status !== "final" && (
            <div className="flex items-center gap-4">
              <Button onClick={handleFinalize} disabled={finalizing} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4" />
                {finalizing ? "Finalizing..." : "Mark as Final Bill"}
              </Button>
              <p className="text-sm text-gray-500">
                {bill.status === "under_revision"
                  ? "Reviewer has added remarks. Review entries and finalize."
                  : "Once all entries are verified, mark this bill as final."}
              </p>
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
                      <th className="px-4 py-3 font-medium">Remarks</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Fees (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">{e.date}</td>
                        <td className="px-4 py-3 font-mono">{e.caseType} {e.caseNo}/{e.year}</td>
                        <td className="px-4 py-3">{e.partyName}</td>
                        <td className="px-4 py-3 text-gray-500">{e.remarks || "—"}</td>
                        <td className="px-4 py-3">{e.status ? RESULT_STATUS_LABELS[e.status] : "—"}</td>
                        <td className="px-4 py-3 font-semibold">₹{(e.fees || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold bg-gray-50">
                      <td className="px-4 py-3" colSpan={6}>Total</td>
                      <td className="px-4 py-3 text-blue-700">₹{liveTotal.toLocaleString()}</td>
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
