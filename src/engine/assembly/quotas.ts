import type { Quotas } from "../config.ts";
import { compareIds } from "../order.ts";
import { followMatch } from "../scoring/follows.ts";
import type { ArticleId, ScoredCandidate, UserContext } from "../types.ts";

export interface Reserved {
  candidate: ScoredCandidate;
  slotType: "quota" | "surprise";
  featuredTopic?: string;
}

interface Bucket {
  share: number;
  slotType: Reserved["slotType"];
  featuredTopic?: string;
  member(candidate: ScoredCandidate): boolean;
}

/** Fill order (D30): featured topics alphabetically, followed publishers, followed communities, surprise. */
function buckets(quotas: Quotas, user: UserContext): Bucket[] {
  const follow = (c: ScoredCandidate) => followMatch(c.article, user.followedPublishers, user.followedCommunities);
  const featured = Object.keys(quotas.topics)
    .sort(compareIds)
    .map((topic): Bucket => ({
      share: quotas.topics[topic],
      slotType: "quota",
      featuredTopic: topic,
      member: (c) => c.article.topics.includes(topic),
    }));
  return [
    ...featured,
    { share: quotas.follows.publishers, slotType: "quota", member: (c) => follow(c) === "publisher" },
    { share: quotas.follows.communities, slotType: "quota", member: (c) => follow(c) === "community" },
    { share: quotas.surprise, slotType: "surprise", member: (c) => c.sourcePools.includes("exploration") },
  ];
}

/**
 * Work order 2.9 step 2. `ranked` is best first. Each bucket takes up to round(share * slots), capped at
 * the slots still free (D30); an article goes to one bucket at most; a short bucket leaves its slots to the fill.
 */
export function reserve(
  ranked: ScoredCandidate[],
  slots: number,
  quotas: Quotas,
  user: UserContext,
  take: (candidate: ScoredCandidate) => boolean,
): Reserved[] {
  const reserved: Reserved[] = [];
  const taken = new Set<ArticleId>();
  for (const bucket of buckets(quotas, user)) {
    const target = Math.min(Math.round(bucket.share * slots), slots - reserved.length);
    let filled = 0;
    for (const candidate of ranked) {
      if (filled >= target) break;
      if (taken.has(candidate.article.id) || !bucket.member(candidate) || !take(candidate)) continue;
      taken.add(candidate.article.id);
      reserved.push({ candidate, slotType: bucket.slotType, featuredTopic: bucket.featuredTopic });
      filled++;
    }
  }
  return reserved;
}
