import type { BreakdownEntry } from "./types.ts";

/** Every user-facing reason, keyed so the texts can be translated later. */
export const reasonTemplates = {
  recency: () => "New",
  popularity: (windowDays: number) => (windowDays === 7 ? "Popular this week" : `Popular in the last ${windowDays} days`),
  similarity: () => "Related to the article you're reading",
  fallback: () => "Recommended for you",
};

const MAX_REASONS = 2;

export function reasonsFor(breakdown: Record<string, BreakdownEntry>, popularityWindowDays: number): string[] {
  const reasons = Object.entries(breakdown)
    .filter(([, e]) => e.contribution > 0)
    .sort(([, a], [, b]) => b.contribution - a.contribution)
    .slice(0, MAX_REASONS)
    .map(([id]) => reasonText(id, popularityWindowDays));
  return reasons.length > 0 ? reasons : [reasonTemplates.fallback()];
}

function reasonText(criterionId: string, popularityWindowDays: number): string {
  switch (criterionId) {
    case "recency":
      return reasonTemplates.recency();
    case "popularity":
      return reasonTemplates.popularity(popularityWindowDays);
    case "similarity":
      return reasonTemplates.similarity();
    default:
      throw new Error(`No reason template for criterion "${criterionId}"`);
  }
}
