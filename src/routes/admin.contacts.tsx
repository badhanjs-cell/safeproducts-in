import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Pagination } from "@/components/admin/Pagination";
import { X } from "lucide-react";

export const Route = createFileRoute("/admin/contacts")({
  component: ContactsAdmin,
});

type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  user_type: string;
  purpose: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  attachment_url: string | null;
};

const STATUS = ["New", "In Progress", "Resolved"];
const PAGE_SIZE = 20;

function ContactsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Row | null>(null);

  async function load() {
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await supabase
      .from("sp_web_contact_submissions_v1")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    setRows((data as Row[]) || []);
    setTotal(count || 0);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  async function setStatus(id: string, status: string) {
    await supabase.from("sp_web_contact_submissions_v1").update({ status }).eq("id", id);
    load();
    if (open?.id === id) setOpen({ ...open, status });
  }

  return (
    <div>
      <AdminPageHeader title="Contact Submissions" />
      <div className="overflow-x-auto rounded-lg border border-divider bg-card">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-left text-xs uppercase text-body">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-body">No submissions.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-divider">
                <td className="px-4 py-3 text-heading">{r.full_name}</td>
                <td className="px-4 py-3 text-body">{r.email}</td>
                <td className="px-4 py-3 text-body">{r.purpose}</td>
                <td className="px-4 py-3 text-body">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "Resolved" ? "bg-safe/15 text-safe" : r.status === "In Progress" ? "bg-warn/15 text-warn" : "bg-brand-blue/15 text-brand-blue"}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setOpen(r)} className="text-sm font-medium text-brand-blue hover:underline">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-divider bg-card p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-heading">Submission</h2>
            <button onClick={() => setOpen(null)} className="rounded p-1 text-body hover:text-heading"><X className="h-5 w-5" /></button>
          </div>
          <dl className="space-y-3 text-sm">
            <Item k="Name" v={open.full_name} />
            <Item k="Email" v={open.email} />
            <Item k="Phone" v={open.phone || "—"} />
            <Item k="User type" v={open.user_type} />
            <Item k="Purpose" v={open.purpose} />
            <Item k="Subject" v={open.subject} />
            <Item k="Date" v={new Date(open.created_at).toLocaleString()} />
            <div>
              <dt className="text-xs uppercase text-body">Message</dt>
              <dd className="mt-1 whitespace-pre-wrap rounded-md bg-background p-3 text-heading">{open.message}</dd>
            </div>
            {open.attachment_url && /^https?:\/\//i.test(open.attachment_url) && (
              <Item k="Attachment" v={<a href={open.attachment_url} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">Open</a>} />
            )}
            <div>
              <dt className="text-xs uppercase text-body">Status</dt>
              <dd className="mt-1 flex gap-2">
                {STATUS.map((s) => (
                  <button key={s} onClick={() => setStatus(open.id, s)} className={`rounded-full px-3 py-1 text-xs font-medium ${open.status === s ? "bg-brand-blue text-primary-foreground" : "border border-divider text-body hover:border-brand-blue"}`}>
                    {s}
                  </button>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-body">{k}</dt>
      <dd className="mt-0.5 text-heading">{v}</dd>
    </div>
  );
}
