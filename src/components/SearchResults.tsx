import { MultiSourceEvidenceReview } from "@/components/MultiSourceEvidenceReview";
import { ClinicalSafetyScreen } from "@/components/ClinicalSafetyScreen";
import { useEffect, useMemo, useState } from "react";
import { ProductCard, type Product } from "@/components/ProductCard";
import { logPageView } from "@/lib/sessionId";
import type { Profile } from "@/components/HeroSearch";
import { searchProductsClient } from "@/lib/searchClient";
import {
  orderDistinctProductsForDisplay,
  orderExactMerchantOffers,
} from "@/lib/productDisplayOrder";
import type { SearchMode, SelectedPack, LabelExactPackMatch } from "@/lib/searchContract";
import { MissingWebhookNotice } from "@/components/MissingWebhookNotice";
import { TrustPromisePanel } from "@/components/TrustPromisePanel";
import { SearchProgress } from "@/components/SearchProgress";

const headingFor = (p: Profile) =>
  p === "ALL" ? "SafeProducts results" : `SafeProducts results for ${p}`;

const UNAVAILABLE_STATUSES = ["NOT_QUALIFIED", "UNAVAILABLE", "INVALID_RESPONSE", "TIMED_OUT"];

function ResultGrid({
  products,
  profile,
}: {
  products: Product[];
  profile: Profile;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1180px]:grid-cols-3">
      {products.map((p, i) => (
        <ProductCard
          key={`${p.id}-${i}`}
          p={p}
          profile={profile}
          safest={p.badges.safest === true}
          bestPrice={p.badges.lowestPrice === true}
          bestValue={p.badges.bestValue === true}
        />
      ))}
    </div>
  );
}

