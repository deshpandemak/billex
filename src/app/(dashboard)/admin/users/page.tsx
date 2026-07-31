"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AppUser, Pleader, UserRole } from "@/types";
import { ROLE_LABELS } from "@/types";

export default function AdminUsersPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const admin = isAdmin(role);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [pleaders, setPleaders] = useState<Pleader[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!admin) { router.push("/dashboard"); return; }
    loadAll();
  }, [admin, authLoading, router]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [usersSnap, pleadersSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), orderBy("email"))),
        getDocs(query(collection(db, "pleaders"), orderBy("name"))),
      ]);
      setUsers(usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser));
      setPleaders(pleadersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pleader));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load: ${msg}`);
      console.error("[admin/users] loadAll", err);
    } finally {
      setLoading(false);
    }
  }

  async function authedFetch(input: string, init: RequestInit) {
    const token = await user?.getIdToken();
    return fetch(input, {
      ...init,
      headers: { ...init.headers, "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const body = {
      email: form.get("email"),
      displayName: form.get("displayName"),
      password: form.get("password"),
      role: form.get("role"),
    };
    const res = await authedFetch("/api/admin/users", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create login.");
    } else {
      formEl.reset();
      await loadAll();
    }
    setCreating(false);
  }

  async function updateRole(uid: string, newRole: UserRole) {
    setError(null);
    const res = await authedFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ uid, role: newRole }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update role.");
      return;
    }
    // Clear pleaderId when switching away from bill_viewer
    if (newRole !== "bill_viewer") {
      await updateDoc(doc(db, "users", uid), { pleaderId: null });
    }
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: newRole, pleaderId: newRole !== "bill_viewer" ? null : u.pleaderId } : u)));
  }

  async function linkPleader(uid: string, pleaderId: string) {
    setError(null);
    try {
      await updateDoc(doc(db, "users", uid), { pleaderId: pleaderId || null });
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, pleaderId: pleaderId || null } : u)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to link pleader: ${msg}`);
      console.error("[admin/users] linkPleader", err);
    }
  }

  async function toggleActive(uid: string, active: boolean) {
    setError(null);
    const res = await authedFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ uid, active: !active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update status.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, active: !active } : u)));
  }

  async function handleDelete(uid: string) {
    if (!confirm("Delete this login? This cannot be undone.")) return;
    setError(null);
    const res = await authedFetch("/api/admin/users", { method: "DELETE", body: JSON.stringify({ uid }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete login.");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
  }

  if (!admin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Logins & Roles</h1>

      <Card>
        <CardHeader><CardTitle>Create Login</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
            <div><Label>Email</Label><Input name="email" type="email" required /></div>
            <div><Label>Name</Label><Input name="displayName" required /></div>
            <div><Label>Temporary Password</Label><Input name="password" type="password" minLength={6} required /></div>
            <div>
              <Label>Role</Label>
              <Select name="role" defaultValue="data_operator" required>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create Login"}</Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing Logins</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Linked Pleader</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid} className="border-b last:border-0">
                    <td className="px-4 py-3">{u.displayName}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <Select value={u.role} onChange={(e) => updateRole(u.uid, e.target.value as UserRole)} className="h-8 w-auto">
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "bill_viewer" ? (
                        <Select
                          value={u.pleaderId ?? ""}
                          onChange={(e) => linkPleader(u.uid, e.target.value)}
                          className="h-8 w-48"
                        >
                          <option value="">— None —</option>
                          {pleaders.filter((p) => p.active).map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleActive(u.uid, u.active)}>
                        {u.active ? "Disable" : "Enable"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(u.uid)}>Delete</Button>
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
