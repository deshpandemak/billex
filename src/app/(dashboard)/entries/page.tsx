"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import type { Entry } from "@/types";

export default function EntriesPage() {
  const { user, role } = useAuth();
  const admin = isAdmin(role);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    async function load() {
      const ref = collection(db, "entries");
      const q = admin
        ? query(ref, orderBy("date", "desc"))
        : query(ref, where("enteredBy", "==", user!.uid), orderBy("date", "desc"));
      const snap = await getDocs(q);
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry));
    }
    load();
  }, [user, admin]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await deleteDoc(doc(db, "entries", id));
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const filtered = entries.filter(
    (e) =>
      e.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Entries</h1>
        <Link href="/entries/new">
          <Button><Plus className="h-4 w-4" /> New Entry</Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by case number or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Case #</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Hours</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No entries found.</td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-3">{e.date}</td>
                    <td className="px-6 py-3 font-mono">{e.caseNumber}</td>
                    <td className="px-6 py-3">{e.description}</td>
                    <td className="px-6 py-3">{e.hours}</td>
                    <td className="px-6 py-3">₹{e.amount.toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(e.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
