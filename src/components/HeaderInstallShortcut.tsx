import { useRouterState } from "@tanstack/react-router";
import { Download, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { usePwaInstall } from "@/components/PwaInstallProvider";

type InstallPlatform = "android" | "ios" | "desktop";

function platform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || touchMac) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isPreviewEnvironment() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  return inIframe || host.includes("id-preview--") || host.includes("lovableproject.com");
}

const FULL_HELP = {
  android: {
    title: "Android",
    steps: [
      "Open SafeProducts on the deployed site in Chrome, Edge, or another install-capable browser.",
      "If the browser offers Install SafeProducts, tap Install.",
      "If no prompt appears, open the browser menu and choose Install app or Add to Home screen.",
      "Confirm Install/Add. The SafeProducts icon will appear on your Home Screen.",
    ],
  },
  ios: {
    title: "iPhone / iPad",
    steps: [
      "Open SafeProducts in Safari.",
      "Tap the Share button in Safari, then scroll down through the action list.",
      "If Add to Home Screen is visible, tap it. If it is missing, scroll to the bottom, tap Edit Actions, and add Add to Home Screen to Favorites.",
      "Return to the Share sheet, choose Add to Home Screen, then tap Add. The SafeProducts icon will appear on your Home Screen.",
    ],
  },
  desktop: {
    title: "Desktop",
    steps: [
      "Open SafeProducts on the deployed site in Chrome or Edge.",
      "Use the install icon in the address bar when it appears.",
      "If no icon appears, open the browser menu and choose Install SafeProducts / Install app.",
      "In Safari on supported macOS versions, use File → Add to Dock.",
    ],
  },
} as const;

