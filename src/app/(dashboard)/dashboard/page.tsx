"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin } from "@/lib/auth/roles";
import { StatsCard } from "@/components/stats-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Briefcase, FileText, Clock, Users } from "lucide-react";
import type { Case, Entry } from "@/types";

export default function DashboardPage() {
  const { user, role } = useAuth();
  const admin = isAdmin(role);
  const [stats, setStats] = useState({ cases: 0, entries: 0, hours: 0, users: 0 });
  const [recentCases, setRecentCases] = useState<Case[]>([]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const casesRef = collection(db, "cases");
      const entriesRef = collection(db, "entries");

      const casesQuery = admin
        ? query(casesRef)
        : query(casesRef, where("assignedTo", "==", user!.uid));
      const entriesQuery = admin
        ? query(entriesRef)
        : query(entriesRef, where("enteredBy", "==", user!.uid));

      const [casesSnap, entriesSnap] = await Promise.all([
        getDocs(casesQuery),
        getDocs(entriesQuery),
      ]);

      let totalHours = 0;
      entriesSnap.forEach((doc) => {
        totalHours += doc.data().hours || 0;
      });

      let usersCount = 0;
      if (admin) {
        const usersSnap = await getDocs(collection(db, "users"));
        usersCount = usersSnap.size;
      }

      setStats({
        cases: casesSnap.size,
        entries: entriesSnap.size,
        hours: Math.round(totalHours * 10) / 10,
        users: usersCount,
      });

      const recentQuery = admin
        ? query(casesRef, orderBy("createdAt", "desc"), limit(5))
        : query(casesRef, where("assignedTo", "==", user!.uid), orderBy("createdAt", "desc"), limit(5));
      const recentSnap = await getDocs(recentQuery);
      setRecentCases(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Case));
    }

    load();
  }, [user, admin]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Cases" value={stats.cases} icon={<Briefcase className="h-5 w-5" />} />
        <StatsCard title="Total Entries" value={stats.entries} icon={<FileText className="h-5 w-5" />} />
        <StatsCard title="Total Hours" value={stats.hours} icon={<Clock className="h-5 w-5" />} />
        {admin && (
          <StatsCard title="Total Users" value={stats.users} icon={<Users className="h-5 w-5" />} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCases.length === 0 ? (
            <p className="text-sm text-gray-500">No cases yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Case #</th>
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 font-mono">{c.caseNumber}</td>
                    <td className="py-2">{c.title}</td>
                    <td className="py-2">{c.clientName}</td>
                    <td className="py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.status === "open"
                            ? "bg-green-100 text-green-700"
                            : c.status === "closed"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {c.status}
                      </span>
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
