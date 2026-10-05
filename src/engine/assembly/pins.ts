import { articleFilter } from "../candidates.ts";
import { compareIds } from "../order.ts";
import type { Article, ArticleId, CandidateFilter, EditorPin, UserContext } from "../types.ts";

/** Pins ignore scores but pass the same hard filters as every candidate (D16), plus their own time window and targeting (D8, D11). */
export function activePins(
  pins: EditorPin[],
  articles: Map<ArticleId, Article>,
  user: UserContext,
  now: Date,
  filter: CandidateFilter,
): EditorPin[] {
  const eligible = articleFilter(filter);
  const t = now.getTime();
  return pins.filter((pin) => {
    const article = articles.get(pin.articleId);
    return (
      article !== undefined &&
      pin.startsAt.getTime() <= t &&
      t < pin.expiresAt.getTime() &&
      eligible(article) &&
      (pin.languages === undefined || pin.languages.includes(user.language)) &&
      (pin.regions === undefined || (user.region !== undefined && pin.regions.includes(user.region)))
    );
  });
}

/** Final slot per pin (D8): the earlier start keeps a clashing slot, the other moves to the next free one. */
export function placePins(pins: EditorPin[], limit: number): Map<number, EditorPin> {
  const ordered = [...pins].sort(
    (a, b) => a.position - b.position || a.startsAt.getTime() - b.startsAt.getTime() || compareIds(a.articleId, b.articleId),
  );
  const placed = new Map<number, EditorPin>();
  for (const pin of ordered) {
    let slot = pin.position;
    while (placed.has(slot)) slot++;
    if (slot < limit) placed.set(slot, pin);
  }
  return placed;
}
