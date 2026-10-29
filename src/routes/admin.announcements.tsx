import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination } from "@/components/admin/Pagination";
import { Plus, Pencil, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/admin/announcements")({
  component: AnnouncementsAdmin,
});

const TYPES = ["Did You Know Fact", "News", "Alert", "Seasonal Advisory"];

type Row = {
  id: string;
  message: string;
  type: string | null;
  display_from: string | null;
  display_until: string | null;
  status: string;
  active: boolean;
  created_at: string;
};

const PAGE_SIZE = 20;

function AnnouncementsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  async function load() {
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await supabase
      .from("sp_web_site_announcements_v1")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    setRows((data as Row[]) || []);
    setTotal(count || 0);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    await supabase.from("sp_web_site_announcements_v1").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <AdminPageHeader
        title="Announcements Manager"
        action={
          <button onClick={() => setEditing({ status: "active", type: "Did You Know Fact", message: "" })} className="inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Add New Announcement
          </button>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-divider bg-card">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-left text-xs uppercase text-body">
            <tr>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-body">No announcements yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-divider">
                <td className="px-4 py-3 text-heading max-w-md truncate">{r.message}</td>
                <td className="px-4 py-3 text-body">{r.type || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "active" ? "bg-safe/15 text-safe" : "bg-muted text-body"}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-body">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(r)} className="rounded p-1.5 text-body hover:bg-background hover:text-brand-blue"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r.id)} className="rounded p-1.5 text-body hover:bg-background hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function EditDialog({ row, onClose, onSaved }: { row: Partial<Row>; onClose: () => void; onSaved: () => void }) {
  const [message, setMessage] = useState(row.message || "");
  const [type, setType] = useState(row.type || "Did You Know Fact");
  const [from, setFrom] = useState(row.display_from || "");
  const [until, setUntil] = useState(row.display_until || "");
  const [status, setStatus] = useState(row.status || "active");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!message.trim()) return alert("Message required");
    setBusy(true);
    const payload = {
      message: message.trim(),
      type,
      display_from: from || null,
      display_until: until || null,
      status,
      active: status === "active",
    };
    if (row.id) await supabase.from("sp_web_site_announcements_v1").update(payload).eq("id", row.id);
    else await supabase.from("sp_web_site_announcements_v1").insert(payload);
    setBusy(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-xl rounded-xl border border-divider bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-heading">{row.id ? "Edit" : "New"} Announcement</h2>
          <button onClick={onClose} className="rounded p-1 text-body hover:text-heading"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-body">Message</span>
            <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="input" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-body">Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-body">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-body">Display from</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-body">Display until</span>
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="input" />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-divider px-4 py-2 text-sm text-body hover:border-brand-blue">Cancel</button>
          <button disabled={busy} onClick={save} className="rounded-md bg-brand-blue px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
