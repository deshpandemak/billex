"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function NewCasePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const form = new FormData(e.currentTarget);
    await addDoc(collection(db, "cases"), {
      caseNumber: form.get("caseNumber"),
      title: form.get("title"),
      description: form.get("description"),
      clientName: form.get("clientName"),
      status: "open",
      assignedTo: user.uid,
      createdBy: user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    router.push("/cases");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">New Case</h1>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="caseNumber">Case Number</Label>
              <Input id="caseNumber" name="caseNumber" required placeholder="e.g. CASE-2026-001" />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="Case title" />
            </div>
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" name="clientName" required placeholder="Client name" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Case description" rows={4} />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create Case"}
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
