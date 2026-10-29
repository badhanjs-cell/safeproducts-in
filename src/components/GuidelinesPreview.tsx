import { Link } from "@tanstack/react-router";

export function GuidelinesPreview() {
  const cards = [
    {
      icon: "👶",
      title: "Children",
      body: "Age-appropriate supplement, food and personal-care guidance grounded in FSSAI, BIS and ICMR-NIN sources.",
      profile: "children" as const,
    },
    {
      icon: "🤰",
      title: "Pregnant Women",
      body: "Pregnancy nutrition, supplement warnings and cosmetics guidance grounded in ICMR-NIN, FSSAI and Cosmetics Rules/CDSCO scope.",
      profile: "pregnant" as const,
    },
    {
      icon: "👴",
      title: "Senior Citizens",
      body: "Healthy-ageing nutrition, label checks and supplement-use guidance grounded in Government of India sources.",
      profile: "seniors" as const,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-slate-50 sm:text-[32px]">Safety Guidelines</h2>
        <p className="mx-auto mt-2 max-w-3xl text-[14px] leading-[1.65] text-slate-300 sm:text-[15px]">
          Consumer guidance grounded in Government of India sources, including BIS standards, Cosmetics Rules/CDSCO scope, FSSAI regulations and ICMR-NIN dietary guidance. SafeProducts does not claim government endorsement or certification.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="flex min-h-[205px] flex-col rounded-xl border border-brand-blue/30 bg-[#182630] p-5 shadow-[0_10px_28px_rgba(2,6,23,0.28)] transition hover:border-brand-blue/45 hover:bg-[#1B2A35]"
          >
            <div className="text-[27px]">{card.icon}</div>
            <h3 className="mt-3 text-[17px] font-extrabold text-slate-50">{card.title}</h3>
            <p className="mt-2 flex-1 text-[14px] leading-[1.65] text-slate-200 sm:text-[15px]">{card.body}</p>
            <Link
              to="/guidelines"
              search={{ profile: card.profile }}
              className="mt-4 text-[14px] font-extrabold text-brand-blue transition hover:text-sky-300 hover:underline"
            >
              Read Guidelines →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
