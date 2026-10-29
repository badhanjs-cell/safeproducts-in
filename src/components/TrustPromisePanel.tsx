// Renders the exact backend-supplied consumer promise. Never hard-code alternative wording.
export function TrustPromisePanel({promise,notice}:{promise:string;notice?:string|null}) {
  return <div role="note" className="space-y-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3">
    <p className="text-sm font-semibold text-orange-200">{promise}</p>
    {notice && <p className="text-xs text-body">{notice}</p>}
  </div>;
}
