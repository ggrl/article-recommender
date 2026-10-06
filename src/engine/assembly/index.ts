import type { Quotas } from "../config.ts";
import { newestFirst } from "../order.ts";
import type { EditorPin, ScoredCandidate, ScoredSlot, UserContext } from "../types.ts";
import { publisherCap } from "./diversity.ts";
import { reserve } from "./quotas.ts";

export type AssembledItem =
  | { kind: "pin"; pin: EditorPin }
  | { kind: "scored"; candidate: ScoredCandidate; slotType: ScoredSlot; featuredTopic?: string };
type ScoredItem = Extract<AssembledItem, { kind: "scored" }>;

export function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  return b.finalScore - a.finalScore || newestFirst(a.article, b.article);
}

/**
 * Pins at their slots; quota buckets reserved first when quotas are on; the rest by score. One publisher
 * cap spans both. Reserved items are not moved up (D28). A pin past the end of a short list goes last.
 */
export function assemble(
  scored: ScoredCandidate[],
  pins: Map<number, EditorPin>,
  limit: number,
  maxPerPublisher: number,
  quota?: { quotas: Quotas; user: UserContext },
): AssembledItem[] {
  const pinnedIds = new Set([...pins.values()].map((p) => p.articleId));
  const ranked = scored.filter((c) => !pinnedIds.has(c.article.id)).sort(compareScored);
  const slots = limit - pins.size;
  const take = publisherCap(maxPerPublisher);

  const reserved: ScoredItem[] = (quota === undefined ? [] : reserve(ranked, slots, quota.quotas, quota.user, take)).map(
    (r) => ({ kind: "scored", ...r }),
  );
  const reservedIds = new Set(reserved.map((r) => r.candidate.article.id));
  const fill: ScoredItem[] = [];
  for (const candidate of ranked) {
    if (reserved.length + fill.length >= slots) break;
    if (reservedIds.has(candidate.article.id) || !take(candidate)) continue;
    fill.push({ kind: "scored", candidate, slotType: "ranked" });
  }
  const queue = [...reserved, ...fill].sort((a, b) => compareScored(a.candidate, b.candidate));

  const items: AssembledItem[] = [];
  let next = 0;
  for (const [slot, pin] of [...pins].sort(([a], [b]) => a - b)) {
    while (items.length < slot && next < queue.length) items.push(queue[next++]);
    items.push({ kind: "pin", pin });
  }
  while (next < queue.length) items.push(queue[next++]);
  return items;
}
