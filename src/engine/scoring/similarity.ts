import type { Article, ArticleId, Criterion } from "../types.ts";

const SAME_SOURCE_BONUS = 0.3;

export function sharesSource(article: Article, anchor: Article): boolean {
  return (
    article.publisherId === anchor.publisherId ||
    article.communityIds.some((c) => anchor.communityIds.includes(c))
  );
}

// Tag overlap for now; an embedding version replaces this criterion without touching the engine.
export function similarityScore(article: Article, anchor: Article): number {
  const anchorTopics = new Set(anchor.topics);
  const shared = new Set(article.topics.filter((t) => anchorTopics.has(t))).size;
  const union = new Set([...anchor.topics, ...article.topics]).size;
  const jaccard = union === 0 ? 0 : shared / union;
  return Math.min(1, jaccard + (sharesSource(article, anchor) ? SAME_SOURCE_BONUS : 0));
}

export const similarity: Criterion = {
  id: "similarity",
  score: (candidates, ctx) => {
    const anchor = ctx.anchor;
    if (anchor === undefined) throw new Error("similarity needs an anchor article");
    return new Map(candidates.map((a): [ArticleId, number] => [a.id, similarityScore(a, anchor)]));
  },
};
