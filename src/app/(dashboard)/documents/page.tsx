"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection, addDoc, getDocs, query, orderBy, Timestamp, where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Upload, Download, FileText } from "lucide-react";
import type { Case, Document as DocType } from "@/types";

export default function DocumentsPage() {
  const { user, role } = useAuth();
  const admin = isAdmin(role);
  const fileRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCase, setSelectedCase] = useState("");

  useEffect(() => {
    async function load() {
      const [docsSnap, casesSnap] = await Promise.all([
        getDocs(query(collection(db, "documents"), orderBy("uploadedAt", "desc"))),
        getDocs(query(collection(db, "cases"), orderBy("caseNumber"))),
      ]);
      setDocuments(docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DocType));
      setCases(casesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Case));
    }
    load();
  }, []);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !fileRef.current?.files?.[0]) return;
    setUploading(true);

    const file = fileRef.current.files[0];
    const caseData = cases.find((c) => c.id === selectedCase);
    const storagePath = `documents/${selectedCase}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);

    const docRef = await addDoc(collection(db, "documents"), {
      caseId: selectedCase,
      caseNumber: caseData?.caseNumber || "",
      fileName: file.name,
      storagePath,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedBy: user.uid,
      uploadedAt: Timestamp.now(),
    });

    setDocuments((prev) => [
      { id: docRef.id, caseId: selectedCase, caseNumber: caseData?.caseNumber || "", fileName: file.name, storagePath, contentType: file.type, sizeBytes: file.size, uploadedBy: user.uid, uploadedAt: Timestamp.now() } as DocType,
      ...prev,
    ]);
    setUploading(false);
    e.currentTarget.reset();
  }

  async function handleDownload(doc: DocType) {
    const url = await getDownloadURL(ref(storage, doc.storagePath));
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Documents</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px]">
              <Label>Case</Label>
              <select
                required
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select case...</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.caseNumber} — {c.title}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[250px]">
              <Label>PDF File</Label>
              <Input ref={fileRef} type="file" accept=".pdf" required />
            </div>
            <Button type="submit" disabled={uploading}>
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">File</th>
                  <th className="pb-2 font-medium">Case #</th>
                  <th className="pb-2 font-medium">Size</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="flex items-center gap-2 py-2">
                      <FileText className="h-4 w-4 text-red-500" />
                      {d.fileName}
                    </td>
                    <td className="py-2 font-mono">{d.caseNumber}</td>
                    <td className="py-2">{(d.sizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-2">
                      <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>
                        <Download className="h-3 w-3" /> Download
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
