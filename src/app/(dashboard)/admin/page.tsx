"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AppUser, Entry } from "@/types";

interface UserWithStats extends AppUser {
  entryCount: number;
  totalHours: number;
  totalAmount: number;
}

export default function AdminPage() {
  const { role } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithStats[]>([]);

  useEffect(() => {
    if (!isAdmin(role)) {
      router.push("/dashboard");
      return;
    }

    async function load() {
      const usersSnap = await getDocs(collection(db, "users"));
      const entriesSnap = await getDocs(collection(db, "entries"));

      const entriesByUser = new Map<string, { count: number; hours: number; amount: number }>();
      entriesSnap.forEach((d) => {
        const data = d.data();
        const uid = data.enteredBy;
        const existing = entriesByUser.get(uid) || { count: 0, hours: 0, amount: 0 };
        existing.count++;
        existing.hours += data.hours || 0;
        existing.amount += data.amount || 0;
        entriesByUser.set(uid, existing);
      });

      const result = usersSnap.docs.map((d) => {
        const userData = { uid: d.id, ...d.data() } as AppUser;
        const stats = entriesByUser.get(d.id) || { count: 0, hours: 0, amount: 0 };
        return {
          ...userData,
          entryCount: stats.count,
          totalHours: stats.hours,
          totalAmount: stats.amount,
        };
      });

      setUsers(result);
    }
    load();
  }, [role, router]);

  async function toggleRole(uid: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    await updateDoc(doc(db, "users", uid), { role: newRole });
    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, role: newRole as "admin" | "user" } : u))
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-b last:border-0">
                  <td className="px-6 py-3">{u.displayName}</td>
                  <td className="px-6 py-3">{u.email}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <Button variant="outline" size="sm" onClick={() => toggleRole(u.uid, u.role)}>
                      Make {u.role === "admin" ? "User" : "Admin"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productivity Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Entries</th>
                <th className="px-6 py-3 font-medium">Hours</th>
                <th className="px-6 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-b last:border-0">
                  <td className="px-6 py-3">{u.displayName || u.email}</td>
                  <td className="px-6 py-3">{u.entryCount}</td>
                  <td className="px-6 py-3">{u.totalHours}</td>
                  <td className="px-6 py-3">₹{u.totalAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
