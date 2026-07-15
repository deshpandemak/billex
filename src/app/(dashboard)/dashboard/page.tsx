"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin, isBillViewer } from "@/lib/auth/roles";
import { StatsCard } from "@/components/stats-card";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClipboardList, Scale, Users } from "lucide-react";
import type { BoardEntry } from "@/types";
import { DESIGNATION_LABELS, RESULT_STATUS_LABELS, ROLE_LABELS } from "@/types";

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function weekStart() {
  const d = new Date();
  const diff = d.getDay() === 0 ? 6 : d.getDay() - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().split("T")[0];
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardPage() {
  const { role, pleaderId, loading: authLoading } = useAuth();
  const admin = isAdmin(role);
  const billViewer = isBillViewer(role);
  const [stats, setStats] = useState({ entries: 0, entriesThisWeek: 0, entriesToday: 0, pleaders: 0, users: 0 });
  const [recent, setRecent] = useState<BoardEntry[]>([]);

  useEffect(() => {
    if (authLoading) return;

    async function load() {
      // Bill viewers only ever see board entries for their own linked pleader —
      // never anyone else's data on this dashboard. With no pleader linked,
      // they see nothing rather than falling back to the unscoped view.
      if (billViewer && !pleaderId) {
        setStats({ entries: 0, entriesThisWeek: 0, entriesToday: 0, pleaders: 0, users: 0 });
        setRecent([]);
        return;
      }

      const scope = billViewer ? [where("pleaderId", "==", pleaderId)] : [];

      const entriesQuery = query(
        collection(db, "boardEntries"),
        ...scope,
        where("date", ">=", monthStart()),
        orderBy("date", "desc")
      );
      const weekQuery = query(collection(db, "boardEntries"), ...scope, where("date", ">=", weekStart()));
      const todayQuery = query(collection(db, "boardEntries"), ...scope, where("date", "==", todayISO()));

      const [entriesSnap, weekSnap, todaySnap] = await Promise.all([
        getDocs(entriesQuery),
        getDocs(weekQuery),
        getDocs(todayQuery),
      ]);
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardEntry);

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

      setStats({ entries: entries.length, entriesThisWeek: weekSnap.size, entriesToday: todaySnap.size, pleaders, users });
      setRecent(entries.slice(0, 5));
    }
    load();
  }, [admin, billViewer, pleaderId, authLoading]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {role && <p className="text-sm text-gray-500">{ROLE_LABELS[role]}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Entries This Month" value={stats.entries} icon={<ClipboardList className="h-5 w-5" />} />
        <StatsCard title="Entries This Week" value={stats.entriesThisWeek} icon={<ClipboardList className="h-5 w-5" />} />
        <StatsCard title="Entries Today" value={stats.entriesToday} icon={<ClipboardList className="h-5 w-5" />} />
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
                    <td className="py-2">{formatDate(e.date)}</td>
                    <td className="py-2 font-mono">
                      {e.caseType} {e.caseNo}/{e.year}
                    </td>
                    <td className="py-2">{e.petitioner}</td>
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
