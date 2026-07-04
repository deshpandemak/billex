"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, Timestamp, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Designation, Pleader } from "@/types";
import { DESIGNATION_LABELS, DESIGNATIONS } from "@/types";

export default function AdminPleadersPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const admin = isAdmin(role);
  const [pleaders, setPleaders] = useState<Pleader[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!admin) { router.push("/dashboard"); return; }
    loadPleaders();
  }, [admin, authLoading, router]);

  async function loadPleaders() {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(query(collection(db, "pleaders"), orderBy("name")));
      setPleaders(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pleader));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load pleaders: ${msg}`);
      console.error("[pleaders] loadPleaders", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSaving(true);
    const formEl = e.currentTarget; // capture before first await
    try {
      const form = new FormData(formEl);
      const now = Timestamp.now();
      await addDoc(collection(db, "pleaders"), {
        name: form.get("name"),
        designation: form.get("designation") as Designation,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
      });
      formEl.reset();
      await loadPleaders();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to add pleader: ${msg}`);
      console.error("[pleaders] handleCreate", err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Pleader) {
    setError(null);
    try {
      await updateDoc(doc(db, "pleaders", p.id), { active: !p.active, updatedAt: Timestamp.now() });
      setPleaders((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to update pleader: ${msg}`);
      console.error("[pleaders] toggleActive", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this pleader?")) return;
    setError(null);
    try {
      await deleteDoc(doc(db, "pleaders", id));
      setPleaders((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to delete pleader: ${msg}`);
      console.error("[pleaders] handleDelete", err);
    }
  }

  if (!admin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Government Pleaders</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Pleader</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
            <div>
              <Label>Name</Label>
              <Input name="name" required />
            </div>
            <div>
              <Label>Designation</Label>
              <Select name="designation" defaultValue="GP" required>
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {DESIGNATION_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add Pleader"}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Pleaders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : pleaders.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No pleaders added yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Designation</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pleaders.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-6 py-3">{p.name}</td>
                    <td className="px-6 py-3">{DESIGNATION_LABELS[p.designation]}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleActive(p)}>
                        {p.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)}>
                        Delete
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
