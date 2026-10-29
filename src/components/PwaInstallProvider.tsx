import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };
export type PwaInstallOutcome = "accepted" | "dismissed" | "unavailable" | "already-installed" | "error";

const INSTALLED_KEY = "sp_pwa_installed_v1";

type PwaInstallContextValue = {
  installed: boolean;
  installAvailable: boolean;
  promptInFlight: boolean;
  isIos: boolean;
  isAndroid: boolean;
  requestInstall: () => Promise<PwaInstallOutcome>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

function readInstalledFlag() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeInstalledFlag(installed: boolean) {
  try {
    if (installed) localStorage.setItem(INSTALLED_KEY, "1");
    else localStorage.removeItem(INSTALLED_KEY);
  } catch {
    // Storage can be unavailable in private/restricted browsing. Runtime state remains authoritative.
  }
}

function detectIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || touchMac;
}

function detectAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [promptInFlight, setPromptInFlight] = useState(false);
  const promptInFlightRef = useRef(false);
  const isIos = useMemo(() => detectIos(), []);
  const isAndroid = useMemo(() => detectAndroid(), []);

  useEffect(() => {
    const standalone = isStandalone();
    setInstalled(standalone || readInstalledFlag());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      const prompt = event as BeforeInstallPromptEvent;
      setDeferred(prompt);
      setPromptInFlight(false);
      promptInFlightRef.current = false;

      // If the browser offers installation again, any remembered "installed" flag is stale
      // (for example, after the user uninstalls the PWA).
      if (!isStandalone()) {
        writeInstalledFlag(false);
        setInstalled(false);
      }
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setPromptInFlight(false);
      promptInFlightRef.current = false;
      writeInstalledFlag(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const requestInstall = async (): Promise<PwaInstallOutcome> => {
    if (installed || isStandalone()) return "already-installed";
    if (!deferred) return "unavailable";
    if (promptInFlightRef.current) return "unavailable";

    promptInFlightRef.current = true;
    setPromptInFlight(true);
    const prompt = deferred;

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setDeferred(null);
      promptInFlightRef.current = false;
      setPromptInFlight(false);

      if (choice.outcome === "accepted") {
        setInstalled(true);
        writeInstalledFlag(true);
        return "accepted";
      }
      return "dismissed";
    } catch {
      setDeferred(null);
      promptInFlightRef.current = false;
      setPromptInFlight(false);
      return "error";
    }
  };

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      installed,
      installAvailable: Boolean(deferred) && !installed,
      promptInFlight,
      isIos,
      isAndroid,
      requestInstall,
    }),
    [deferred, installed, promptInFlight, isIos, isAndroid],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) throw new Error("usePwaInstall must be used inside PwaInstallProvider");
  return context;
}
