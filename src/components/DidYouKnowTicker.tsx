import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Insight = { category: string; message: string };

const EVERGREEN: Insight[] = [
  { category: "Labels", message: "Read the full ingredient list, not only the front-of-pack claims. Marketing words and ingredient evidence answer different questions." },
  { category: "Supplements", message: "Compare the amount per serving with the serving size. Two products with the same bottle size can deliver very different daily doses." },
  { category: "Dose", message: "More is not automatically better with vitamins and minerals. Check the stated daily dose and avoid stacking several products with the same nutrient." },
  { category: "Sunscreen", message: "SPF mainly describes UVB protection. For broader sun protection, also check the product's stated UVA or broad-spectrum claim and use directions." },
  { category: "Children", message: "An adult formulation is not automatically suitable for a child. Use age-specific directions and check the ingredient and dose information before use." },
  { category: "Pregnancy", message: "Pregnancy can change which ingredients and nutrient doses are appropriate. Check the exact formulation and discuss uncertain or high-dose supplements with a qualified clinician." },
  { category: "Seniors", message: "Medicines and supplements can interact. For older adults taking regular medicines, check the complete ingredient list rather than relying on the product category alone." },
  { category: "Allergens", message: "Fragrance, flavour and botanical blends can contain multiple components. If you have a known sensitivity, look for the specific allergen information and full label." },
  { category: "Expiry", message: "Check the expiry or best-before date, batch details and storage instructions. A well-formulated product can still become unsuitable if it is expired or badly stored." },
  { category: "Storage", message: "Heat, humidity and direct sunlight can affect some cosmetics and supplements. Follow the manufacturer's storage directions after opening." },
  { category: "Marketplace", message: "When buying online, verify the product name, pack size, seller or merchant, manufacturer details and label image before comparing prices." },
  { category: "Evidence", message: "A missing or unresolved ingredient record means evidence is incomplete; it does not by itself prove that an ingredient is safe or unsafe." },
  { category: "Cosmetics", message: "For a new cosmetic, follow the label directions and stop use if irritation occurs. A product's suitability can differ from person to person." },
  { category: "Probiotics", message: "For probiotics, the named strain, stated amount and storage conditions can matter as much as the word “probiotic” on the front label." },
  { category: "Protein", message: "For protein products, compare protein per serving, serving size, added ingredients and total price rather than judging only by the pack weight." },
  { category: "Minerals", message: "Mineral supplements may list a compound and an elemental amount. The elemental amount is often the more useful number for comparing nutrient quantity." },
  { category: "Price", message: "A lower sticker price is not always the lowest cost per useful serving. Compare pack size, serving count and current merchant price together." },
  { category: "Profiles", message: "SafeProducts profile filters change the context of the safety check. A general result should not be assumed to answer a pregnancy, child or senior-specific question." },
  { category: "Regulation", message: "Regulatory limits and evidence can depend on the ingredient, concentration, product type and jurisdiction. A single ingredient name rarely tells the whole story." },
  { category: "Safety Score", message: "A SafeProducts safety score is an informational assessment based on available evidence; it is not a medical diagnosis or a legal compliance certificate." },
];

function dedupeInsights(items: Insight[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.message.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function DidYouKnowTicker() {
  const [facts, setFacts] = useState<Insight[]>(EVERGREEN);
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    supabase
      .from("sp_web_site_announcements_v1")
      .select("message")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const announcements: Insight[] = (data || [])
          .map((row) => typeof row.message === "string" ? row.message.trim() : "")
          .filter(Boolean)
          .map((message) => ({ category: "Update", message }));
        setFacts(dedupeInsights([...announcements, ...EVERGREEN]));
        setI(0);
      });
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setI((x) => (x + 1) % Math.max(facts.length, 1));
        setFade(true);
      }, 300);
    }, 6000);
    return () => clearInterval(t);
  }, [facts.length]);

  const current = facts[i] ?? EVERGREEN[0];

  return (
    <section className="relative overflow-hidden rounded-xl border border-brand-blue/30 border-l-[3px] border-l-brand-blue bg-[#182630] px-5 py-4 shadow-[0_10px_28px_rgba(2,6,23,0.28)]">
      <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-24 w-24 bg-brand-blue/10 blur-2xl" />
      <div className="relative flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-blue sm:text-xs">Health Insight</span>
          <span className="rounded-full border border-brand-blue/30 bg-brand-blue/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-300 sm:text-[11px]">{current.category}</span>
        </div>
        <p className={`text-[13px] font-medium italic leading-[1.65] text-slate-200 transition-opacity duration-300 sm:text-[15px] ${fade ? "opacity-100" : "opacity-0"}`}>
          {current.message}
        </p>
      </div>
    </section>
  );
}
