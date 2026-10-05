import type { BreakdownEntry } from "./types.ts";

/** Every user-facing reason, keyed so the texts can be translated later. */
export const reasonTemplates = {
  recency: () => "New",
  popularity: (windowDays: number) => (windowDays === 7 ? "Popular this week" : `Popular in the last ${windowDays} days`),
  similarity: () => "Related to the article you're reading",
  topics: (topic: string) => `Matches your interest in ${topic}`,
  followsPublisher: () => "From a publisher you follow",
  followsCommunity: () => "From a community you follow",
  fallback: () => "Recommended for you",
};

const MAX_REASONS = 2;

export function reasonsFor(breakdown: Record<string, BreakdownEntry>, popularityWindowDays: number): string[] {
  const reasons = Object.entries(breakdown)
    .filter(([, e]) => e.contribution > 0)
    .sort(([, a], [, b]) => b.contribution - a.contribution)
    .slice(0, MAX_REASONS)
    .map(([id, entry]) => reasonText(id, entry.detail, popularityWindowDays));
  return reasons.length > 0 ? reasons : [reasonTemplates.fallback()];
}

function reasonText(criterionId: string, detail: string | undefined, popularityWindowDays: number): string {
  switch (criterionId) {
    case "recency":
      return reasonTemplates.recency();
    case "popularity":
      return reasonTemplates.popularity(popularityWindowDays);
    case "similarity":
      return reasonTemplates.similarity();
    case "topics":
      if (detail === undefined) throw new Error("The topics reason needs the matched topic");
      return reasonTemplates.topics(detail);
    case "follows":
      if (detail === "publisher") return reasonTemplates.followsPublisher();
      if (detail === "community") return reasonTemplates.followsCommunity();
      throw new Error(`The follows reason needs "publisher" or "community", got ${String(detail)}`);
    default:
      throw new Error(`No reason template for criterion "${criterionId}"`);
  }
}
