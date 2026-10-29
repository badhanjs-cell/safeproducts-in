import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";

import { HeroSearch, type Profile } from "@/components/HeroSearch";
import { CategoryGrid } from "@/components/CategoryGrid";
import { DidYouKnowTicker } from "@/components/DidYouKnowTicker";
import { ExpertCards } from "@/components/ExpertCards";
import { UploadTeaser } from "@/components/UploadTeaser";
import { QuickChips } from "@/components/QuickChips";
import { GuidelinesPreview } from "@/components/GuidelinesPreview";
import { PwaInstallSection } from "@/components/PwaInstallSection";
import { SearchResults } from "@/components/SearchResults";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { orderProductsForDisplay } from "@/lib/productDisplayOrder";
import { toApiProfile, type Product } from "@/lib/searchContract";

type BrowseCategory =
  | ""
  | "all"
  | "cosmetics"
  | "skincare"
  | "baby_care"
  | "baby"
  | "personal_care"
  | "personalcare"
  | "health_supplements"
  | "supplements"
  | "nutraceuticals"
  | "special_dietary"
  | "probiotics";

type FeaturedItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  platform: string | null;
  profile_score: number | null;
  general_score: number | null;
  confidence: number | null;
  source_kind: "QUALIFIED_CACHE" | "BACKEND_CATALOG";
  display_note: string | null;
  safety_claim_available: boolean;
  category_match: boolean;
  affiliate_url: string | null;
  source_url: string | null;
};

type FeaturedPayload = {
  status: string;
  result_count: number;
  exact_category_count: number;
  results: FeaturedItem[];
};

const CATEGORY_LABELS: Record<Exclude<BrowseCategory, "">, string> = {
  all: "Featured Products",
  cosmetics: "Cosmetics",
  skincare: "Cosmetics",
  baby_care: "Baby Care Products",
  baby: "Baby Care Products",
  personal_care: "Personal Care Products",
  personalcare: "Personal Care Products",
  health_supplements: "Health Supplements",
  supplements: "Health Supplements",
  nutraceuticals: "Nutraceuticals",
  special_dietary: "Special Dietary Products",
  probiotics: "Probiotics",
};

const indexSearchSchema = z.object({
  q: z.string().catch(""),
  profile: z.enum(["ALL", "Children", "Pregnant Women", "Pregnant Woman", "Seniors"]).catch("ALL"),
  browse: z
    .enum(["", "all", "cosmetics", "skincare", "baby_care", "baby", "personal_care", "personalcare", "health_supplements", "supplements", "nutraceuticals", "special_dietary", "probiotics"])
    .catch(""),
});

