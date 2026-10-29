import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { BookOpen, Megaphone, Inbox, FileSearch } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Overview,
});

function Overview() {
  const [counts, setCounts] = useState({ guidelines: 0, announcements: 0, contacts: 0, labels: 0 });
  useEffect(() => {
    (async () => {
      const [g, a, c, l] = await Promise.all([
        supabase.from("sp_web_guidelines_v1").select("*", { count: "exact", head: true }),
        supabase.from("sp_web_site_announcements_v1").select("*", { count: "exact", head: true }),
        supabase.from("sp_web_contact_submissions_v1").select("*", { count: "exact", head: true }),
        supabase.from("sp_web_label_analyses_v1").select("*", { count: "exact", head: true }),
      ]);
      setCounts({ guidelines: g.count || 0, announcements: a.count || 0, contacts: c.count || 0, labels: l.count || 0 });
    })();
  }, []);

  const cards = [
    { label: "Guidelines", value: counts.guidelines, icon: BookOpen },
    { label: "Announcements", value: counts.announcements, icon: Megaphone },
    { label: "Contact Messages", value: counts.contacts, icon: Inbox },
    { label: "Label Analyses", value: counts.labels, icon: FileSearch },
  ];

  return (
    <div>
      <AdminPageHeader title="Overview" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-lg border border-divider bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-body">{c.label}</span>
                <Icon className="h-4 w-4 text-brand-blue" />
              </div>
              <div className="mt-2 text-2xl font-bold text-heading">{c.value}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-body">Use the sidebar to manage content.</p>
    </div>
  );
}
