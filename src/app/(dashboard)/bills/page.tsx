"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query, Timestamp, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { formatTimestampDate, isoToDisplay } from "@/lib/date";
import { useAuth } from "@/lib/auth/context";
import { isAdmin, isBillViewer, isDataOperator } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, Plus } from "lucide-react";
import type { Bill, BillStatus, BoardEntry, Pleader } from "@/types";
import { BILL_STATUS_LABELS, BILL_STATUSES } from "@/types";

const STATUS_COLORS: Record<BillStatus, string> = {
  open_for_review: "bg-yellow-100 text-yellow-800",
  under_revision: "bg-orange-100 text-orange-800",
  final: "bg-green-100 text-green-700",
};

export default function BillsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const admin = isAdmin(role);
  const dataOp = isDataOperator(role);
  const billViewer = isBillViewer(role);
  const canAccess = admin || dataOp || billViewer;

  const [bills, setBills] = useState<Bill[]>([]);
  const [pleaders, setPleaders] = useState<Pleader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate form
  const [showGenerate, setShowGenerate] = useState(false);
  const [genDateFrom, setGenDateFrom] = useState("");
  const [genDateTo, setGenDateTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<BillStatus | "">("");
  const [filterPleaderId, setFilterPleaderId] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) { router.push("/dashboard"); return; }
    loadData();
  }, [canAccess, authLoading, router]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const pleadersSnap = await getDocs(query(collection(db, "pleaders"), orderBy("name")));
      setPleaders(pleadersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pleader));

      // Bill viewers may only read their own pleader's bills per Firestore rules.
      // Issue the scoped query upfront to avoid PERMISSION_DENIED on the broad collection read.
      let billsSnap;
      if (billViewer && !admin && !dataOp) {
        const userSnap = await getDoc(doc(db, "users", user!.uid));
        const myPleaderId = userSnap.data()?.pleaderId as string | undefined;
        if (!myPleaderId) {
          setBills([]);
          return;
        }
        billsSnap = await getDocs(
          query(collection(db, "bills"), where("pleaderId", "==", myPleaderId), orderBy("createdAt", "desc"))
        );
      } else {
        billsSnap = await getDocs(query(collection(db, "bills"), orderBy("createdAt", "desc")));
      }
      setBills(billsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bill));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load bills: ${msg}`);
      console.error("[bills] loadData", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!user || !role) return;
    if (!genDateFrom || !genDateTo) {
      setGenError("Please select both dates.");
      return;
    }
    if (genDateFrom > genDateTo) {
      setGenError("'From' date must be before 'To' date.");
      return;
    }
    setGenError(null);
    setGenResult(null);
    setGenerating(true);
    try {
      // Fetch ALL board entries for the date range
      const snap = await getDocs(
        query(
          collection(db, "boardEntries"),
          where("dateISO", ">=", genDateFrom),
          where("dateISO", "<=", genDateTo),
          orderBy("dateISO", "asc")
        )
      );
      const allEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardEntry);

      // Group by pleaderId — one bill per pleader
      const grouped = new Map<string, BoardEntry[]>();
      for (const entry of allEntries) {
        if (!entry.pleaderId) continue;
        if (!grouped.has(entry.pleaderId)) grouped.set(entry.pleaderId, []);
        grouped.get(entry.pleaderId)!.push(entry);
      }

      if (grouped.size === 0) {
        setGenError("No board entries with an assigned pleader found for this date range.");
        return;
      }

      const actor = { uid: user.uid, displayName: user.displayName || user.email || "", role };
      const now = Timestamp.now();
      const createdNames: string[] = [];

      await Promise.all(
        Array.from(grouped.entries()).map(async ([pid, entries]) => {
          const pleader = pleaders.find((p) => p.id === pid);
          if (!pleader) return; // unknown pleader ID — skip
          const totalFees = entries.reduce((s, e) => s + (e.fees || 0), 0);

          const billRef = await addDoc(collection(db, "bills"), {
            dateFrom: isoToDisplay(genDateFrom),
            dateTo: isoToDisplay(genDateTo),
            dateFromISO: genDateFrom,
            dateToISO: genDateTo,
            pleaderId: pid,           // internal Firestore ID
            pleaderName: pleader.name, // display name from pleader record
            designation: pleader.designation,
            status: "open_for_review",
            totalFees,
            entryCount: entries.length,
            createdAt: now,
            createdBy: user.uid,
            createdByName: user.displayName || user.email || "",
            submittedAt: now,
            reviewerRemarks: "",
            reviewerRemarksBy: "",
            reviewerRemarksAt: null,
            finalizedAt: null,
            finalizedBy: null,
            finalizedByName: null,
          });

          logAudit(
            "bill_generated", "bill", billRef.id,
            `Generated bill for ${pleader.name} (${isoToDisplay(genDateFrom)} to ${isoToDisplay(genDateTo)}), ${entries.length} entries, ₹${totalFees.toLocaleString()}`,
            actor,
            { pleaderId: pid, pleaderName: pleader.name, dateFrom: isoToDisplay(genDateFrom), dateTo: isoToDisplay(genDateTo), entryCount: entries.length, totalFees }
          );
          createdNames.push(pleader.name);
        })
      );

      setGenResult(`Generated ${createdNames.length} bill(s) for: ${createdNames.sort().join(", ")}`);
      setGenDateFrom("");
      setGenDateTo("");
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenError(`Failed to generate bills: ${msg}`);
      console.error("[bills] handleGenerate", err);
    } finally {
      setGenerating(false);
    }
  }

  const filteredBills = useMemo(() => bills.filter((b) => {
    if (filterStatus && b.status !== filterStatus) return false;
    if (filterPleaderId && b.pleaderId !== filterPleaderId) return false;
    return true;
  }), [bills, filterStatus, filterPleaderId]);

  if (!canAccess) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bills</h1>
        {(dataOp || admin) && !showGenerate && (
          <Button onClick={() => { setShowGenerate(true); setGenResult(null); setGenError(null); }}>
            <Plus className="h-4 w-4" /> Generate Bills
          </Button>
        )}
      </div>

      {/* Generate Bills Panel */}
      {showGenerate && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">Generate Bills for Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-blue-700">
              One bill will be generated per pleader based on their board entries in the selected date range.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>From Date</Label>
                <Input type="date" value={genDateFrom} onChange={(e) => setGenDateFrom(e.target.value)} />
              </div>
              <div>
                <Label>To Date</Label>
                <Input type="date" value={genDateTo} onChange={(e) => setGenDateTo(e.target.value)} />
              </div>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating..." : "Generate & Submit for Review"}
              </Button>
              <Button variant="outline" onClick={() => { setShowGenerate(false); setGenError(null); setGenResult(null); }}>
                Cancel
              </Button>
            </div>
            {genError && <p className="text-sm text-red-600">{genError}</p>}
            {genResult && (
              <p className="text-sm font-medium text-green-700">{genResult}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label>Status</Label>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as BillStatus | "")} className="w-44">
            <option value="">All statuses</option>
            {BILL_STATUSES.map((s) => (
              <option key={s} value={s}>{BILL_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        {(admin || dataOp) && (
          <div>
            <Label>Pleader</Label>
            <Select value={filterPleaderId} onChange={(e) => setFilterPleaderId(e.target.value)} className="w-48">
              <option value="">All pleaders</option>
              {pleaders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Bills Table */}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : filteredBills.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No bills found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Pleader</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Entries</th>
                  <th className="px-4 py-3 font-medium">Total Fees</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Generated By</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.pleaderName}</td>
                    <td className="px-4 py-3 text-gray-600">{b.dateFrom} → {b.dateTo}</td>
                    <td className="px-4 py-3">{b.entryCount}</td>
                    <td className="px-4 py-3 font-semibold">₹{b.totalFees.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                        {BILL_STATUS_LABELS[b.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{b.createdByName}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatTimestampDate(b.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/bills/${b.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                        <FileText className="inline h-3 w-3 mr-1" />View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
