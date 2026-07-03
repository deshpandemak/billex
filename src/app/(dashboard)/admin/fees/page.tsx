"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Designation, FeeConfig } from "@/types";
import { DESIGNATION_LABELS, DESIGNATIONS } from "@/types";

type RatesByDesignation = Record<Designation, { adjourned: number; heardAdjourned: number; disposed: number }>;

const EMPTY_RATES: RatesByDesignation = DESIGNATIONS.reduce((acc, d) => {
  acc[d] = { adjourned: 0, heardAdjourned: 0, disposed: 0 };
  return acc;
}, {} as RatesByDesignation);

export default function AdminFeesPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const admin = isAdmin(role);
  const [rates, setRates] = useState<RatesByDesignation>(EMPTY_RATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!admin) {
      router.push("/dashboard");
      return;
    }

    async function loadFees() {
      setLoading(true);
      const snap = await getDocs(collection(db, "feeConfig"));
      const next = { ...EMPTY_RATES };
      snap.docs.forEach((d) => {
        const data = d.data() as FeeConfig;
        next[data.designation] = {
          adjourned: data.adjourned ?? 0,
          heardAdjourned: data.heardAdjourned ?? 0,
          disposed: data.disposed ?? 0,
        };
      });
      setRates(next);
      setLoading(false);
    }
    loadFees();
  }, [admin, router]);

  function updateRate(d: Designation, field: keyof RatesByDesignation[Designation], value: string) {
    setRates((prev) => ({ ...prev, [d]: { ...prev[d], [field]: parseFloat(value) || 0 } }));
    setSaved(false);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const now = Timestamp.now();
    await Promise.all(
      DESIGNATIONS.map((d) =>
        setDoc(doc(db, "feeConfig", d), {
          designation: d,
          ...rates[d],
          updatedAt: now,
          updatedBy: user.uid,
        })
      )
    );
    setSaving(false);
    setSaved(true);
  }

  if (!admin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fee Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Fees by Designation (₹)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">Designation</th>
                  <th className="px-6 py-3 font-medium">Adjourned</th>
                  <th className="px-6 py-3 font-medium">Heard & Adjourned</th>
                  <th className="px-6 py-3 font-medium">Disposed</th>
                </tr>
              </thead>
              <tbody>
                {DESIGNATIONS.map((d) => (
                  <tr key={d} className="border-b last:border-0">
                    <td className="px-6 py-3 font-medium">{DESIGNATION_LABELS[d]}</td>
                    <td className="px-6 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="w-32"
                        value={rates[d].adjourned}
                        onChange={(e) => updateRate(d, "adjourned", e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="w-32"
                        value={rates[d].heardAdjourned}
                        onChange={(e) => updateRate(d, "heardAdjourned", e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="w-32"
                        value={rates[d].disposed}
                        onChange={(e) => updateRate(d, "disposed", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? "Saving..." : "Save Fees"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
    </div>
  );
}
