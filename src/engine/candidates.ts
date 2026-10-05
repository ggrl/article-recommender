import type { Repository } from "../data/repository.ts";
import type { FeedProfile, ReadNextProfile } from "./config.ts";
import type { Article, ArticleId, CandidateFilter, DayRange, UserContext } from "./types.ts";

const DAY_MS = 86_400_000;

export function userLanguages(user: UserContext): string[] {
  return [user.language, ...user.fallbackLanguages];
}

export function buildFilter(user: UserContext, maxAgeDays: number, now: Date, anchorId?: ArticleId): CandidateFilter {
  return {
    statuses: ["published"],
    languages: userLanguages(user),
    excludeIds: anchorId === undefined ? user.readArticleIds : [...user.readArticleIds, anchorId],
    publishedSince: new Date(now.getTime() - maxAgeDays * DAY_MS),
  };
}

export interface PoolQuery {
  name: string;
  size: number;
  run(size: number): Promise<ArticleId[]>;
}

export function feedPools(repo: Repository, filter: CandidateFilter, profile: FeedProfile, window: DayRange): PoolQuery[] {
  return [
    { name: "recent", size: profile.pools.recent, run: (n) => repo.recent(filter, n) },
    { name: "popular", size: profile.pools.popular, run: (n) => repo.popular(filter, window, n) },
  ];
}

export function readNextPools(
  repo: Repository,
  filter: CandidateFilter,
  profile: ReadNextProfile,
  anchor: Article,
  window: DayRange,
): PoolQuery[] {
  return [
    { name: "similar", size: profile.pools.similar, run: (n) => repo.similar(anchor, filter, n) },
    { name: "sameSource", size: profile.pools.sameSource, run: (n) => repo.sameSource(anchor, filter, n) },
    { name: "popular", size: profile.pools.popular, run: (n) => repo.popular(filter, window, n) },
  ];
}

/** Pools decide eligibility, not rank: the union keeps every pool that returned each article. */
export async function unionPools(pools: PoolQuery[]): Promise<Map<ArticleId, string[]>> {
  const active = pools.filter((p) => p.size > 0);
  const results = await Promise.all(active.map((p) => p.run(p.size)));
  const union = new Map<ArticleId, string[]>();
  active.forEach((pool, i) => {
    for (const id of results[i]) union.set(id, [...(union.get(id) ?? []), pool.name]);
  });
  return union;
}
