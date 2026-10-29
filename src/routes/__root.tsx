import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "verify-admitad", content: "a27360ca3f" },
      { name: "mitgo-verification", content: "1370f058-d825-4430-ad9c-a0177c53d29f" },
      { title: "SafeProducts — Know What's Safe Before You Buy" },
      {
        name: "description",
        content: "Check cosmetics, supplements, nutraceuticals and food for safety against Government of India regulations.",
      },
      { name: "author", content: "SafeProducts.in" },
      { property: "og:title", content: "SafeProducts — Know What's Safe Before You Buy" },
      {
        property: "og:description",
        content: "Check cosmetics, supplements, nutraceuticals and food for safety against Government of India regulations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SafeProducts — Know What's Safe Before You Buy" },
      {
        name: "twitter:description",
        content: "Check cosmetics, supplements, nutraceuticals and food for safety against Government of India regulations.",
      },
      {
        property: "og:image",
        content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eab2a5d2-b96e-40e9-9877-03d13e4f9332/id-preview-aba375a5--bad346a2-59b4-4f2d-895a-b30924066845.lovable.app-1778151175121.png",
      },
      {
        name: "twitter:image",
        content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eab2a5d2-b96e-40e9-9877-03d13e4f9332/id-preview-aba375a5--bad346a2-59b4-4f2d-895a-b30924066845.lovable.app-1778151175121.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/safeproducts-app-192-v2.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/safeproducts-app-192-v2.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="verify-admitad" content="a27360ca3f" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

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
