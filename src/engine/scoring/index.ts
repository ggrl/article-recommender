import type { BreakdownEntry, Candidate, Criterion, ScoredCandidate, ScoringContext } from "../types.ts";
import { popularity } from "./popularity.ts";
import { recency } from "./recency.ts";
import { similarity } from "./similarity.ts";

export const criteria: Criterion[] = [recency, popularity, similarity];

/** Final score = sum(weight * score) / sum(weight) over criteria with weight above 0. */
export function scoreCandidates(
  candidates: Candidate[],
  weights: Record<string, number | undefined>,
  ctx: ScoringContext,
  registry: Criterion[] = criteria,
): ScoredCandidate[] {
  const enabled = registry.filter((c) => (weights[c.id] ?? 0) > 0);
  const totalWeight = enabled.reduce((sum, c) => sum + (weights[c.id] ?? 0), 0);
  const articles = candidates.map((c) => c.article);
  const results = enabled.map((c) => ({ id: c.id, weight: weights[c.id] ?? 0, scores: c.score(articles, ctx) }));

  return candidates.map(({ article, sourcePools }) => {
    const breakdown: Record<string, BreakdownEntry> = {};
    let sum = 0;
    for (const { id, weight, scores } of results) {
      const value = scores.get(article.id) ?? 0;
      const score = typeof value === "number" ? value : value.score;
      const entry: BreakdownEntry = { score, weight, contribution: weight * score };
      if (typeof value !== "number") entry.detail = value.detail;
      breakdown[id] = entry;
      sum += weight * score;
    }
    return { article, sourcePools, finalScore: sum / totalWeight, breakdown };
  });
}
