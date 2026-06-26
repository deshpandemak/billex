"use client";

import { useState, useRef, useEffect } from "react";
import {
  collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Upload, FileText, Trash2, Search } from "lucide-react";
import type { BoardEntry } from "@/types";
import type { ParsedBoardEntry } from "@/lib/parser/board-parser";

export default function BoardPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState<{
    entries: (ParsedBoardEntry & { sourceFile: string })[];
    totalParsed: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<BoardEntry[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ resultStatus: string; fees: number }>({
    resultStatus: "",
    fees: 0,
  });

  useEffect(() => {
    loadEntries();
  }, [dateFilter]);

  async function loadEntries() {
    const ref = collection(db, "boardEntries");
    try {
      const q = dateFilter
        ? query(ref, where("boardDate", "==", dateFilter), orderBy("srNo", "asc"))
        : query(ref, orderBy("boardDate", "desc"));
      const snap = await getDocs(q);
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardEntry));
    } catch {
      const snap = await getDocs(query(ref, orderBy("boardDate", "desc")));
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardEntry));
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fileRef.current?.files?.length) return;
    setUploading(true);
    setParseResult(null);

    const formData = new FormData();
    for (const file of Array.from(fileRef.current.files)) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/board/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setParseResult(data);
      } else {
        alert(data.error || "Failed to parse PDFs");
      }
    } catch (err) {
      alert("Upload failed");
    }
    setUploading(false);
  }

  async function handleSaveAll() {
    if (!parseResult || !user) return;
    setSaving(true);

    const batch = parseResult.entries.map((entry) =>
      addDoc(collection(db, "boardEntries"), {
        boardDate: entry.boardDate,
        boardType: entry.boardType,
        srNo: entry.srNo,
        caseType: entry.caseType,
        caseNo: entry.caseNo,
        caseYear: entry.caseYear,
        fullCaseNumber: entry.fullCaseNumber,
        partyName: entry.partyName,
        remarks: entry.remarks,
        resultStatus: "",
        fees: 0,
        gpAdvocate: entry.gpAdvocate,
        courtName: entry.courtName,
        benchId: entry.benchId,
        linkedCases: entry.linkedCases,
        sourceFile: entry.sourceFile,
        uploadedBy: user.uid,
        uploadedAt: Timestamp.now(),
      })
    );

    await Promise.all(batch);
    setParseResult(null);
    if (fileRef.current) fileRef.current.value = "";
    await loadEntries();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await deleteDoc(doc(db, "boardEntries", id));
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleSaveEdit(id: string) {
    await updateDoc(doc(db, "boardEntries", id), {
      resultStatus: editValues.resultStatus,
      fees: editValues.fees,
    });
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, resultStatus: editValues.resultStatus, fees: editValues.fees } : e
      )
    );
    setEditingId(null);
  }

  const filteredEntries = entries.filter((e) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      e.fullCaseNumber.toLowerCase().includes(s) ||
      e.partyName.toLowerCase().includes(s) ||
      e.gpAdvocate.toLowerCase().includes(s) ||
      e.caseType.toLowerCase().includes(s)
    );
  });

  const uniqueDates = [...new Set(entries.map((e) => e.boardDate))].sort().reverse();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Daily Board</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload Board PDFs</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-4">
            <div className="min-w-[300px]">
              <Label>PDF Files (multiple allowed)</Label>
              <Input ref={fileRef} type="file" accept=".pdf" multiple required />
            </div>
            <Button type="submit" disabled={uploading}>
              <Upload className="h-4 w-4" />
              {uploading ? "Parsing..." : "Parse PDFs"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle>
              Parsed {parseResult.totalParsed} entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-3">
              <Button onClick={handleSaveAll} disabled={saving}>
                {saving ? "Saving..." : `Save All ${parseResult.totalParsed} Entries`}
              </Button>
              <Button variant="outline" onClick={() => setParseResult(null)}>
                Discard
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Case Type</th>
                    <th className="px-3 py-2">Case No.</th>
                    <th className="px-3 py-2">Year</th>
                    <th className="px-3 py-2">Party Name</th>
                    <th className="px-3 py-2">Remarks</th>
                    <th className="px-3 py-2">GP / ADDL GP / AGP</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.entries.slice(0, 50).map((e, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2">{e.srNo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.boardDate}</td>
                      <td className="px-3 py-2 font-mono">{e.caseType}</td>
                      <td className="px-3 py-2 font-mono">{e.caseNo}</td>
                      <td className="px-3 py-2">{e.caseYear}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{e.partyName}</td>
                      <td className="px-3 py-2 max-w-[150px] truncate">{e.remarks}</td>
                      <td className="px-3 py-2 max-w-[250px] truncate">{e.gpAdvocate}</td>
                      <td className="px-3 py-2 text-gray-400 truncate max-w-[120px]">{e.sourceFile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.totalParsed > 50 && (
                <p className="mt-2 text-sm text-gray-500">
                  Showing first 50 of {parseResult.totalParsed} entries. All will be saved.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Board Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-4">
            <div>
              <Label>Filter by Date</Label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="flex h-10 w-full min-w-[180px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Dates</option>
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Case number, party, advocate..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Case Type</th>
                  <th className="px-3 py-2">Case No.</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Party Name</th>
                  <th className="px-3 py-2">Remarks</th>
                  <th className="px-3 py-2">Result / Status</th>
                  <th className="px-3 py-2">Fees (₹)</th>
                  <th className="px-3 py-2">GP / ADDL GP / AGP</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                      No entries found. Upload board PDFs to get started.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2">{e.srNo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.boardDate}</td>
                      <td className="px-3 py-2 font-mono">{e.caseType}</td>
                      <td className="px-3 py-2 font-mono">{e.caseNo}</td>
                      <td className="px-3 py-2">{e.caseYear}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={e.partyName}>
                        {e.partyName}
                      </td>
                      <td className="px-3 py-2 max-w-[130px] truncate" title={e.remarks}>
                        {e.remarks}
                      </td>
                      <td className="px-3 py-2">
                        {editingId === e.id ? (
                          <Input
                            value={editValues.resultStatus}
                            onChange={(ev) =>
                              setEditValues((v) => ({ ...v, resultStatus: ev.target.value }))
                            }
                            className="h-7 text-xs w-24"
                          />
                        ) : (
                          e.resultStatus || "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editingId === e.id ? (
                          <Input
                            type="number"
                            value={editValues.fees}
                            onChange={(ev) =>
                              setEditValues((v) => ({ ...v, fees: parseFloat(ev.target.value) || 0 }))
                            }
                            className="h-7 text-xs w-20"
                          />
                        ) : e.fees ? (
                          `₹${e.fees.toLocaleString()}`
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={e.gpAdvocate}>
                        {e.gpAdvocate}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {editingId === e.id ? (
                            <>
                              <Button size="sm" onClick={() => handleSaveEdit(e.id)} className="h-6 text-xs px-2">
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-6 text-xs px-2">
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2"
                                onClick={() => {
                                  setEditingId(e.id);
                                  setEditValues({ resultStatus: e.resultStatus, fees: e.fees });
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 text-xs px-2"
                                onClick={() => handleDelete(e.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
