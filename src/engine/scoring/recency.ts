import type { ArticleId, Criterion } from "../types.ts";

const HOUR_MS = 3_600_000;

export function recencyScore(publishedAt: Date, now: Date, halfLifeHours: number): number {
  // `now` comes from the caller, so a published date after it is possible; clamping keeps the score in [0, 1].
  const ageHours = Math.max(0, (now.getTime() - publishedAt.getTime()) / HOUR_MS);
  return 2 ** (-ageHours / halfLifeHours);
}

export const recency: Criterion = {
  id: "recency",
  score: (candidates, ctx) =>
    new Map(
      candidates.map((a): [ArticleId, number] => [
        a.id,
        recencyScore(a.publishedAt, ctx.now, ctx.profile.recency.halfLifeHours),
      ]),
    ),
};
