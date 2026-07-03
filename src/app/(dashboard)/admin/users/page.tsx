"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AppUser, UserRole } from "@/types";
import { ROLE_LABELS } from "@/types";

export default function AdminUsersPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const admin = isAdmin(role);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) {
      router.push("/dashboard");
      return;
    }
    loadUsers();
  }, [admin, router]);

  async function loadUsers() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "users"), orderBy("email")));
    setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser));
    setLoading(false);
  }

  async function authedFetch(input: string, init: RequestInit) {
    const token = await user?.getIdToken();
    return fetch(input, {
      ...init,
      headers: {
        ...init.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const body = {
      email: form.get("email"),
      displayName: form.get("displayName"),
      password: form.get("password"),
      role: form.get("role"),
    };
    const res = await authedFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create login.");
    } else {
      e.currentTarget.reset();
      await loadUsers();
    }
    setCreating(false);
  }

  async function updateRole(uid: string, newRole: UserRole) {
    await authedFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ uid, role: newRole }),
    });
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)));
  }

  async function toggleActive(uid: string, active: boolean) {
    await authedFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ uid, active: !active }),
    });
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, active: !active } : u)));
  }

  async function handleDelete(uid: string) {
    if (!confirm("Delete this login? This cannot be undone.")) return;
    await authedFetch("/api/admin/users", {
      method: "DELETE",
      body: JSON.stringify({ uid }),
    });
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
  }

  if (!admin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Logins & Roles</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
            <div>
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div>
              <Label>Name</Label>
              <Input name="displayName" required />
            </div>
            <div>
              <Label>Temporary Password</Label>
              <Input name="password" type="password" minLength={6} required />
            </div>
            <div>
              <Label>Role</Label>
              <Select name="role" defaultValue="data_operator" required>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Login"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Logins</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid} className="border-b last:border-0">
                    <td className="px-6 py-3">{u.displayName}</td>
                    <td className="px-6 py-3">{u.email}</td>
                    <td className="px-6 py-3">
                      <Select
                        value={u.role}
                        onChange={(e) => updateRole(u.uid, e.target.value as UserRole)}
                        className="h-8 w-auto"
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleActive(u.uid, u.active)}>
                        {u.active ? "Disable" : "Enable"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(u.uid)}>
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
