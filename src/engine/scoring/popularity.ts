import type { Article, ArticleId, Criterion, DayRange } from "../types.ts";

const DAY_MS = 86_400_000;

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The last `windowDays` UTC days, including today (D7). */
export function popularityWindow(now: Date, windowDays: number): DayRange {
  return { fromDay: toDay(new Date(now.getTime() - (windowDays - 1) * DAY_MS)), toDay: toDay(now) };
}

export function popularityScores(
  candidates: Article[],
  reads: Map<ArticleId, number>,
  perPublisher: boolean,
): Map<ArticleId, number> {
  const groupOf = (a: Article) => (perPublisher ? a.publisherId : "");
  const maxReads = new Map<string, number>();
  for (const a of candidates) {
    maxReads.set(groupOf(a), Math.max(maxReads.get(groupOf(a)) ?? 0, reads.get(a.id) ?? 0));
  }
  return new Map(
    candidates.map((a): [ArticleId, number] => {
      const r = reads.get(a.id) ?? 0;
      return [a.id, r === 0 ? 0 : Math.log1p(r) / Math.log1p(maxReads.get(groupOf(a)) ?? 0)];
    }),
  );
}

export const popularity: Criterion = {
  id: "popularity",
  score: (candidates, ctx) =>
    popularityScores(candidates, ctx.reads, ctx.profile.popularity.normalisePerPublisher),
};
