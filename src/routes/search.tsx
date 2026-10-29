import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { HeroSearch, type Profile } from "@/components/HeroSearch";
import { SearchResults } from "@/components/SearchResults";

const searchSchema = z.object({
  q: z.string().catch(""),
  profile: z.enum(["ALL", "Children", "Pregnant Women", "Pregnant Woman", "Seniors"]).catch("ALL"),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Search results — SafeProducts" },
      { name: "description", content: "Product safety scores on SafeProducts.in" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, profile } = Route.useSearch();
  const navigate = useNavigate();

  const handleSubmit = (newQ: string, newProfile: Profile) => {
    navigate({
      to: "/search",
      search: { q: newQ, profile: newProfile },
      replace: true,
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline">
        <ArrowLeft className="h-4 w-4" /> New Search
      </Link>

      <div className="space-y-4 rounded-lg border border-divider bg-card/50 p-4">
        <HeroSearch
          key={`${q}::${profile}`}
          initialQ={q}
          initialProfile={profile}
          onSubmit={handleSubmit}
        />
      </div>

      {q.trim() ? (
        <SearchResults q={q} profile={profile} />
      ) : (
        <div className="rounded-lg border border-divider bg-card p-8 text-center">
          <p className="text-heading">Search for a product or ingredient by typing or using the microphone.</p>
        </div>
      )}
    </div>
  );
}
