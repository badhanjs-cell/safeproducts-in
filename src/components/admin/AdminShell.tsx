import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, Megaphone, Inbox, FileSearch, BarChart3, Activity, RefreshCw, ClipboardCheck, LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/lib/useAdminAuth";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/guidelines", label: "Guidelines", icon: BookOpen },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/contacts", label: "Contact Inbox", icon: Inbox },
  { to: "/admin/labels", label: "Label Analyses", icon: FileSearch },
  { to: "/admin/search-audit", label: "Search Audit", icon: Activity },
  { to: "/admin/ingredient-recovery", label: "Ingredient Recovery", icon: RefreshCw },
  { to: "/admin/human-review", label: "Human Review", icon: ClipboardCheck },
  { to: "/admin/stats", label: "Visitor Stats", icon: BarChart3 },
];

export function AdminShell({ children, email }: { children: React.ReactNode; email: string | null }) {
  const loc = useLocation();
  const nav = useNavigate();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-divider bg-footer p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <ShieldCheck className="h-5 w-5 text-brand-blue" />
          <span className="text-sm font-bold text-heading">Admin Portal</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-card text-brand-blue" : "text-body hover:bg-card hover:text-heading"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-divider pt-3">
          <p className="truncate px-2 text-xs text-body" title={email || ""}>{email}</p>
          <button
            onClick={async () => { await signOut(); nav({ to: "/admin" }); }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-body hover:bg-card hover:text-heading"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-x-auto">
        <header className="flex items-center justify-between border-b border-divider bg-footer px-4 py-3 md:hidden">
          <span className="font-bold text-heading">Admin</span>
          <button onClick={async () => { await signOut(); nav({ to: "/admin" }); }} className="text-sm text-body">Sign out</button>
        </header>
        <div className="md:hidden flex gap-1 overflow-x-auto border-b border-divider bg-footer px-2 py-2">
          {NAV.map((n) => {
            const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`whitespace-nowrap rounded px-3 py-1.5 text-xs ${active ? "bg-card text-brand-blue" : "text-body"}`}>
                {n.label}
              </Link>
            );
          })}
        </div>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function AdminPageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-heading sm:text-2xl">{title}</h1>
      {action}
    </div>
  );
}
