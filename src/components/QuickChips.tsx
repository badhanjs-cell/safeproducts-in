import { useNavigate } from "@tanstack/react-router";

const CHIPS = [
  "Multivitamins",
  "Sunscreen",
  "Baby Lotion",
  "Protein Powder",
  "Probiotics",
  "Iron Supplement",
  "Vitamin D",
  "Omega 3",
  "Baby Oil",
];

export function QuickChips() {
  const navigate = useNavigate();

  return (
    <section className="mx-auto w-full max-w-[1240px] overflow-hidden pb-1">
      <div className="flex w-full flex-nowrap items-center justify-center gap-2 px-1">
        <p className="mr-1 shrink-0 whitespace-nowrap text-[13px] font-semibold text-slate-300">
          Popular searches:
        </p>

        {CHIPS.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() =>
              navigate({
                to: "/",
                search: { q: term, profile: "ALL", browse: "" },
              })
            }
            className="shrink-0 whitespace-nowrap rounded-full border border-brand-blue/75 bg-brand-blue/10 px-3 py-1.5 text-[12px] font-semibold text-sky-300 shadow-sm transition hover:border-brand-blue hover:bg-brand-blue hover:text-slate-950"
          >
            {term}
          </button>
        ))}
      </div>
    </section>
  );
}
