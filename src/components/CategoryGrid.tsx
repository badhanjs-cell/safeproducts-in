import { useNavigate } from "@tanstack/react-router";
import { logPageView } from "@/lib/sessionId";

const CATEGORIES = [
  {
    icon: "💄",
    title: "Cosmetics",
    sub: "Creams, serums, sunscreens, moisturisers",
    browse: "cosmetics",
  },
  {
    icon: "👶",
    title: "Baby Care Products",
    sub: "Baby oils, lotions, powders, wipes",
    browse: "baby_care",
  },
  {
    icon: "🧴",
    title: "Personal Care Products",
    sub: "Shampoos, soaps, deodorants, toothpaste",
    browse: "personal_care",
  },
  {
    icon: "💊",
    title: "Health Supplements",
    sub: "Vitamins, minerals, protein, omega-3",
    browse: "health_supplements",
  },
  {
    icon: "🌿",
    title: "Nutraceuticals",
    sub: "Herbal extracts, standardized botanicals, immunity",
    browse: "nutraceuticals",
  },
  {
    icon: "🍼",
    title: "Special Dietary Products",
    sub: "Medical nutrition, diabetic formulas, maternal nutrition",
    browse: "special_dietary",
  },
  {
    icon: "🦠",
    title: "Probiotics",
    sub: "Live beneficial strains, gut health, microflora",
    browse: "probiotics",
  },
] as const;

export function CategoryGrid() {
  const navigate = useNavigate();

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-[32px]">What Can You Check?</h2>
        <p className="mx-auto mt-2 max-w-2xl text-xs font-medium leading-relaxed text-slate-300 sm:text-sm">
          Government of India safety standards
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((category) => (
          <button
            key={category.title}
            type="button"
            onClick={() => {
              logPageView({ page: "/category", category_clicked: category.title });
              navigate({
                to: "/",
                search: { q: "", profile: "ALL", browse: category.browse },
              });
            }}
            className="group flex min-h-[132px] flex-col items-start gap-3 rounded-2xl border border-slate-500/45 bg-[#18242F] p-4 text-left shadow-[0_10px_26px_rgba(2,6,23,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#4ADE80]/45 hover:bg-[#1D2B37] hover:shadow-[0_13px_30px_rgba(2,6,23,0.34)] md:min-h-[142px] md:p-5"
          >
            <span className="text-[26px] drop-shadow-sm md:text-[30px]">{category.icon}</span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-50 transition-colors group-hover:text-[#4ADE80] md:text-[15px]">
                {category.title}
              </h3>
              <p className="mt-1.5 text-xs leading-[1.5] text-slate-300 md:text-[13px]">{category.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