export function HeaderInstallShortcut() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { installed, installAvailable, promptInFlight, requestInstall } = usePwaInstall();
  const [helpOpen, setHelpOpen] = useState(false);
  const [fullHelpOpen, setFullHelpOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const target = useMemo(() => platform(), []);
  const preview = useMemo(() => isPreviewEnvironment(), []);

  const openFullHelp = () => {
    setHelpOpen(false);
    setFullHelpOpen(true);
  };

  const install = async () => {
    if (installed) {
      setMessage("SafeProducts is already installed on this device.");
      setHelpOpen(true);
      return;
    }

    if (installAvailable) {
      // Do not open a SafeProducts modal before the browser-owned install dialog.
      // All other install surfaces share promptInFlight and disappear while it is open.
      setHelpOpen(false);
      setMessage(null);
      const outcome = await requestInstall();
      if (outcome === "accepted" || outcome === "already-installed") return;
      if (outcome === "dismissed") {
        setMessage("Installation was dismissed. You can install SafeProducts later using the steps below.");
        setHelpOpen(true);
        return;
      }
      if (outcome === "error") {
        setMessage("Your browser could not open the install prompt. Use the steps below.");
        setHelpOpen(true);
        return;
      }
    }

    setMessage(
      preview
        ? "Native app installation is disabled inside the Lovable Preview. On the deployed SafeProducts site this button uses the browser install prompt whenever the browser supports it."
        : target === "ios"
          ? "Safari on iPhone/iPad does not provide the same one-tap web install prompt. Use the Share sheet steps below; if Add to Home Screen is hidden, enable it from Edit Actions."
          : "Your browser did not provide a one-tap install prompt. Use the short steps below.",
    );
    setHelpOpen(true);
  };

  if (pathname !== "/") return null;

  const shortSteps = FULL_HELP[target].steps;

  const installDialog = helpOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Install SafeProducts"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-brand-blue/30 bg-[#111C26] p-5 text-left shadow-[0_24px_70px_rgba(0,0,0,0.48)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src="/download-app-icon.png"
                  alt="SafeProducts"
                  className="h-12 w-12 rounded-xl object-cover ring-1 ring-brand-blue/35"
                />
                <div>
                  <p className="text-base font-extrabold text-white">Install SafeProducts</p>
                  <p className="mt-0.5 text-xs text-slate-300">Add SafeProducts to this device for faster access.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="Close install instructions"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {message && (
              <p className="mt-4 rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-3 py-2.5 text-xs leading-relaxed text-slate-200">
                {message}
              </p>
            )}

            {!installed && (
              <ol className="mt-4 space-y-3">
                {shortSteps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-slate-200">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/15 text-xs font-extrabold text-brand-blue">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {!installed && installAvailable && (
                <button
                  type="button"
                  onClick={() => {
                    setHelpOpen(false);
                    void install();
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-extrabold text-slate-950 transition hover:brightness-110"
                >
                  <Download className="h-4 w-4" /> Install Now
                </button>
              )}

              {!installed && (
                <button
                  type="button"
                  onClick={openFullHelp}
                  className="flex-1 rounded-lg border border-brand-blue/45 bg-brand-blue/10 px-4 py-2.5 text-sm font-bold text-brand-blue transition hover:bg-brand-blue hover:text-slate-950"
                >
                  Show Full Install Help
                </button>
              )}

              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white"
              >
                {installed ? "Done" : "Close"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  const fullHelpDialog = fullHelpOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          className="fixed inset-0 z-[1010] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Full SafeProducts install help"
          onClick={() => setFullHelpOpen(false)}
        >
          <div
            className="my-auto w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-brand-blue/35 bg-[#111C26] p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.52)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-extrabold text-white">SafeProducts Installation Help</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">
                  Choose your device below. Installation is performed by the browser and cannot be completed silently by a website.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFullHelpOpen(false)}
                aria-label="Close full install help"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {preview && (
              <p className="mt-4 rounded-xl border border-orange-400/25 bg-orange-400/10 px-4 py-3 text-sm leading-relaxed text-orange-100">
                Lovable Preview disables native PWA installation. Test the actual browser install prompt from the deployed HTTPS SafeProducts site.
              </p>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {(Object.keys(FULL_HELP) as InstallPlatform[]).map((key) => (
                <section
                  key={key}
                  className={`rounded-xl border p-4 ${key === target ? "border-brand-blue/60 bg-brand-blue/10" : "border-white/15 bg-white/[0.03]"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-white">{FULL_HELP[key].title}</h3>
                    {key === target && (
                      <span className="rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-blue">This device</span>
                    )}
                  </div>
                  <ol className="mt-3 space-y-2.5">
                    {FULL_HELP[key].steps.map((step, index) => (
                      <li key={step} className="flex gap-2 text-xs leading-relaxed text-slate-200">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-extrabold text-white">{index + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setFullHelpOpen(false)}
                className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-extrabold text-slate-950 transition hover:brightness-110"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        disabled={promptInFlight}
        aria-label={installed ? "SafeProducts is installed" : "Download SafeProducts app"}
        title={installed ? "SafeProducts is installed" : "Install SafeProducts on this device"}
        className="group flex h-10 min-w-[124px] flex-col items-center justify-center rounded-xl border border-brand-blue/55 bg-[#111C26] px-3 py-1 text-[11px] font-extrabold leading-none text-slate-100 shadow-[0_4px_14px_rgba(56,189,248,0.16)] transition-all duration-200 hover:border-brand-blue/90 hover:bg-[#162633] hover:text-brand-blue hover:shadow-[0_5px_18px_rgba(56,189,248,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/60 disabled:cursor-wait disabled:opacity-70"
      >
        <span className="mb-[2px] grid h-[21px] w-[21px] place-items-center overflow-hidden rounded-[5px] bg-slate-950 shadow-[0_0_11px_rgba(56,189,248,0.28)] ring-1 ring-brand-blue/40 transition group-hover:ring-brand-blue/80">
          <img src="/download-app-icon.png" alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </span>
        <span className="whitespace-nowrap tracking-[0.015em]">
          {installed ? "Installed" : promptInFlight ? "Installing…" : target === "ios" ? "Install on iPhone" : "Download App"}
        </span>
      </button>

      {installDialog}
      {fullHelpDialog}
    </>
  );
}
