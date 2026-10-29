import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import DOMPurify from "dompurify";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { logPageView } from "@/lib/sessionId";

type Guideline = {
  id: string;
  profile: string;
  title: string;
  body: string | null;
  content: string | null;
  age_specifics: string | null;
  source_note: string | null;
};

const guidelineSearchSchema = z.object({
  profile: z.enum(["children", "pregnant", "seniors"]).catch("children"),
});

export const Route = createFileRoute("/guidelines")({
  validateSearch: guidelineSearchSchema,
  head: () => ({
    meta: [
      { title: "Safety Guidelines — SafeProducts" },
      {
        name: "description",
        content:
          "Evidence-based product safety guidance for children, pregnant women, and seniors based on Government of India regulations.",
      },
    ],
  }),
  component: GuidelinesPage,
});

const TABS = [
  { id: "children", label: "Children" },
  { id: "pregnant", label: "Pregnant Women" },
  { id: "seniors", label: "Seniors" },
] as const;

function GuidelinesPage() {
  const { profile: tab } = Route.useSearch();
  const navigate = useNavigate();

  const [items, setItems] = useState<Guideline[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logPageView({ page: "guidelines", profile_used: tab });
  }, [tab]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    supabase
      .from("sp_web_guidelines_v1")
      .select("*")
      .eq("profile", tab)
      .eq("status", "published")
      .order("display_order")
      .then(({ data }) => {
        if (!active) return;

        const rows = (data || []) as Guideline[];
        setItems(rows);
        setOpen(rows[0]?.id || null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tab]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-blue sm:text-3xl">Safety Guidelines</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-body">
          Source-grounded guidance derived from BIS standards, the Cosmetics Rules/CDSCO scope, FSSAI regulations and
          ICMR-NIN dietary guidance. Always apply the rule that matches the product category and user profile.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-divider">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() =>
              navigate({
                to: "/guidelines",
                search: { profile: tabItem.id },
                replace: true,
              })
            }
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
              tab === tabItem.id ? "border-b-2 border-brand-blue text-brand-blue" : "text-body hover:text-heading"
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && <p className="py-8 text-center text-sm text-body">Loading guidelines…</p>}

        {!loading && items.length === 0 && (
          <p className="py-8 text-center text-sm text-body">No published guidance is available for this profile yet.</p>
        )}

        {items.map((guideline) => {
          const isOpen = open === guideline.id;

          return (
            <div key={guideline.id} className="overflow-hidden rounded-lg border border-divider bg-card">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : guideline.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="text-sm font-bold text-heading">{guideline.title}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-brand-blue transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-divider px-5 py-4 text-sm leading-relaxed text-body">
                  {guideline.content ? (
                    <div
                      className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:text-heading"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(guideline.content, {
                          ALLOWED_TAGS: [
                            "p",
                            "h2",
                            "h3",
                            "h4",
                            "ul",
                            "ol",
                            "li",
                            "strong",
                            "em",
                            "br",
                            "a",
                            "span",
                            "blockquote",
                            "code",
                          ],
                          ALLOWED_ATTR: ["href", "target", "rel"],
                        }),
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-line">{guideline.body}</p>
                  )}

                  {guideline.age_specifics && (
                    <p className="mt-3 text-xs text-body">
                      <span className="font-bold text-heading">Applies to:</span> {guideline.age_specifics}
                    </p>
                  )}

                  {guideline.source_note && (
                    <p className="mt-1 text-xs text-body">
                      <span className="font-bold text-heading">Source:</span> {guideline.source_note}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs leading-relaxed text-body/70">
        SafeProducts provides an informational consumer interpretation of regulatory and nutrition sources. It does
        not represent government endorsement or certification and is not a substitute for the underlying standard,
        regulation, official legal interpretation or medical advice.
      </p>
    </div>
  );
}