export const Route = createFileRoute("/")({
  validateSearch: indexSearchSchema,
  head: () => ({
    meta: [
      { title: "SafeProducts — Know What's Safe Before You Buy" },
      {
        name: "description",
        content:
          "Check cosmetics, supplements, nutraceuticals and food against Government of India safety regulations. Free, independent.",
      },
    ],
  }),
  component: Index,
});

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function httpsValue(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function parseFeaturedItem(raw: unknown): FeaturedItem | null {
  const item = objectValue(raw);
  const id = textValue(item.id);
  const name = textValue(item.name);
  const sourceKind = textValue(item.source_kind);
  if (!id || !name) return null;
  if (sourceKind !== "QUALIFIED_CACHE" && sourceKind !== "BACKEND_CATALOG") return null;

  const profileScore = numberValue(item.profile_score);
  const safetyAvailable = item.safety_claim_available === true && profileScore !== null;

  return {
    id,
    name,
    brand: textValue(item.brand),
    category: textValue(item.category),
    image_url: httpsValue(item.image_url),
    price: numberValue(item.price),
    currency: textValue(item.currency),
    platform: textValue(item.platform),
    profile_score: safetyAvailable ? profileScore : null,
    general_score: safetyAvailable ? numberValue(item.general_score) : null,
    confidence: safetyAvailable ? numberValue(item.confidence) : null,
    source_kind: sourceKind,
    display_note: textValue(item.display_note),
    safety_claim_available: safetyAvailable,
    category_match: item.category_match === true,
    affiliate_url: httpsValue(item.affiliate_url),
    source_url: httpsValue(item.source_url),
  };
}

function parseFeaturedPayload(raw: unknown): FeaturedPayload {
  const result = objectValue(raw);
  const rows = Array.isArray(result.results)
    ? result.results.map(parseFeaturedItem).filter((item): item is FeaturedItem => item !== null).slice(0, 10)
    : [];

  return {
    status: textValue(result.status) ?? "UNAVAILABLE",
    result_count: numberValue(result.result_count) ?? rows.length,
    exact_category_count: numberValue(result.exact_category_count) ?? rows.filter((item) => item.category_match).length,
    results: rows,
  };
}

function toProduct(item: FeaturedItem, profile: Profile): Product {
  const apiProfile = toApiProfile(profile);
  const assessed = item.safety_claim_available && item.profile_score !== null;
  const profileSafety: Record<string, number | null> = {
    all: assessed ? item.general_score : null,
    children: null,
    pregnant: null,
    seniors: null,
  };
  if (assessed) profileSafety[apiProfile] = item.profile_score;
  if (assessed && apiProfile === "all") profileSafety.all = item.profile_score;

  const buyUrl = item.source_url ?? item.affiliate_url;
  const validPrice = item.price !== null && item.price > 0 ? item.price : null;
  const validCurrency = item.currency?.toUpperCase() ?? "INR";
  const cached = item.source_kind === "QUALIFIED_CACHE";

  return {
    id: item.id,
    name: item.name,
    brand: item.brand,
    category: item.category ?? "",
    evaluated_profile: apiProfile,
    platform: item.platform,
    price: validPrice,
    currency: validCurrency,
    image_url: item.image_url,
    ingredients: null,
    safety_score: assessed ? item.general_score : null,
    profile_score: assessed ? item.profile_score : null,
    profile_safety: profileSafety,
    warnings: [],
    recommendation: null,
    confidence: assessed ? item.confidence : null,
    source_url: item.source_url,
    affiliate_link: buyUrl,
    production_qualified: assessed,
    badges: { safest: false, lowestPrice: false, bestValue: false },
    display_eligible: true,
    display_basis: assessed ? "SAFETY_QUALIFIED" : "PRICE_ONLY_FALLBACK",
    safety_determined: assessed,
    safety_status_label: assessed ? (cached ? "Cached qualified safety assessment" : "Stored SafeProducts safety assessment") : null,
    safety_unavailable_reason: null,
    price_text: validPrice?.toLocaleString("en-IN") ?? null,
    assessment_display_label: assessed ? (cached ? "Cached qualified assessment" : "Stored backend assessment") : null,
    assessment_source: assessed ? "SafeProducts backend" : null,
    assessment_disclaimer: item.display_note,
  };
}

function FeaturedProducts({ profile, category }: { profile: Profile; category: BrowseCategory }) {
  const [payload, setPayload] = useState<FeaturedPayload>({
    status: "LOADING",
    result_count: 0,
    exact_category_count: 0,
    results: [],
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setPayload((previous) => ({ ...previous, status: "LOADING" }));

    (supabase as any)
      .rpc("sp_web_featured_products_v1_2", {
        p_profile: profile,
        p_category: category || "all",
        p_limit: 10,
      })
      .then(({ data, error: rpcError }: { data: unknown; error: unknown }) => {
        if (!active) return;
        if (rpcError) {
          setError("Featured products are temporarily unavailable. Please use search.");
          setPayload({ status: "UNAVAILABLE", result_count: 0, exact_category_count: 0, results: [] });
          return;
        }
        const parsed = parseFeaturedPayload(data);
        setPayload(parsed);
        if (parsed.results.length === 0) setError("No backend products are available for this view yet. Please search for a product.");
      });

    return () => { active = false; };
  }, [profile, category]);

  // The versioned browse RPC is the relevance authority. Do not re-filter its
  // vetted profile/category result set in the browser: the historic 8–10-card
  // contract intentionally includes profile-relevant supplements/nutrition
  // whose titles do not literally contain "senior", "pregnant", etc.
  const visibleProducts = useMemo(
    () => orderProductsForDisplay(
      payload.results.map((item) => toProduct(item, profile)),
    ),
    [payload.results, profile],
  );

  const heading = category !== "" && category !== "all"
    ? CATEGORY_LABELS[category]
    : profile === "ALL" ? "Featured Products" : `${profile} Picks`;

  if (payload.status === "LOADING") {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-body">
        <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
        Loading current SafeProducts picks…
      </div>
    );
  }

  if (error && payload.results.length === 0) {
    return <div className="mx-auto max-w-[1240px] rounded-xl border border-divider bg-card p-6 text-center"><p className="text-sm text-body">{error}</p></div>;
  }

  if (visibleProducts.length === 0) {
    return (
      <div className="mx-auto max-w-[1240px] rounded-xl border border-divider bg-card p-6 text-center">
        <p className="text-sm text-body">No profile-relevant backend products are available for this view yet. Please search for a specific product.</p>
      </div>
    );
  }

  const hasSafetyQualified = visibleProducts.some((product) => product.display_basis === "SAFETY_QUALIFIED");
  const lowestPricedId = visibleProducts.find((product, index) =>
    (!hasSafetyQualified || index > 0) && product.price !== null && product.price > 0,
  )?.id ?? null;
  const isRealCategory = category !== "" && category !== "all";

  return (
    <section className="mx-auto max-w-[1240px] space-y-6">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-blue">Browse before searching</p>
        <h2 className="mt-2 text-2xl font-bold text-heading">{heading}</h2>
      </div>

      {isRealCategory && payload.exact_category_count < payload.result_count && (
        <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-xs leading-relaxed text-body">
          Category coverage is still expanding. Showing direct category matches plus additional SafeProducts catalogue picks relevant to this view.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1180px]:grid-cols-3">
        {visibleProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            p={product}
            profile={profile}
            safest={hasSafetyQualified && index === 0 && product.display_basis === "SAFETY_QUALIFIED"}
            bestPrice={lowestPricedId !== null && product.id === lowestPricedId}
          />
        ))}
      </div>
    </section>
  );
}

