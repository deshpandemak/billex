"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { isDataOperator } from "@/lib/auth/roles";
import { computeFees } from "@/lib/billing/fees";
import { extractLinesFromPdf, parseBoardRowsFromLines } from "@/lib/board/pdfParse";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Upload } from "lucide-react";
import type { BoardEntry, Designation, FeeConfig, Pleader, ResultStatus } from "@/types";
import { DESIGNATION_LABELS, RESULT_STATUSES, RESULT_STATUS_LABELS } from "@/types";

interface DraftRow {
  id: string;
  persisted: boolean;
  date: string;
  caseType: string;
  caseNo: string;
  year: string;
  partyName: string;
  remarks: string;
  status: ResultStatus | "";
  pleaderId: string;
  fees: number;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function BoardPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const dataOperator = isDataOperator(role);

  const [selectedDate, setSelectedDate] = useState(today());
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [pleaders, setPleaders] = useState<Pleader[]>([]);
  const [feeConfig, setFeeConfig] = useState<Partial<Record<Designation, FeeConfig>>>({});
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dataOperator) {
      router.push("/dashboard");
    }
  }, [dataOperator, router]);

  useEffect(() => {
    async function loadRefs() {
      const [pleadersSnap, feesSnap] = await Promise.all([
        getDocs(query(collection(db, "pleaders"), orderBy("name"))),
        getDocs(collection(db, "feeConfig")),
      ]);
      setPleaders(pleadersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pleader));
      const feeMap: Partial<Record<Designation, FeeConfig>> = {};
      feesSnap.docs.forEach((d) => {
        feeMap[d.id as Designation] = d.data() as FeeConfig;
      });
      setFeeConfig(feeMap);
    }
    if (dataOperator) loadRefs();
  }, [dataOperator]);

  useEffect(() => {
    if (!dataOperator) return;
    async function loadRows() {
      setLoading(true);
      const snap = await getDocs(query(collection(db, "boardEntries"), where("date", "==", selectedDate)));
      setRows(
        snap.docs.map((d) => {
          const data = d.data() as BoardEntry;
          return {
            id: d.id,
            persisted: true,
            date: data.date,
            caseType: data.caseType,
            caseNo: data.caseNo,
            year: data.year,
            partyName: data.partyName,
            remarks: data.remarks,
            status: data.status,
            pleaderId: data.pleaderId,
            fees: data.fees,
          };
        })
      );
      setLoading(false);
    }
    loadRows();
  }, [selectedDate, dataOperator]);

  const activePleaders = useMemo(() => pleaders.filter((p) => p.active), [pleaders]);

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const merged = { ...r, ...patch };
        if ("pleaderId" in patch || "status" in patch) {
          const pleader = pleaders.find((p) => p.id === merged.pleaderId);
          merged.fees = computeFees(pleader?.designation || "", merged.status || "", feeConfig);
        }
        return merged;
      })
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `new-${crypto.randomUUID()}`,
        persisted: false,
        date: selectedDate,
        caseType: "",
        caseNo: "",
        year: "",
        partyName: "",
        remarks: "",
        status: "",
        pleaderId: "",
        fees: 0,
      },
    ]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const lines = await extractLinesFromPdf(file);
      const parsed = parseBoardRowsFromLines(lines);
      setRows((prev) => [
        ...prev,
        ...parsed.map((p) => ({
          id: `new-${crypto.randomUUID()}`,
          persisted: false,
          date: selectedDate,
          caseType: p.caseType,
          caseNo: p.caseNo,
          year: p.year,
          partyName: p.partyName,
          remarks: "",
          status: "" as ResultStatus | "",
          pleaderId: "",
          fees: 0,
        })),
      ]);
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  async function handleDeleteRow(row: DraftRow) {
    if (row.persisted) {
      if (!confirm("Delete this row?")) return;
      await deleteDoc(doc(db, "boardEntries", row.id));
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  async function handleSaveAll() {
    if (!user) return;
    setSaving(true);
    const now = Timestamp.now();
    const updated = await Promise.all(
      rows.map(async (row) => {
        const pleader = pleaders.find((p) => p.id === row.pleaderId);
        const payload = {
          date: row.date,
          caseType: row.caseType,
          caseNo: row.caseNo,
          year: row.year,
          partyName: row.partyName,
          remarks: row.remarks,
          status: row.status,
          pleaderId: row.pleaderId,
          pleaderName: pleader?.name || "",
          designation: pleader?.designation || "",
          fees: row.fees,
          updatedAt: now,
          updatedBy: user.uid,
        };
        if (row.persisted) {
          await updateDoc(doc(db, "boardEntries", row.id), payload);
          return row;
        }
        const ref = await addDoc(collection(db, "boardEntries"), {
          ...payload,
          createdAt: now,
          createdBy: user.uid,
        });
        return { ...row, id: ref.id, persisted: true };
      })
    );
    setRows(updated);
    setSaving(false);
  }

  if (!dataOperator) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Board Data</h1>
        <div className="flex items-end gap-4">
          <div>
            <Label>Board Date</Label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <div>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              id="board-pdf-upload"
              onChange={handleUpload}
              disabled={parsing}
            />
            <label
              htmlFor="board-pdf-upload"
              className={cn(buttonVariants({ variant: "default" }), "cursor-pointer", parsing && "pointer-events-none opacity-50")}
            >
              <Upload className="h-4 w-4" />
              {parsing ? "Parsing..." : "Upload Board PDF"}
            </label>
          </div>
          <Button variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4" /> Add Row
          </Button>
          <Button onClick={handleSaveAll} disabled={saving || rows.length === 0}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Cases for {selectedDate} {loading && "(loading...)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 && !loading ? (
            <p className="p-6 text-sm text-gray-400">
              No rows yet. Upload a board PDF or add a row manually.
            </p>
          ) : (
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Case Type</th>
                  <th className="px-3 py-3 font-medium">Case No.</th>
                  <th className="px-3 py-3 font-medium">Year</th>
                  <th className="px-3 py-3 font-medium">Party Name</th>
                  <th className="px-3 py-3 font-medium">Remarks</th>
                  <th className="px-3 py-3 font-medium">Result / Status</th>
                  <th className="px-3 py-3 font-medium">Fees (₹)</th>
                  <th className="px-3 py-3 font-medium">GP / Addl GP / AGP / B&apos;Pnl</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Input
                        type="date"
                        className="w-36"
                        value={row.date}
                        onChange={(e) => updateRow(row.id, { date: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-24"
                        value={row.caseType}
                        onChange={(e) => updateRow(row.id, { caseType: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-24"
                        value={row.caseNo}
                        onChange={(e) => updateRow(row.id, { caseNo: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-20"
                        value={row.year}
                        onChange={(e) => updateRow(row.id, { year: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-48"
                        value={row.partyName}
                        onChange={(e) => updateRow(row.id, { partyName: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-48"
                        value={row.remarks}
                        onChange={(e) => updateRow(row.id, { remarks: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        className="w-44"
                        value={row.status}
                        onChange={(e) => updateRow(row.id, { status: e.target.value as ResultStatus })}
                      >
                        <option value="">Select...</option>
                        {RESULT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {RESULT_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2 font-medium">₹{row.fees.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Select
                        className="w-56"
                        value={row.pleaderId}
                        onChange={(e) => updateRow(row.id, { pleaderId: e.target.value })}
                      >
                        <option value="">Select...</option>
                        {activePleaders.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({DESIGNATION_LABELS[p.designation]})
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Button variant="outline" size="sm" onClick={() => handleDeleteRow(row)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
