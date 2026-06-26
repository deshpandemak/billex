"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Case, Entry, Document as DocType } from "@/types";

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { role } = useAuth();
  const admin = isAdmin(role);
  const router = useRouter();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "cases", caseId));
      if (!snap.exists()) return;
      setCaseData({ id: snap.id, ...snap.data() } as Case);

      const [entriesSnap, docsSnap] = await Promise.all([
        getDocs(query(collection(db, "entries"), where("caseId", "==", caseId), orderBy("date", "desc"))),
        getDocs(query(collection(db, "documents"), where("caseId", "==", caseId), orderBy("uploadedAt", "desc"))),
      ]);
      setEntries(entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry));
      setDocuments(docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DocType));
    }
    load();
  }, [caseId]);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const updates = {
      title: form.get("title") as string,
      clientName: form.get("clientName") as string,
      description: form.get("description") as string,
      status: form.get("status") as Case["status"],
      updatedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, "cases", caseId), updates);
    setCaseData((prev) => (prev ? { ...prev, ...updates } : prev));
    setEditing(false);
    setSaving(false);
  }

  if (!caseData) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Case: {caseData.caseNumber}</h1>
        <div className="flex gap-2">
          {admin && (
            <Button variant="outline" onClick={() => setEditing(!editing)}>
              {editing ? "Cancel Edit" : "Edit"}
            </Button>
          )}
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case Details</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input name="title" defaultValue={caseData.title} required />
              </div>
              <div>
                <Label>Client</Label>
                <Input name="clientName" defaultValue={caseData.clientName} required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea name="description" defaultValue={caseData.description} />
              </div>
              <div>
                <Label>Status</Label>
                <select name="status" defaultValue={caseData.status} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </form>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Title</dt><dd className="font-medium">{caseData.title}</dd></div>
              <div><dt className="text-gray-500">Client</dt><dd className="font-medium">{caseData.clientName}</dd></div>
              <div><dt className="text-gray-500">Status</dt><dd className="font-medium capitalize">{caseData.status}</dd></div>
              <div className="col-span-2"><dt className="text-gray-500">Description</dt><dd>{caseData.description || "—"}</dd></div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400">No entries for this case.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Hours</th>
                  <th className="pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2">{e.date}</td>
                    <td className="py-2">{e.description}</td>
                    <td className="py-2">{e.hours}</td>
                    <td className="py-2">₹{e.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded.</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{d.fileName}</span>
                  <span className="text-gray-400">({(d.sizeBytes / 1024).toFixed(1)} KB)</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
