"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin, isBillViewer } from "@/lib/auth/roles";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3, Download } from "lucide-react";
import type { BoardEntry, Designation } from "@/types";
import { DESIGNATION_LABELS, DESIGNATIONS, RESULT_STATUS_LABELS } from "@/types";

export default function BillingPage() {
  const { role, pleaderId, loading: authLoading } = useAuth();
  const router = useRouter();
  const billViewer = isBillViewer(role);
  const allowed = billViewer || isAdmin(role);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [designation, setDesignation] = useState<Designation | "">("");
  const [rows, setRows] = useState<BoardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!allowed) router.push("/dashboard");
  }, [allowed, authLoading, router]);

  async function generateReport() {
    // Bill viewers only ever see board entries for their own linked pleader —
    // never anyone else's bills or data. With no pleader linked, there's
    // nothing they're allowed to see.
    if (billViewer && !pleaderId) {
      setRows([]);
      setSearched(true);
      setError("Your login isn't linked to a Pleader yet. Contact your Admin.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const ref = collection(db, "boardEntries");
      const constraints = [];
      if (billViewer) constraints.push(where("pleaderId", "==", pleaderId));
      if (dateFrom) constraints.push(where("dateISO", ">=", dateFrom));
      if (dateTo) constraints.push(where("dateISO", "<=", dateTo));

      const snap = await getDocs(query(ref, ...constraints));
      let entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardEntry);
      if (designation) entries = entries.filter((e) => e.designation === designation);
      entries.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

      setRows(entries);
      setSearched(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load report: ${msg}`);
      console.error("[billing] generateReport", err);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const header = "Date,Case Type,Case No.,Year,Party Name,Status,Fees,Pleader,Designation\n";
    const body = rows
      .map((r) =>
        [
          r.date,
          r.caseType,
          r.caseNo,
          r.year,
          `"${r.petitioner.replace(/"/g, '""')}"`,
          RESULT_STATUS_LABELS[r.status],
          r.fees,
          r.pleaderName,
          r.designation ? DESIGNATION_LABELS[r.designation] : "",
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billex-billing-${formatDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalFees = rows.reduce((sum, r) => sum + (r.fees || 0), 0);

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label>Designation</Label>
              <Select value={designation} onChange={(e) => setDesignation(e.target.value as Designation | "")}>
                <option value="">All</option>
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {DESIGNATION_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={generateReport} disabled={loading}>
              <BarChart3 className="h-4 w-4" />
              {loading ? "Loading..." : "Generate"}
            </Button>
            {rows.length > 0 && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {searched && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {rows.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No entries for the selected filters.</p>
            ) : (
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Sr. No.</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Case</th>
                    <th className="px-4 py-3 font-medium">Petitioner V/S Respondent</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Pleader</th>
                    <th className="px-4 py-3 font-medium">Designation</th>
                    <th className="px-4 py-3 font-medium">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3">{r.date}</td>
                      <td className="px-4 py-3 font-mono">
                        {r.caseType} {r.caseNo}/{r.year}
                      </td>
                      <td className="px-4 py-3">{r.petitioner} V/S {r.respondent}</td>
                      <td className="px-4 py-3">{RESULT_STATUS_LABELS[r.status]}</td>
                      <td className="px-4 py-3">{r.pleaderName}</td>
                      <td className="px-4 py-3">{r.designation ? DESIGNATION_LABELS[r.designation] : "—"}</td>
                      <td className="px-4 py-3">₹{r.fees.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-bold">
                    <td className="px-4 py-3" colSpan={7}>
                      Total
                    </td>
                    <td className="px-4 py-3">₹{totalFees.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
