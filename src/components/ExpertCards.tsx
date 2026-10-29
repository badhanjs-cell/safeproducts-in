export function ExpertCards() {
  const cards = [
    { icon: "🔬", title: "Decode Every Label", body: "Ingredient names are complex by design. SafeProducts translates regulatory science into a simple safety score." },
    { icon: "👨‍👩‍👧‍👦", title: "Built for Every Profile", body: "What is safe for an adult may not be safe for your child or elderly parent. Profile-based scoring checks safety for who will use it." },
    { icon: "🏛️", title: "Regulatory Intelligence + Pharmacy Expertise", body: "Safety intelligence uses identified Government of India regulatory and guidance sources through SafeProducts' independent analytical methodology, informed by doctoral-level pharmacy expertise. SafeProducts does not claim government endorsement or certification." },
  ];

  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-brand-blue/30 bg-[#182630] p-5 shadow-[0_10px_28px_rgba(2,6,23,0.28)] transition hover:border-brand-blue/45 hover:bg-[#1B2A35]"
        >
          <div className="text-[27px]">{card.icon}</div>
          <h3 className="mt-3 text-[17px] font-extrabold text-brand-blue">{card.title}</h3>
          <p className="mt-2 text-[14px] leading-[1.65] text-slate-200 sm:text-[15px]">{card.body}</p>
        </div>
      ))}
    </section>
  );
}
