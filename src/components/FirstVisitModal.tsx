import { useEffect, useState } from "react";

export function FirstVisitModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("sp_visited")) setOpen(true);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 animate-fade">
      <div className="max-w-md rounded-lg border border-divider bg-card p-6 text-center">
        <h3 className="mb-3 text-lg font-bold text-brand-blue">Welcome to SafeProducts</h3>
        <p className="text-sm leading-relaxed text-body">
          SafeProducts provides independently derived product safety information for consumer awareness only.
          It is not medical advice and does not represent any government body. Consult a qualified professional before use.
        </p>
        <button
          onClick={() => { localStorage.setItem("sp_visited", "1"); setOpen(false); }}
          className="mt-5 w-full rounded-md bg-brand-blue px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}
