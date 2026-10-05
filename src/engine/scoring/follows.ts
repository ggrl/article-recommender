import type { Article, ArticleId, Criterion, CriterionScore } from "../types.ts";

/** Which follow an article matches; a followed publisher wins over a followed community (D21). */
export function followMatch(
  article: Article,
  publishers: string[],
  communities: string[],
): "publisher" | "community" | undefined {
  if (publishers.includes(article.publisherId)) return "publisher";
  if (article.communityIds.some((c) => communities.includes(c))) return "community";
  return undefined;
}

export const follows: Criterion = {
  id: "follows",
  score: (candidates, ctx) =>
    new Map(
      candidates.map((a): [ArticleId, CriterionScore] => {
        const match = followMatch(a, ctx.user.followedPublishers, ctx.user.followedCommunities);
        return [a.id, match === undefined ? 0 : { score: 1, detail: match }];
      }),
    ),
};
