"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { isAdmin, isBillViewer, isDataOperator } from "@/lib/auth/roles";
import { ROLE_LABELS } from "@/types";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  Scale,
  Percent,
  Users,
  LogOut,
} from "lucide-react";

const baseItems = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];

const dataOperatorItems = [{ href: "/board", label: "Board Data", icon: ClipboardList }];

const billViewerItems = [{ href: "/billing", label: "Billing", icon: Receipt }];

const adminItems = [
  { href: "/admin/pleaders", label: "Pleaders", icon: Scale },
  { href: "/admin/fees", label: "Fee Config", icon: Percent },
  { href: "/admin/users", label: "Logins & Roles", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  const admin = isAdmin(role);
  const items = [
    ...baseItems,
    ...(isDataOperator(role) ? dataOperatorItems : []),
    ...(isBillViewer(role) || admin ? billViewerItems : []),
    ...(admin ? adminItems : []),
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold text-blue-600">BillEx</h1>
        <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          GP
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="mb-1 text-sm font-medium text-gray-700 truncate">{user?.email}</div>
        {role && <div className="mb-3 text-xs text-gray-400">{ROLE_LABELS[role]}</div>}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
