import type { ScoredCandidate } from "../types.ts";

/**
 * Takes a candidate unless its publisher already has `maxPerPublisher` slots. One counter serves
 * quota reservation and the normal fill, so the cap holds over the whole list.
 */
export function publisherCap(maxPerPublisher: number): (candidate: ScoredCandidate) => boolean {
  const used = new Map<string, number>();
  return (candidate) => {
    const count = used.get(candidate.article.publisherId) ?? 0;
    if (count >= maxPerPublisher) return false;
    used.set(candidate.article.publisherId, count + 1);
    return true;
  };
}
