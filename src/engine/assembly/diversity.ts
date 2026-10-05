import type { ScoredCandidate } from "../types.ts";

/** Takes candidates in the given order, skipping any whose publisher already has `maxPerPublisher` slots. */
export function capPerPublisher(ranked: ScoredCandidate[], slots: number, maxPerPublisher: number): ScoredCandidate[] {
  const perPublisher = new Map<string, number>();
  const picked: ScoredCandidate[] = [];
  for (const candidate of ranked) {
    if (picked.length >= slots) break;
    const used = perPublisher.get(candidate.article.publisherId) ?? 0;
    if (used >= maxPerPublisher) continue;
    perPublisher.set(candidate.article.publisherId, used + 1);
    picked.push(candidate);
  }
  return picked;
}
