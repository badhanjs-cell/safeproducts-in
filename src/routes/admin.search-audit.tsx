import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Play, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProfilePills, type Profile } from "@/components/HeroSearch";
import { SearchProgress } from "@/components/SearchProgress";
import { supabase } from "@/integrations/supabase/client";
import { searchProductsClient } from "@/lib/searchClient";
import type { ContractResult } from "@/lib/searchContract";

export const Route = createFileRoute("/admin/search-audit")({ component: SearchAuditAdmin });

type AuditRun = {
  search_id: string; query: string; profile: string; category: string | null;
  resolved_category: string | null; location: string | null; created_at: string;
  completed_at: string | null; cache_hit: boolean; discovery_count: number;
  qualification_count: number; qualified_count: number; rejected_count: number;
  ingredient_source_count: number; response_claimed: boolean; response_status: string | null;
  display_count: number; safety_qualified_count: number; price_fallback_count: number;
  cache_persistence_status: string | null; latest_stage_code: string | null;
  latest_stage_status: string | null;
};

type TraceStep = { order: number; code: string; label: string; status: string; at: string | null; outcome: Record<string, unknown> };
type TraceEvent = { id: number; order: number; code: string; status: string; source: string; at: string; detail: Record<string, unknown> };
type QualificationProduct = {
  order: number; product_fingerprint: string; title: string; merchant: string | null; price: number | null;
  decision: string | null; response_status: string | null; reject_reason: string | null;
  selected_for_safety: boolean | null; cache_eligible: boolean | null; ingredient_count: number | null;
  ingredient_confidence: number | null; overall_confidence: number | null; extraction_method: string | null;
  winning_tier: string | null;
};
type IngredientSource = {
  product_fingerprint: string; product_name: string | null; source_type: string | null; source_name: string | null;
  source_priority: number | null; extraction_method: string | null; confidence: number | null;
  verified: boolean | null; ingredient_count: number; created_at: string;
};
type SearchTrace = {
  status: string; contract: string;
  search: { search_id: string; query: string; profile: string; category: string | null; resolved_category: string | null; location: string | null; cache_hit: boolean; created_at: string };
  steps: TraceStep[]; events: TraceEvent[]; products: QualificationProduct[];
  ingredient_sources: IngredientSource[]; final_response_summary: Record<string, unknown> | null;
};
type RunsPayload = { status: string; contract: string; generated_at: string; runs: AuditRun[] };
type TestState = { result: ContractResult | null; elapsedMs: number; diagnostic: string | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function profileToken(value: Profile) {
  if (value === "Children") return "CHILDREN";
  if (value === "Pregnant Women") return "PREGNANT";
  if (value === "Seniors") return "SENIORS";
  return "ALL";
}
function normalizeProfile(value: string | null | undefined) {
  const token = (value || "").trim().toUpperCase();
  if (["ALL", "GENERAL"].includes(token)) return "ALL";
  if (["CHILD", "CHILDREN"].includes(token)) return "CHILDREN";
  if (["PREGNANT", "PREGNANCY", "PREGNANT WOMEN"].includes(token)) return "PREGNANT";
  if (["SENIOR", "SENIORS"].includes(token)) return "SENIORS";
  return token;
}
function fmtTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}
function tone(status: string | null | undefined) {
  const s = (status || "").toUpperCase();
  if (/FAILED|ERROR|INVALID|CONTAMINATED/.test(s)) return "border-red-500/30 bg-red-500/10 text-red-300";
  if (/COMPLETE|READY|RECOVERED|CACHE_HIT|QUALIFIED/.test(s)) return "border-green-500/30 bg-green-500/10 text-green-300";
  if (/WAIT|FALLBACK|CACHE_MISS|NOT_CACHED|LOW_TRUST|NOT_FOUND|REJECTED/.test(s)) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-divider bg-background text-body";
}
function Status({ value }: { value: string | null | undefined }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone(value)}`}>{value || "UNKNOWN"}</span>;
}
function Outcome({ value }: { value: Record<string, unknown> | null | undefined }) {
  const entries = Object.entries(value || {});
  if (!entries.length) return <p className="text-xs text-body">No additional outcome data.</p>;
  return (
    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
      {entries.map(([key, raw]) => (
        <div key={key} className="grid grid-cols-[minmax(110px,.7fr)_1fr] gap-2 border-b border-divider/40 py-1.5">
          <dt className="break-words text-body">{key.replaceAll("_", " ")}</dt>
          <dd className="break-words text-heading">{raw == null ? "—" : typeof raw === "object" ? JSON.stringify(raw) : String(raw)}</dd>
        </div>
      ))}
    </dl>
  );
}

function SearchAuditAdmin() {
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [trace, setTrace] = useState<SearchTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<Profile>("ALL");
  const [category, setCategory] = useState("all");
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [test, setTest] = useState<TestState>({ result: null, elapsedMs: 0, diagnostic: null });
  const runToken = useRef(0);

  async function loadRuns(silent = false): Promise<AuditRun[]> {
    if (!silent) setRunsLoading(true);
    setRunsError(null);
    const { data, error } = await supabase.rpc("sp_web_admin_search_runs_v1", { p_limit: 30 });
    if (error) { setRunsError(error.message); if (!silent) setRunsLoading(false); return []; }
    const payload = data as unknown as RunsPayload;
    const next = Array.isArray(payload?.runs) ? payload.runs : [];
    setRuns(next);
    if (!silent) setRunsLoading(false);
    return next;
  }

  async function loadTrace(searchId: string, silent = false) {
    if (!silent) setTraceLoading(true);
    setTraceError(null);
    const { data, error } = await supabase.rpc("sp_web_admin_search_trace_v1", { p_search_id: searchId });
    if (error) { setTraceError(error.message); if (!silent) setTraceLoading(false); return; }
    setTrace(data as unknown as SearchTrace);
    if (!silent) setTraceLoading(false);
  }

  useEffect(() => { loadRuns(); }, []);
  useEffect(() => { if (selectedSearchId) loadTrace(selectedSearchId); }, [selectedSearchId]);
  useEffect(() => {
    if (!running || !selectedSearchId) return;
    const id = window.setInterval(() => loadTrace(selectedSearchId, true), 2000);
    return () => window.clearInterval(id);
  }, [running, selectedSearchId]);
  useEffect(() => {
    if (!running || !startedAt) return;
    const id = window.setInterval(() => setTest((prev) => ({ ...prev, elapsedMs: Date.now() - startedAt })), 500);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  async function findRun(started: number, submittedQuery: string, submittedProfile: Profile, token: number) {
    const cutoff = started - 5000;
    for (let i = 0; i < 45; i += 1) {
      if (runToken.current !== token) return null;
      const latest = await loadRuns(true);
      const match = latest.find((run) => run.query === submittedQuery
        && normalizeProfile(run.profile) === profileToken(submittedProfile)
        && new Date(run.created_at).getTime() >= cutoff);
      if (match) { setSelectedSearchId(match.search_id); await loadTrace(match.search_id, true); return match.search_id; }
      await sleep(2000);
    }
    return null;
  }

  async function runRealSearch(e: React.FormEvent) {
    e.preventDefault();
    const submittedQuery = query.trim();
    if (!submittedQuery) return;
    const started = Date.now();
    const token = runToken.current + 1;
    runToken.current = token;
    setStartedAt(started); setRunning(true); setSelectedSearchId(null); setTrace(null);
    setTest({ result: null, elapsedMs: 0, diagnostic: null });
    const finder = findRun(started, submittedQuery, profile, token);
    const result = await searchProductsClient({ query: submittedQuery, profile, limit: 10, category: category.trim() || "all" });
    if (runToken.current !== token) return;
    const searchId = await finder;
    setTest({ result, elapsedMs: Date.now() - started, diagnostic: searchId ? null : "Frontend search returned, but no matching backend search run was observed." });
    setRunning(false); await loadRuns(true); if (searchId) await loadTrace(searchId, true);
  }

  const selectedRun = useMemo(() => runs.find((run) => run.search_id === selectedSearchId) || null, [runs, selectedSearchId]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Search Pipeline Audit" action={
        <button type="button" onClick={() => loadRuns()} className="inline-flex items-center gap-2 rounded-md border border-divider bg-card px-3 py-2 text-xs font-semibold text-heading hover:border-brand-blue/60">
          <RefreshCw className={`h-3.5 w-3.5 ${runsLoading ? "animate-spin" : ""}`} /> Refresh
        </button>
      } />

      <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-brand-blue/10 p-2 text-brand-blue"><Play className="h-4 w-4" /></div>
          <div><h2 className="font-bold text-heading">Run real SafePrice search</h2><p className="mt-1 text-xs text-body">Uses the same frontend client and production search path as a consumer search. Audit reads are admin-only and read-only.</p></div>
        </div>
        <form onSubmit={runRealSearch} className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div><label className="mb-1 block text-xs font-semibold text-body">Search query</label><input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={200} required placeholder="e.g. Vitabiotics Pregnacare Original India" className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-heading outline-none focus:border-brand-blue" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-body">Category</label><input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={100} className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-heading outline-none focus:border-brand-blue" /></div>
          </div>
          <div><label className="mb-2 block text-xs font-semibold text-body">Profile</label><div className="flex justify-start"><ProfilePills value={profile} onChange={setProfile} /></div></div>
          <button type="submit" disabled={running} className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Play className="h-4 w-4" />{running ? "Search running…" : "Run real search"}</button>
        </form>
        {running && startedAt && <div className="mt-4 rounded-lg border border-divider bg-background px-4"><SearchProgress resetKey={`${query}:${startedAt}`} /><p className="pb-4 text-center text-xs text-body">Elapsed: {(test.elapsedMs / 1000).toFixed(1)}s</p></div>}
        {test.result && !running && <div className="mt-4 rounded-lg border border-divider bg-background p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-body">Frontend result</span><Status value={test.result.status} /><span className="text-xs text-body">{(test.elapsedMs / 1000).toFixed(1)}s · {test.result.results.length} displayed</span></div>{test.result.consumerNotice && <p className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">{test.result.consumerNotice}</p>}{test.result.error && <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">{test.result.error}</p>}{test.diagnostic && <p className="mt-3 text-xs text-amber-300">{test.diagnostic}</p>}</div>}
      </section>

      <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-brand-blue" /><h2 className="font-bold text-heading">Recent search runs</h2></div>
        {runsError && <p className="mb-3 rounded-md bg-red-500/10 p-3 text-xs text-red-300">{runsError}</p>}
        <div className="overflow-x-auto rounded-lg border border-divider"><table className="min-w-[1150px] w-full text-left text-xs"><thead className="bg-background text-body"><tr><Th>Created</Th><Th>Query</Th><Th>Profile</Th><Th>Cache</Th><Th>Discovery</Th><Th>Qualified / Rejected</Th><Th>Evidence</Th><Th>Response</Th><Th>Displayed</Th><Th>Safety</Th><Th>Price fallback</Th></tr></thead><tbody>
          {runs.map((run) => <tr key={run.search_id} onClick={() => setSelectedSearchId(run.search_id)} className={`cursor-pointer border-t border-divider/60 hover:bg-background/80 ${selectedSearchId === run.search_id ? "bg-brand-blue/5" : ""}`}><Td>{fmtTime(run.created_at)}</Td><Td><span className="font-medium text-heading">{run.query}</span></Td><Td>{run.profile}</Td><Td><Status value={run.cache_hit ? "CACHE_HIT" : "CACHE_MISS"} /></Td><Td>{run.discovery_count}</Td><Td>{run.qualified_count} / {run.rejected_count} ({run.qualification_count})</Td><Td>{run.ingredient_source_count}</Td><Td><Status value={run.response_status || (run.response_claimed ? "COMPLETE" : "PENDING")} /></Td><Td>{run.display_count}</Td><Td>{run.safety_qualified_count}</Td><Td>{run.price_fallback_count}</Td></tr>)}
          {!runsLoading && runs.length === 0 && <tr><td colSpan={11} className="p-5 text-center text-body">No search runs found.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="rounded-xl border border-divider bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-heading">Selected pipeline trace</h2><p className="mt-1 text-xs text-body">{selectedRun ? `${selectedRun.query} · ${selectedRun.search_id}` : "Choose a search run above."}</p></div>{selectedSearchId && <button type="button" onClick={() => loadTrace(selectedSearchId)} className="inline-flex items-center gap-2 rounded-md border border-divider bg-background px-3 py-2 text-xs text-heading"><RefreshCw className={`h-3.5 w-3.5 ${traceLoading ? "animate-spin" : ""}`} /> Refresh trace</button>}</div>
        {traceError && <p className="rounded-md bg-red-500/10 p-3 text-xs text-red-300">{traceError}</p>}
        {!trace && !traceLoading && !traceError && <p className="text-sm text-body">No trace selected.</p>}
        {trace && <div className="space-y-6">
          {trace.events.length > 0 && <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-3"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-blue">Exceptional pipeline events</p>{trace.events.map((event) => <div key={event.id} className="mb-1 flex flex-wrap items-center gap-2 text-xs"><Status value={event.status} /><span className="font-semibold text-heading">{event.code}</span><span className="text-body">{event.source} · {fmtTime(event.at)}</span></div>)}</div>}
          <div className="space-y-3">{trace.steps.map((step) => <div key={`${step.order}-${step.code}`} className="rounded-lg border border-divider bg-background p-4"><div className="flex gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-blue/30 bg-brand-blue/10 text-xs font-bold text-brand-blue">{step.order}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-heading">{step.label}</h3><Status value={step.status} /><span className="text-[11px] text-body">{fmtTime(step.at)}</span></div><div className="mt-3"><Outcome value={step.outcome} /></div></div></div></div>)}</div>
          <div><h3 className="mb-3 font-bold text-heading">Product qualification outcomes</h3><div className="overflow-x-auto rounded-lg border border-divider"><table className="min-w-[1350px] w-full text-left text-xs"><thead className="bg-background text-body"><tr><Th>#</Th><Th>Product</Th><Th>Merchant</Th><Th>Price</Th><Th>Decision</Th><Th>Response</Th><Th>Ingredients</Th><Th>Ingredient conf.</Th><Th>Overall conf.</Th><Th>Tier / method</Th><Th>Safety selected</Th><Th>Reject reason</Th></tr></thead><tbody>{trace.products.map((p) => <tr key={`${p.order}-${p.product_fingerprint}`} className="border-t border-divider/60 align-top"><Td>{p.order}</Td><Td><span className="font-medium text-heading">{p.title}</span></Td><Td>{p.merchant || "—"}</Td><Td>{p.price == null ? "—" : `₹${p.price}`}</Td><Td><Status value={p.decision} /></Td><Td><Status value={p.response_status} /></Td><Td>{p.ingredient_count ?? "—"}</Td><Td>{p.ingredient_confidence ?? "—"}</Td><Td>{p.overall_confidence ?? "—"}</Td><Td>{p.winning_tier || p.extraction_method || "—"}</Td><Td>{p.selected_for_safety ? "Yes" : "No"}</Td><Td>{p.reject_reason || "—"}</Td></tr>)}</tbody></table></div></div>
          <div className="rounded-lg border border-divider bg-background"><button type="button" onClick={() => setShowSources((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left"><span className="font-semibold text-heading">Ingredient source observations ({trace.ingredient_sources.length})</span>{showSources ? <ChevronDown className="h-4 w-4 text-body" /> : <ChevronRight className="h-4 w-4 text-body" />}</button>{showSources && <div className="overflow-x-auto border-t border-divider"><table className="min-w-[1000px] w-full text-left text-xs"><thead className="text-body"><tr><Th>Product</Th><Th>Source</Th><Th>Priority</Th><Th>Method</Th><Th>Confidence</Th><Th>Verified</Th><Th>Ingredients</Th></tr></thead><tbody>{trace.ingredient_sources.map((s, i) => <tr key={`${s.product_fingerprint}-${i}`} className="border-t border-divider/60"><Td>{s.product_name || s.product_fingerprint}</Td><Td>{[s.source_type, s.source_name].filter(Boolean).join(" · ") || "—"}</Td><Td>{s.source_priority ?? "—"}</Td><Td>{s.extraction_method || "—"}</Td><Td>{s.confidence ?? "—"}</Td><Td>{s.verified ? "Yes" : "No"}</Td><Td>{s.ingredient_count}</Td></tr>)}</tbody></table></div>}</div>
          {trace.final_response_summary && <div className="rounded-lg border border-divider bg-background p-4"><h3 className="mb-3 font-bold text-heading">Final response summary</h3><Outcome value={trace.final_response_summary} /></div>}
        </div>}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-2 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-3 py-2 text-body">{children}</td>; }
