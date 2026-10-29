import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { HeaderInstallShortcut } from "@/components/HeaderInstallShortcut";
import { ShortlistPanel } from "@/components/ShortlistPanel";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const MOBILE_NAV = [
  { to: "/" as const, label: "Home" },
  { to: "/check-my-label" as const, label: "Check My Label" },
  { to: "/guidelines" as const, label: "Guidelines" },
  { to: "/contact" as const, label: "Contact Us" },
];

const desktopLinkClass =
  "border-b-2 border-transparent px-1 py-2 text-sm font-medium text-body transition hover:text-brand-blue lg:text-base";

export function Header() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const homeFrame = pathname === "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-divider bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div
        className={`mx-auto grid h-16 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 transition-[max-width] duration-200 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-5 lg:px-6 ${homeFrame ? "max-w-[1180px]" : "max-w-[1560px]"}`}
      >
        <Link
          to="/"
          className="block w-[150px] min-w-0 select-none justify-self-start rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-brand-blue/70 sm:w-[190px] lg:w-[230px]"
          aria-label="SafeProducts home"
        >
          <img
            src="/safeproducts-header-logo.webp"
            alt="SafeProducts.in — Indian Regulatory Intelligence"
            className="block h-auto w-full scale-x-[0.96] object-contain"
          />
        </Link>

        <nav className="hidden items-center justify-center gap-6 md:flex lg:gap-10" aria-label="Primary navigation">
          <Link
            to="/"
            className={desktopLinkClass}
            activeOptions={{ exact: true }}
            activeProps={{ className: "border-brand-blue text-brand-blue" }}
          >
            Home
          </Link>
          <Link
            to="/check-my-label"
            className={desktopLinkClass}
            activeProps={{ className: "border-brand-blue text-brand-blue" }}
          >
            Check My Label
          </Link>
          <Link
            to="/guidelines"
            className={desktopLinkClass}
            activeProps={{ className: "border-brand-blue text-brand-blue" }}
          >
            Guidelines
          </Link>
          <Link
            to="/contact"
            className={desktopLinkClass}
            activeProps={{ className: "border-brand-blue text-brand-blue" }}
          >
            Contact Us
          </Link>
        </nav>

        <div className="justify-self-end md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-divider text-body transition hover:border-brand-blue/40 hover:text-brand-blue"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>

            <SheetContent side="right" className="bg-background">
              <SheetHeader>
                <SheetTitle>SafeProducts</SheetTitle>
              </SheetHeader>

              <nav className="mt-6 flex flex-col gap-2">
                {MOBILE_NAV.map((item) => (
                  <SheetClose asChild key={item.label}>
                    <Link
                      to={item.to}
                      className="rounded-lg border border-white/5 px-4 py-3 text-sm font-semibold text-heading transition hover:border-brand-blue/30 hover:bg-white/[0.03] hover:text-brand-blue"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 self-stretch justify-self-end sm:flex-row sm:gap-2">
          <ShortlistPanel />
          <HeaderInstallShortcut />
        </div>
      </div>
    </header>
  );
}
