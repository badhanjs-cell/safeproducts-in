import { Link } from "@tanstack/react-router";
import { useState } from "react";

export function Footer() {
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <>
      <footer className="mt-20 w-full bg-footer py-5 text-center text-[13px] font-medium text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
          <span>© {year} SafeProducts.in</span>
          <span className="text-slate-600">|</span>
          <Link to="/privacy-policy" className="transition hover:text-brand-blue">
            Privacy Policy
          </Link>
          <span className="text-slate-600">|</span>
          <button type="button" onClick={() => setOpen(true)} className="transition hover:text-brand-blue">
            Platform Disclaimer
          </button>
          <span className="text-slate-600">|</span>
          <Link to="/contact" className="transition hover:text-brand-blue">
            Contact Us
          </Link>
        </div>
      </footer>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-divider bg-card p-6 text-[14px] leading-relaxed text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-xl font-extrabold text-brand-blue">Platform Disclaimer</h3>

            <div className="space-y-3 leading-[1.7]">
              <p>
                SafeProducts is an independent consumer-information and safety-intelligence platform. It is not
                affiliated with, endorsed by, or acting on behalf of any government ministry, regulatory authority,
                standards body, manufacturer, merchant, healthcare provider, or professional association.
              </p>
              <p>
                SafeProducts analyses product identity, label information, ingredient evidence, and published
                regulatory or scientific sources using its own evidence-controlled methodology. Regulatory material
                may be referenced, indexed, extracted, or interpreted for analytical purposes. Any safety score,
                warning, classification, comparison, or recommendation displayed by SafeProducts is an independent
                SafeProducts output and must not be attributed to the source regulator, manufacturer, merchant, or
                other evidence provider.
              </p>
              <p>
                A SafeProducts Safety Score is a comparative analytical index. It is not a probability that a product
                is safe, an official regulatory determination, a certificate of compliance, a government approval, or
                proof that a product complies with every applicable law, standard, licence, labelling requirement, or
                manufacturing requirement.
              </p>
              <p>
                Results depend on the identity, formulation, market, pack, label, and evidence available at the time
                of analysis. Ingredient extraction from photographs, OCR, databases, or third-party sources can be
                incomplete or inaccurate. Where evidence is incomplete, conflicting, stale, or still under research,
                SafeProducts may display a provisional or insufficient-evidence status rather than a final
                determination. Missing evidence must not be interpreted as proof that a product is either safe or
                unsafe.
              </p>
              <p>
                Regulatory rules, standards, and guidance can differ by jurisdiction and can change over time.
                SafeProducts endeavours to use current authoritative sources, but cannot guarantee that every amendment,
                interpretation, or product-specific regulatory fact is reflected immediately. Guidance documents and
                scientific references are not necessarily legally binding regulatory requirements.
              </p>
              <p>
                Information on SafeProducts is provided for consumer awareness and educational purposes and does not
                constitute medical, clinical, nutritional, pharmaceutical, legal, or other professional advice.
                Individual circumstances vary. Users should consult an appropriately qualified healthcare professional
                for personal health decisions and the relevant competent authority or qualified professional for
                regulatory or legal-compliance questions.
              </p>
              <p>
                Product names, trademarks, label images, merchant information, prices, availability, and links may
                originate from manufacturers, brand websites, user-supplied labels, or independent third parties. Their
                inclusion does not imply endorsement by those parties or by SafeProducts. Prices and availability can
                change and should be confirmed with the relevant seller before purchase.
              </p>
              <p>
                SafeProducts may receive affiliate commissions from qualifying purchases made through selected links,
                without increasing the price charged by the seller solely because of that commission.
              </p>
              <p>
                SafeProducts does not manufacture, sell, stock or fulfil products. Users remain responsible for
                purchasing and use decisions. To the maximum extent permitted by applicable law, SafeProducts provides
                its informational service without guaranteeing that every result is complete, error-free, or suitable
                for a particular individual or purpose. Nothing in this disclaimer excludes or limits any right or
                liability that cannot lawfully be excluded or limited.
              </p>
              <p>© {year} SafeProducts.in — All rights reserved.</p>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-6 rounded-md bg-brand-blue px-4 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
