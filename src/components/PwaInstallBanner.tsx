import { useEffect, useState } from "react";

import { usePwaInstall } from "@/components/PwaInstallProvider";

const STORAGE_KEY = "sp_pwa_dismissed_until";
const DELAY_MS = 30_000;
const DISMISS_DAYS = 7;

function isDismissed() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return false;
    return Date.now() < Number(value);
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(until));
  } catch {
    /* ignore */
  }
}

export function PwaInstallBanner() {
  const { installed, installAvailable, promptInFlight, isIos, requestInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (installed || promptInFlight || isDismissed()) {
      setVisible(false);
      return;
    }

    if (!isIos && !installAvailable) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [installed, installAvailable, promptInFlight, isIos]);

  if (!visible || installed || promptInFlight) return null;

  const handleInstall = async () => {
    // Hide our reminder before opening the browser-owned confirmation dialog so the
    // user never sees two competing install surfaces at the same time.
    setVisible(false);
    const outcome = await requestInstall();
    if (outcome === "accepted" || outcome === "already-installed") dismiss();
  };

  const handleNotNow = () => {
    dismiss();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Install SafeProducts"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 md:inset-x-auto md:bottom-4 md:right-4 md:w-[360px] md:p-0"
    >
      <div
        className="mx-auto flex max-w-md flex-col gap-3 rounded-lg p-4 shadow-lg"
        style={{ backgroundColor: "#1C2B3A", color: "#ffffff" }}
      >
        <div className="flex items-center gap-3">
          <img src="/download-app-icon.png" alt="" aria-hidden className="h-11 w-11 rounded-lg object-cover" />
          <div>
            <p className="text-sm font-bold">Add SafeProducts to your device</p>
            <p className="mt-0.5 text-xs text-white/75">Open SafeProducts quickly from your home screen or desktop.</p>
          </div>
        </div>

        {isIos ? (
          <p className="rounded-md border border-white/10 px-3 py-2 text-xs text-white/90">
            On iPhone or iPad: tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="text-xs text-white/80">Install the SafeProducts app icon without changing how the website works.</p>
        )}

        <div className="flex gap-2">
          {isIos ? (
            <button
              onClick={handleNotNow}
              className="flex-1 rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Got It
            </button>
          ) : (
            <button
              onClick={() => void handleInstall()}
              disabled={!installAvailable}
              className="flex-1 rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Install SafeProducts
            </button>
          )}
          {!isIos && (
            <button
              onClick={handleNotNow}
              className="rounded-md border border-white/20 px-3 py-2 text-sm text-white"
            >
              Not Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
