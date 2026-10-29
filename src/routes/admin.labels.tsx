import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination } from "@/components/admin/Pagination";
import { X } from "lucide-react";

export const Route = createFileRoute("/admin/labels")({
  component: LabelsAdmin,
});

type Row = {
  id: string;
  analysed_at: string;
  profile_used: string | null;
  safety_score: number | null;
  detected_ingredients: unknown;
  ingredient_breakdown: unknown;
  warnings: unknown;
  summary: string | null;
  uploaded_image_url: string | null;
};

const PAGE_SIZE = 20;

function LabelsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      const from = (page - 1) * PAGE_SIZE;
      const { data, count } = await supabase
        .from("sp_web_label_analyses_v1")
        .select("*", { count: "exact" })
        .order("analysed_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      setRows((data as Row[]) || []);
      setTotal(count || 0);
    })();
  }, [page]);

  return (
    <div>
      <AdminPageHeader title="Label Analyses" />
      <div className="overflow-x-auto rounded-lg border border-divider bg-card">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-left text-xs uppercase text-body">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">Safety Score</th>
              <th className="px-4 py-3">Ingredients</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-body">No label analyses yet.</td></tr>}
            {rows.map((r) => {
              const ing = Array.isArray(r.detected_ingredients) ? (r.detected_ingredients as unknown[]).length : 0;
              return (
                <tr key={r.id} className="border-t border-divider">
                  <td className="px-4 py-3 text-body">{new Date(r.analysed_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-heading">{r.profile_used || "—"}</td>
                  <td className="px-4 py-3 text-heading">{r.safety_score ?? "—"}</td>
                  <td className="px-4 py-3 text-body">{ing}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setOpen(r)} className="text-sm font-medium text-brand-blue hover:underline">View Details</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-divider bg-card p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-lg font-bold text-heading">Analysis</h2>
            <button onClick={() => setOpen(null)} className="rounded p-1 text-body hover:text-heading"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-3 text-sm text-body">
            <p><span className="text-xs uppercase">Date:</span> <span className="text-heading">{new Date(open.analysed_at).toLocaleString()}</span></p>
            <p><span className="text-xs uppercase">Profile:</span> <span className="text-heading">{open.profile_used || "—"}</span></p>
            <p><span className="text-xs uppercase">Safety score:</span> <span className="text-heading">{open.safety_score ?? "—"}</span></p>
            {open.summary && <p className="rounded-md bg-background p-3 text-heading">{open.summary}</p>}
            <div>
              <p className="mb-1 text-xs uppercase">Detected ingredients</p>
              <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs text-heading">{JSON.stringify(open.detected_ingredients, null, 2)}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase">Warnings</p>
              <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs text-heading">{JSON.stringify(open.warnings, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
