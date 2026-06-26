"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { Case } from "@/types";

export default function NewEntryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);

  useEffect(() => {
    async function loadCases() {
      const snap = await getDocs(query(collection(db, "cases"), orderBy("caseNumber")));
      setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Case));
    }
    loadCases();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const selectedCase = cases.find((c) => c.id === form.get("caseId"));

    await addDoc(collection(db, "entries"), {
      caseId: form.get("caseId"),
      caseNumber: selectedCase?.caseNumber || "",
      date: form.get("date"),
      description: form.get("description"),
      hours: parseFloat(form.get("hours") as string) || 0,
      amount: parseFloat(form.get("amount") as string) || 0,
      enteredBy: user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    router.push("/entries");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">New Entry</h1>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="caseId">Case</Label>
              <select
                id="caseId"
                name="caseId"
                required
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a case...</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} — {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" required placeholder="Work performed" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hours">Hours</Label>
                <Input id="hours" name="hours" type="number" step="0.25" min="0" required />
              </div>
              <div>
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create Entry"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
