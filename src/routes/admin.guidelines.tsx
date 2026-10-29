import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination } from "@/components/admin/Pagination";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Plus, Pencil, Trash2, Eye, EyeOff, X } from "lucide-react";

export const Route = createFileRoute("/admin/guidelines")({
  component: GuidelinesAdmin,
});

const CATEGORIES = ["children", "pregnant", "seniors", "general"];
const LABEL: Record<string, string> = {
  children: "Children",
  pregnant: "Pregnant Women",
  seniors: "Seniors",
  general: "General",
};

type Row = {
  id: string;
  title: string;
  profile: string;
  content: string | null;
  body: string | null;
  age_specifics: string | null;
  source_note: string | null;
  status: string;
  updated_at: string;
};

const PAGE_SIZE = 20;

function GuidelinesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await supabase
      .from("sp_web_guidelines_v1")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    setRows((data as Row[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  async function setStatus(id: string, status: string) {
    await supabase.from("sp_web_guidelines_v1").update({ status }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this guideline?")) return;
    await supabase.from("sp_web_guidelines_v1").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <AdminPageHeader
        title="Guidelines Manager"
        action={
          <button
            onClick={() => setEditing({ profile: "general", status: "draft", content: "", title: "" })}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add New Guideline
          </button>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-divider bg-card">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-left text-xs uppercase text-body">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-body">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-body">No guidelines yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-divider">
                <td className="px-4 py-3 text-heading">{r.title}</td>
                <td className="px-4 py-3 text-body">{LABEL[r.profile] || r.profile}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "published" ? "bg-safe/15 text-safe" : "bg-muted text-body"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-body">{new Date(r.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(r)} title="Edit" className="rounded p-1.5 text-body hover:bg-background hover:text-brand-blue"><Pencil className="h-4 w-4" /></button>
                    {r.status === "published" ? (
                      <button onClick={() => setStatus(r.id, "draft")} title="Unpublish" className="rounded p-1.5 text-body hover:bg-background hover:text-warn"><EyeOff className="h-4 w-4" /></button>
                    ) : (
                      <button onClick={() => setStatus(r.id, "published")} title="Publish" className="rounded p-1.5 text-body hover:bg-background hover:text-safe"><Eye className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => remove(r.id)} title="Delete" className="rounded p-1.5 text-body hover:bg-background hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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
  const [title, setTitle] = useState(row.title || "");
  const [profile, setProfile] = useState(row.profile || "general");
  const [content, setContent] = useState(row.content || row.body || "");
  const [ageSpecifics, setAgeSpecifics] = useState(row.age_specifics || "");
  const [sourceNote, setSourceNote] = useState(row.source_note || "");
  const [status, setStatus] = useState(row.status || "draft");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return alert("Title required");
    setBusy(true);
    const payload = {
      title: title.trim(),
      profile,
      content,
      body: content.replace(/<[^>]+>/g, " ").trim(),
      age_specifics: ageSpecifics || null,
      source_note: sourceNote || null,
      status,
    };
    if (row.id) {
      await supabase.from("sp_web_guidelines_v1").update(payload).eq("id", row.id);
    } else {
      await supabase.from("sp_web_guidelines_v1").insert(payload);
    }
    setBusy(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-xl border border-divider bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-heading">{row.id ? "Edit" : "New"} Guideline</h2>
          <button onClick={onClose} className="rounded p-1 text-body hover:text-heading"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select value={profile} onChange={(e) => setProfile(e.target.value)} className="input">
                {CATEGORIES.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </Field>
          </div>
          <Field label="Content">
            <RichTextEditor value={content} onChange={setContent} />
          </Field>
          <Field label="Age group specifics">
            <input value={ageSpecifics} onChange={(e) => setAgeSpecifics(e.target.value)} className="input" placeholder="e.g. 0–3 years" />
          </Field>
          <Field label="Source note">
            <input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} className="input" placeholder="e.g. Government of India Dietary Guidelines" />
          </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-body">{label}</span>
      {children}
    </label>
  );
}
