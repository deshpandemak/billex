"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { StatsCard } from "@/components/stats-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClipboardList, Receipt, Scale, Users } from "lucide-react";
import type { BoardEntry } from "@/types";
import { DESIGNATION_LABELS, RESULT_STATUS_LABELS, ROLE_LABELS } from "@/types";

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

export default function DashboardPage() {
  const { role } = useAuth();
  const admin = isAdmin(role);
  const [stats, setStats] = useState({ entries: 0, disposed: 0, fees: 0, pleaders: 0, users: 0 });
  const [recent, setRecent] = useState<BoardEntry[]>([]);

  useEffect(() => {
    async function load() {
      const entriesQuery = query(
        collection(db, "boardEntries"),
        where("date", ">=", monthStart()),
        orderBy("date", "desc")
      );
      const entriesSnap = await getDocs(entriesQuery);
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardEntry);

      const disposed = entries.filter((e) => e.status === "DISPOSED").length;
      const fees = entries.reduce((sum, e) => sum + (e.fees || 0), 0);

      let pleaders = 0;
      let users = 0;
      if (admin) {
        const [pleadersSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "pleaders")),
          getDocs(collection(db, "users")),
        ]);
        pleaders = pleadersSnap.size;
        users = usersSnap.size;
      }

      setStats({ entries: entries.length, disposed, fees, pleaders, users });
      setRecent(entries.slice(0, 5));
    }
    load();
  }, [admin]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {role && <p className="text-sm text-gray-500">{ROLE_LABELS[role]}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Entries This Month" value={stats.entries} icon={<ClipboardList className="h-5 w-5" />} />
        <StatsCard title="Disposed This Month" value={stats.disposed} icon={<ClipboardList className="h-5 w-5" />} />
        <StatsCard title="Fees This Month (₹)" value={stats.fees.toLocaleString()} icon={<Receipt className="h-5 w-5" />} />
        {admin && (
          <>
            <StatsCard title="Pleaders" value={stats.pleaders} icon={<Scale className="h-5 w-5" />} />
            <StatsCard title="Logins" value={stats.users} icon={<Users className="h-5 w-5" />} />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Board Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">No board entries yet this month.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Case</th>
                  <th className="pb-2 font-medium">Party</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Pleader</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2">{e.date}</td>
                    <td className="py-2 font-mono">
                      {e.caseType} {e.caseNo}/{e.year}
                    </td>
                    <td className="py-2">{e.partyName}</td>
                    <td className="py-2">{RESULT_STATUS_LABELS[e.status]}</td>
                    <td className="py-2">
                      {e.pleaderName}
                      {e.designation && ` (${DESIGNATION_LABELS[e.designation]})`}
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
