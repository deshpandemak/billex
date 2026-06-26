"use client";

import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3, Download } from "lucide-react";
import type { Entry } from "@/types";

interface ReportRow {
  label: string;
  entries: number;
  hours: number;
  amount: number;
}

export default function ReportsPage() {
  const { user, role } = useAuth();
  const admin = isAdmin(role);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState<"case" | "month">("case");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function generateReport() {
    if (!user) return;
    setLoading(true);

    const ref = collection(db, "entries");
    const constraints = [];
    if (dateFrom) constraints.push(where("date", ">=", dateFrom));
    if (dateTo) constraints.push(where("date", "<=", dateTo));
    if (!admin) constraints.push(where("enteredBy", "==", user.uid));

    const snap = await getDocs(query(ref, ...constraints));
    const entries = snap.docs.map((d) => d.data() as Entry);

    const grouped = new Map<string, ReportRow>();
    for (const e of entries) {
      const key = groupBy === "case" ? e.caseNumber : e.date.substring(0, 7);
      const existing = grouped.get(key) || { label: key, entries: 0, hours: 0, amount: 0 };
      existing.entries++;
      existing.hours += e.hours;
      existing.amount += e.amount;
      grouped.set(key, existing);
    }

    setRows(Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label)));
    setLoading(false);
  }

  function exportCSV() {
    const header = "Label,Entries,Hours,Amount\n";
    const body = rows.map((r) => `${r.label},${r.entries},${r.hours},${r.amount}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billex-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = rows.reduce(
    (acc, r) => ({ entries: acc.entries + r.entries, hours: acc.hours + r.hours, amount: acc.amount + r.amount }),
    { entries: 0, hours: 0, amount: 0 }
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
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
              <Label>Group By</Label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as "case" | "month")}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="case">Case</option>
                <option value="month">Month</option>
              </select>
            </div>
            <Button onClick={generateReport} disabled={loading}>
              <BarChart3 className="h-4 w-4" />
              {loading ? "Generating..." : "Generate"}
            </Button>
            {rows.length > 0 && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">{groupBy === "case" ? "Case #" : "Month"}</th>
                  <th className="px-6 py-3 font-medium">Entries</th>
                  <th className="px-6 py-3 font-medium">Hours</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b last:border-0">
                    <td className="px-6 py-3 font-mono">{r.label}</td>
                    <td className="px-6 py-3">{r.entries}</td>
                    <td className="px-6 py-3">{r.hours}</td>
                    <td className="px-6 py-3">₹{r.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="px-6 py-3">Total</td>
                  <td className="px-6 py-3">{totals.entries}</td>
                  <td className="px-6 py-3">{totals.hours}</td>
                  <td className="px-6 py-3">₹{totals.amount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
