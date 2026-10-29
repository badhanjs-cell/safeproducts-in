import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/stats")({
  component: StatsAdmin,
});

type View = { visited_at: string | null; search_term: string | null; category_clicked: string | null; page: string | null };

function StatsAdmin() {
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [month, setMonth] = useState(0);
  const [terms, setTerms] = useState<{ k: string; n: number }[]>([]);
  const [cats, setCats] = useState<{ k: string; n: number }[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const monthAgo = new Date(now.getTime() - 30 * 86400000);

      const [t, w, m] = await Promise.all([
        supabase.from("sp_web_page_views_v1").select("*", { count: "exact", head: true }).gte("visited_at", startOfDay.toISOString()),
        supabase.from("sp_web_page_views_v1").select("*", { count: "exact", head: true }).gte("visited_at", weekAgo.toISOString()),
        supabase.from("sp_web_page_views_v1").select("*", { count: "exact", head: true }).gte("visited_at", monthAgo.toISOString()),
      ]);
      setToday(t.count || 0); setWeek(w.count || 0); setMonth(m.count || 0);

      const { data } = await supabase
        .from("sp_web_page_views_v1")
        .select("search_term, category_clicked, page, visited_at")
        .gte("visited_at", weekAgo.toISOString())
        .limit(2000);
      const rows = (data || []) as View[];

      const tally = (key: keyof View) => {
        const map = new Map<string, number>();
        rows.forEach((r) => {
          const v = r[key];
          if (v && typeof v === "string") map.set(v, (map.get(v) || 0) + 1);
        });
        return Array.from(map.entries()).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 10);
      };
      setTerms(tally("search_term"));
      setCats(tally("category_clicked"));
    })();
  }, []);

  return (
    <div>
      <AdminPageHeader title="Visitor Statistics" />
      <p className="mb-4 text-xs text-body">Visible to admins only. Never shown to public users.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Visits today" value={today} />
        <Stat label="Last 7 days" value={week} />
        <Stat label="Last 30 days" value={month} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title="Top search terms (last 7 days)">
          {terms.length === 0 ? <p className="text-sm text-body">No data.</p> : (
            <ul className="space-y-1.5 text-sm">
              {terms.map((t) => (
                <li key={t.k} className="flex justify-between border-b border-divider/50 pb-1.5">
                  <span className="text-heading">{t.k}</span>
                  <span className="text-brand-blue">{t.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Most viewed categories (last 7 days)">
          {cats.length === 0 ? <p className="text-sm text-body">No data.</p> : (
            <ul className="space-y-1.5 text-sm">
              {cats.map((t) => (
                <li key={t.k} className="flex justify-between border-b border-divider/50 pb-1.5">
                  <span className="text-heading">{t.k}</span>
                  <span className="text-brand-blue">{t.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-divider bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-body">{label}</div>
      <div className="mt-1 text-3xl font-bold text-heading">{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-divider bg-card p-4">
      <h3 className="mb-3 text-sm font-bold text-heading">{title}</h3>
      {children}
    </div>
  );
}
