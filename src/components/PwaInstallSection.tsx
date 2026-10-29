import { useState } from "react";
import { CheckCircle2, Copy, Download, ExternalLink, MonitorDown, Share2, Smartphone } from "lucide-react";

import { usePwaInstall } from "@/components/PwaInstallProvider";

type InstallHelp = "android" | "ios" | "desktop" | null;

const HELP_TEXT: Record<Exclude<InstallHelp, null>, { title: string; steps: string[] }> = {
  android: {
    title: "Install on Android",
    steps: [
      "Open SafeProducts in Chrome or another supported browser.",
      "Tap Install when the browser offers it. If no prompt appears, open the browser menu.",
      "Choose Install app or Add to Home screen, then confirm.",
    ],
  },
  ios: {
    title: "Install on iPhone / iPad",
    steps: [
      "Open SafeProducts in Safari.",
      "Tap the Share button in Safari.",
      "Choose Add to Home Screen, then tap Add.",
    ],
  },
  desktop: {
    title: "Install on Desktop",
    steps: [
      "Open SafeProducts in Chrome, Edge, or another install-capable browser.",
      "Use the install icon in the address bar when available.",
      "If no icon appears, open the browser menu and choose Install SafeProducts / Install app.",
    ],
  },
};

export function PwaInstallSection() {
  const { installed, installAvailable, promptInFlight, isIos, isAndroid, requestInstall } = usePwaInstall();
  const [help, setHelp] = useState<InstallHelp>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const install = async () => {
    if (installed) {
      setNotice("SafeProducts is already installed on this device.");
      return;
    }
    if (!installAvailable) {
      setHelp(isIos ? "ios" : isAndroid ? "android" : "desktop");
      setNotice("Your browser did not expose a one-tap install prompt. Use the steps shown below.");
      return;
    }

    setNotice(null);
    const outcome = await requestInstall();
    if (outcome === "accepted" || outcome === "already-installed") {
      setHelp(null);
      setNotice("SafeProducts has been installed on this device.");
    } else if (outcome === "dismissed") {
      setNotice("Installation was dismissed. You can try again at any time.");
    } else if (outcome === "error") {
      setHelp(isIos ? "ios" : isAndroid ? "android" : "desktop");
      setNotice("Your browser could not open the install prompt. Use the steps shown below.");
    }
  };

  const showPlatformHelp = (platform: Exclude<InstallHelp, null>) => {
    if ((platform === "android" || platform === "desktop") && installAvailable) {
      void install();
      return;
    }
    setHelp((current) => (current === platform ? null : platform));
    setNotice(null);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText("https://safeproducts.in");
      setNotice("SafeProducts link copied.");
    } catch {
      setNotice("Copy is not available in this browser. Open safeproducts.in directly.");
    }
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "SafeProducts", text: "Open SafeProducts", url: "https://safeproducts.in" });
        setNotice("SafeProducts link shared.");
      } else {
        await copyLink();
      }
    } catch {
      // User cancellation should not be treated as an error.
    }
  };

  const currentHelp = help ? HELP_TEXT[help] : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-xl sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_auto_1fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-blue">SafeProducts on every device</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Add SafeProducts to your Home Screen</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
            Install the web app for faster access to search, label checks, shortlist and safety results without changing the website experience.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {!installed ? (
              <button
                type="button"
                onClick={() => void install()}
                disabled={promptInFlight}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-extrabold text-slate-950 shadow-sm hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
              >
                <Download className="h-4 w-4" /> {promptInFlight ? "Installing…" : installAvailable ? "Install SafeProducts" : "Install / Show Steps"}
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-safe/40 bg-safe/10 px-4 py-2.5 text-sm font-bold text-safe">
                <CheckCircle2 className="h-4 w-4" /> SafeProducts is installed
              </span>
            )}
            <a
              href="https://safeproducts.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand-blue/60 hover:bg-white/5"
            >
              <ExternalLink className="h-4 w-4" /> Open safeproducts.in
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand-blue/60 hover:bg-white/5"
            >
              <Copy className="h-4 w-4" /> Copy Link
            </button>
            <button
              type="button"
              onClick={() => void shareLink()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand-blue/60 hover:bg-white/5"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
          {notice && <p className="mt-3 text-xs font-medium text-slate-300">{notice}</p>}
        </div>

        <a
          href="https://safeproducts.in"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto rounded-2xl bg-white p-3 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          aria-label="Open SafeProducts from QR destination"
        >
          <img src="/safeproducts-install-qr.svg" alt="QR code for safeproducts.in" className="h-[172px] w-[172px]" />
          <p className="mt-2 text-center text-[11px] font-extrabold text-slate-900">Scan to open / install</p>
        </a>

        <div className="space-y-3 text-sm text-slate-200">
          <button
            type="button"
            onClick={() => showPlatformHelp("android")}
            className="flex w-full gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-safe/50 hover:bg-white/[0.08]"
          >
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-safe" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-white">Android</p>
                <span className="text-[10px] font-bold uppercase tracking-wide text-safe">{installAvailable ? "Install" : "Steps"}</span>
              </div>
              <p className="mt-1 text-xs text-slate-300">Install app / Add to Home screen.</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => showPlatformHelp("ios")}
            className="flex w-full gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-orange-400/50 hover:bg-white/[0.08]"
          >
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#FB923C]" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-white">iPhone / iPad</p>
                <span className="text-[10px] font-bold uppercase tracking-wide text-orange-300">Steps</span>
              </div>
              <p className="mt-1 text-xs text-slate-300">Safari → Share → Add to Home Screen.</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => showPlatformHelp("desktop")}
            className="flex w-full gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-brand-blue/50 hover:bg-white/[0.08]"
          >
            <MonitorDown className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-white">Desktop</p>
                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-blue">{installAvailable ? "Install" : "Steps"}</span>
              </div>
              <p className="mt-1 text-xs text-slate-300">Browser install icon / Install SafeProducts.</p>
            </div>
          </button>

          {isIos && <p className="text-[11px] text-slate-400">This device appears to be iPhone/iPad; Safari uses Add to Home Screen rather than the Chromium install prompt.</p>}
        </div>
      </div>

      {currentHelp && (
        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-slate-200">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-extrabold text-white">{currentHelp.title}</p>
            <button type="button" onClick={() => setHelp(null)} className="text-xs font-bold text-brand-blue hover:underline">
              Hide steps
            </button>
          </div>
          <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-300">
            {currentHelp.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-extrabold text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
