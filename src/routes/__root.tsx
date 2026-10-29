import { Outlet, Link, createRootRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FirstVisitModal } from "@/components/FirstVisitModal";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { PwaInstallProvider } from "@/components/PwaInstallProvider";
import { logPageView } from "@/lib/sessionId";
import { BackendIdentityGate } from "@/components/BackendIdentityGate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <BackendIdentityGate>
      <VerifiedRoot />
    </BackendIdentityGate>
  );
}

function VerifiedRoot() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = path.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) return;
    logPageView({ page: path });
  }, [path, isAdmin]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
    const host = window.location.hostname;
    const isPreview = host.includes("id-preview--") || host.includes("lovableproject.com");
    if (inIframe || isPreview) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  if (isAdmin) return <Outlet />;
  return (
    <PwaInstallProvider>
      <Header />
      <main className="min-h-[calc(100vh-180px)]">
        <Outlet />
      </main>
      <Footer />
      <FirstVisitModal />
      <PwaInstallBanner />
    </PwaInstallProvider>
  );
}
