import { newestFirst } from "../order.ts";
import type { EditorPin, ScoredCandidate } from "../types.ts";
import { capPerPublisher } from "./diversity.ts";

export type AssembledItem = { kind: "pin"; pin: EditorPin } | { kind: "ranked"; candidate: ScoredCandidate };

export function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  return b.finalScore - a.finalScore || newestFirst(a.article, b.article);
}

/** Pins at their slots; the other slots by score under the publisher cap. A pin past the end of a short list goes last. */
export function assemble(
  scored: ScoredCandidate[],
  pins: Map<number, EditorPin>,
  limit: number,
  maxPerPublisher: number,
): AssembledItem[] {
  const pinnedIds = new Set([...pins.values()].map((p) => p.articleId));
  const ranked = scored.filter((c) => !pinnedIds.has(c.article.id)).sort(compareScored);
  const queue = capPerPublisher(ranked, limit - pins.size, maxPerPublisher);

  const items: AssembledItem[] = [];
  let next = 0;
  for (const [slot, pin] of [...pins].sort(([a], [b]) => a - b)) {
    while (items.length < slot && next < queue.length) items.push({ kind: "ranked", candidate: queue[next++] });
    items.push({ kind: "pin", pin });
  }
  while (next < queue.length) items.push({ kind: "ranked", candidate: queue[next++] });
  return items;
}
