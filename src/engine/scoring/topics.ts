import { compareIds } from "../order.ts";
import type { ArticleId, Criterion, CriterionScore, UserContext } from "../types.ts";

/** Interests above 0; an interest of 0 counts as none (D20). */
export function positiveInterests(interests: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(interests).filter(([, value]) => value > 0));
}

export function interestedTopics(user: UserContext): string[] {
  return [...positiveInterests(user.topicInterests).keys()];
}

/** min(1, matched interests / strongest interest) (D19); the detail is the strongest matched topic (D20). */
export function topicsScore(
  articleTopics: string[],
  interests: Map<string, number>,
  maxInterest: number,
): CriterionScore {
  const matched = [...new Set(articleTopics)].filter((t) => interests.has(t));
  if (matched.length === 0) return 0;
  const interestOf = (t: string) => interests.get(t) ?? 0;
  const sum = matched.reduce((total, t) => total + interestOf(t), 0);
  const [detail] = matched.sort((a, b) => interestOf(b) - interestOf(a) || compareIds(a, b));
  return { score: Math.min(1, sum / maxInterest), detail };
}

export const topics: Criterion = {
  id: "topics",
  score: (candidates, ctx) => {
    const interests = positiveInterests(ctx.user.topicInterests);
    // No positive interests means every score is 0 below, so skip computing the strongest one.
    const maxInterest = interests.size === 0 ? 0 : Math.max(...interests.values());
    return new Map(
      candidates.map((a): [ArticleId, CriterionScore] => [a.id, topicsScore(a.topics, interests, maxInterest)]),
    );
  },
};