function Index() {
  const { q, profile, browse } = Route.useSearch();
  const navigate = useNavigate();
  const [fading, setFading] = useState(false);
  const hasLiveSearch = q.trim().length > 0;
  const hasBrowse = !hasLiveSearch && (browse !== "" || profile !== "ALL");
  const showResults = hasLiveSearch || hasBrowse;

  const handleSubmit = (newQ: string, newProfile: Profile) => {
    const trimmed = newQ.trim();
    navigate({
      to: "/",
      search: { q: trimmed, profile: newProfile, browse: trimmed ? "" : "all" },
      replace: true,
    });
  };

  const handleProfileBrowse = (newProfile: Profile) => {
    navigate({
      to: "/",
      search: { q: "", profile: newProfile, browse: "all" },
      replace: true,
    });
  };

  const newSearch = () => {
    setFading(true);
    setTimeout(() => {
      navigate({ to: "/", search: { q: "", profile: "ALL", browse: "" }, replace: true });
      setFading(false);
    }, 200);
  };

  return (
    <div className="mx-auto max-w-[1360px] space-y-10 px-4 pb-8 sm:px-6 lg:px-8">
      <section className="sticky top-16 z-40 -mx-4 space-y-3 border-b border-divider bg-background/95 px-4 pb-3 pt-3 text-center shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <h1 className="whitespace-nowrap text-[17px] font-extrabold leading-[1.15] sm:text-[24px] lg:text-[30px]">
          <span style={{ color: "#4ADE80" }}>Know What's Safe</span>{" "}
          <span style={{ color: "#FB923C" }}>Before You Buy</span>
        </h1>

        <div className="relative mx-auto w-full max-w-[1120px] [&>div>:last-child]:hidden">
          <HeroSearch
            key={`${q}::${profile}::${browse}`}
            initialQ={q}
            initialProfile={profile}
            onSubmit={handleSubmit}
            onProfileBrowse={handleProfileBrowse}
          />

          {showResults && (
            <Button
              type="button"
              onClick={newSearch}
              variant="outline"
              size="sm"
              className="absolute right-0 top-[44px] hidden border-brand-blue/50 bg-card text-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue lg:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" /> New Search
            </Button>
          )}
        </div>

        {showResults && (
          <div className="flex justify-center lg:hidden">
            <Button type="button" onClick={newSearch} variant="outline" size="sm" className="border-brand-blue/50 bg-card text-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue">
              <ArrowLeft className="h-4 w-4" /> New Search
            </Button>
          </div>
        )}
      </section>

      <div className={`pt-1 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
        {hasLiveSearch ? (
          <SearchResults q={q} profile={profile} />
        ) : hasBrowse ? (
          <FeaturedProducts profile={profile} category={browse} />
        ) : (
          <div className="space-y-10">
            <CategoryGrid />
            <DidYouKnowTicker />
            <ExpertCards />
            <UploadTeaser />
            <QuickChips />
            <GuidelinesPreview />
            <PwaInstallSection />
          </div>
        )}
      </div>
    </div>
  );
}