export function SearchResults({ q, profile }: { q: string; profile: Profile }) {
  const [results, setResults] = useState<Product[]>([]);
  const [labelExactPack, setLabelExactPack] = useState<LabelExactPackMatch | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode | null>(null);
  const [selectedPack, setSelectedPack] = useState<SelectedPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("READY");
  const [missingUrl, setMissingUrl] = useState(false);
  const [promise, setPromise] = useState<string | null>(null);
  const [promiseRequired, setPromiseRequired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResults([]);
    setLabelExactPack(null);
    setSearchMode(null);
    setSelectedPack(null);
    setLoading(true);
    setError(null);
    setMissingUrl(false);
    setPromise(null);
    setPromiseRequired(false);
    setNotice(null);
    logPageView({ page: "search", search_term: q, profile_used: profile });

    const applyResult = (res: Awaited<ReturnType<typeof searchProductsClient>>) => {
      setResults(res.results);
      setLabelExactPack(res.labelExactPack ?? null);
      setSearchMode(res.searchMode ?? "CATEGORY");
      setSelectedPack(res.selectedPack ?? null);
      setError(res.error);
      setStatus(res.status);
      setMissingUrl(false);
      setPromise(res.trustPromise);
      setPromiseRequired(res.trustPromiseDisplayRequired);
      setNotice(res.consumerNotice);
    };

    searchProductsClient({ query: q || "", profile, limit: 10 }).then(async (res) => {
      if (cancelled) return;
      if (res.results.length > 0) {
        applyResult(res);
        setLoading(false);
        // One search request per user action. Background evidence processing is
        // independently leased and cannot be triggered by automatic UI polls.
        // The consumer may explicitly submit the search again to see fresh evidence.
        return;
      }

      // v3 is the single search authority: when it returns no products, its own
      // status, error and selected pack are shown directly.
      setResults([]);
      setLabelExactPack(res.labelExactPack ?? null);
      setSearchMode(res.searchMode ?? null);
      setSelectedPack(res.selectedPack ?? null);
      setError(res.error);
      setStatus(res.status);
      setMissingUrl(res.missingUrl);
      setPromise(res.trustPromise);
      setPromiseRequired(res.trustPromiseDisplayRequired);
      setNotice(res.consumerNotice);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [q, profile]);

  const exactOffers = useMemo(
    () => orderExactMerchantOffers(results.filter((p) => p.result_group === "EXACT_OFFER")).slice(0, 5),
    [results],
  );
  const alternatives = useMemo(
    () => orderDistinctProductsForDisplay(results.filter((p) => p.result_group === "ALTERNATIVE")).slice(0, 5),
    [results],
  );
  const categoryProducts = useMemo(
    () => orderDistinctProductsForDisplay(
      results.filter((p) => p.result_group === "CATEGORY_PRODUCT" || !p.result_group),
    ).slice(0, 10),
    [results],
  );

  if (loading) return <SearchProgress resetKey={`${q}|${profile}`} />;
  if (missingUrl && results.length === 0) return <MissingWebhookNotice />;
  if (results.length === 0 && !labelExactPack) {
    const unavailable = UNAVAILABLE_STATUSES.includes(status);
    return (
      <div className="mx-auto max-w-[1240px] rounded-lg border border-divider bg-card p-8 text-center">
        <p className="text-heading">
          {unavailable
            ? error ?? "Product checks are temporarily unavailable. Please try again later."
            : "No genuine matching products are currently available. SafeProducts does not invent filler results."}
        </p>
      </div>
    );
  }

  const labelCachePanel = labelExactPack ? (
    <section className="rounded-lg border border-divider bg-card p-5" aria-label="Exact product label assessment">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-blue">Exact product and pack — saved label analysis</p>
      <h3 className="mt-1 font-bold text-heading">{labelExactPack.brand_name} {labelExactPack.product_name}</h3>
      {labelExactPack.variant_name && <p className="text-xs text-body">{labelExactPack.variant_name}</p>}
      <p className="text-xs text-body">Pack: {labelExactPack.pack_size_text}</p>
      <p className="mt-3 text-lg font-bold text-heading">
        {labelExactPack.score_status === "QUALIFIED" ? "Qualified Safety Score" : labelExactPack.score_status === "PROVISIONAL" ? "Provisional screening index" : "Numerical Safety Score unavailable"}{labelExactPack.screening_score !== null ? ": " + Math.round(labelExactPack.screening_score) + "/100" : ""}
      </p>
      {labelExactPack.score_status !== "QUALIFIED" && (
        <p className="mt-2 text-sm text-body">
          The saved label has not received a fully verified Safety Score. Missing regulatory evidence is not a safety finding.
        </p>
      )}
      <p className="mt-1 text-xs text-body">Regulatory evidence coverage: {Math.round(labelExactPack.evidence_coverage)}%. Original user photos remain private.</p>
      <div className="mt-4"><MultiSourceEvidenceReview review={labelExactPack.multi_source_review} /></div>
      <div className="mt-4"><ClinicalSafetyScreen screen={labelExactPack.clinical_screen} /></div>
    </section>
  ) : null;

  const specific = searchMode === "SPECIFIC_PRODUCT";
  const displayed = specific ? [...exactOffers, ...alternatives] : categoryProducts;
  const packLabel = selectedPack?.text?.trim() || selectedPack?.normalizedKey?.replace(":", " ") || null;

  return (
    <div className="mx-auto max-w-[1240px] space-y-6">
      {labelCachePanel}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-heading">{headingFor(profile)}</h2>
          {packLabel && <p className="mt-1 text-xs text-body">Compared pack: {packLabel}</p>}
        </div>
      </div>

      {status === "SOURCE_SHORTFALL_BELOW_SIX" && (
        <p className="rounded-md border border-divider bg-card px-4 py-3 text-xs text-body">
          Fewer than six genuine comparable products were available, so only verified matches are shown.
        </p>
      )}
      {promiseRequired && !!promise?.trim() && <TrustPromisePanel promise={promise} notice={null} />}
      {!!notice?.trim() && <p className="rounded-md border border-divider bg-card px-4 py-3 text-xs text-body">{notice}</p>}

      {specific ? (
        <>
          {exactOffers.length > 0 && (
            <section className="space-y-3" aria-label="Same product merchant comparison">
              <div>
                <h3 className="text-lg font-bold text-heading">Same product — compare prices</h3>
                <p className="mt-1 text-xs text-body">The Safety Score belongs to this exact product formula and is reused across matching merchant offers. Prices may differ.</p>
              </div>
              <ResultGrid
                products={exactOffers}
                profile={profile}
              />
            </section>
          )}
          {alternatives.length > 0 && (
            <section className="space-y-3" aria-label="Category alternatives">
              <div>
                <h3 className="text-lg font-bold text-heading">Other products in this category</h3>
                <p className="mt-1 text-xs text-body">Comparable products from other brands use their own ingredient evidence and Safety Scores when available.</p>
              </div>
              <ResultGrid
                products={alternatives}
                profile={profile}
              />
            </section>
          )}
        </>
      ) : (
        <section aria-label="Comparable products">
          <ResultGrid
            products={categoryProducts}
            profile={profile}
          />
        </section>
      )}

      {displayed.some((p) => p.safety_score === null) && (
        <p className="rounded-md border border-divider bg-card px-4 py-3 text-xs text-body">
          Products without sufficient ingredient evidence remain visible, but no Safety Score is inferred or estimated for them.
        </p>
      )}
    </div>
  );
}
