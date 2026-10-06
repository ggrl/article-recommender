import { articleFilter } from "../engine/candidates.ts";
import { newestFirst } from "../engine/order.ts";
import { sharesSource } from "../engine/scoring/similarity.ts";
import { followMatch } from "../engine/scoring/follows.ts";
import type { Article, ArticleId, DayRange, EditorPin, ReadAggregate } from "../engine/types.ts";
import type { Repository } from "./repository.ts";

export interface MemoryData {
  articles: Article[];
  reads: ReadAggregate[];
  pins: EditorPin[];
}

export function createMemoryRepository(data: MemoryData): Repository {
  const byId = new Map(data.articles.map((a) => [a.id, a] as const));

  const readsIn = (window: DayRange) => {
    const totals = new Map<ArticleId, number>();
    for (const r of data.reads) {
      if (r.day >= window.fromDay && r.day <= window.toDay) {
        totals.set(r.articleId, (totals.get(r.articleId) ?? 0) + r.reads);
      }
    }
    return totals;
  };

  const firstIds = (articles: Article[], limit: number) => articles.slice(0, limit).map((a) => a.id);

  return {
    async recent(filter, limit) {
      return firstIds(data.articles.filter(articleFilter(filter)).sort(newestFirst), limit);
    },
    async popular(filter, window, limit) {
      const totals = readsIn(window);
      const ok = articleFilter(filter);
      const reads = (a: Article) => totals.get(a.id) ?? 0;
      return firstIds(
        data.articles.filter((a) => reads(a) > 0 && ok(a)).sort((a, b) => reads(b) - reads(a) || newestFirst(a, b)),
        limit,
      );
    },
    async similar(anchor, filter, limit) {
      const topics = new Set(anchor.topics);
      const ok = articleFilter(filter);
      return firstIds(data.articles.filter((a) => ok(a) && a.topics.some((t) => topics.has(t))).sort(newestFirst), limit);
    },
    async sameSource(anchor, filter, limit) {
      const ok = articleFilter(filter);
      return firstIds(data.articles.filter((a) => ok(a) && sharesSource(a, anchor)).sort(newestFirst), limit);
    },
    async follows(filter, publishers, communities, limit) {
      const ok = articleFilter(filter);
      return firstIds(
        data.articles.filter((a) => ok(a) && followMatch(a, publishers, communities) !== undefined).sort(newestFirst),
        limit,
      );
    },
    async topics(filter, topics, limit) {
      const wanted = new Set(topics);
      const ok = articleFilter(filter);
      return firstIds(data.articles.filter((a) => ok(a) && a.topics.some((t) => wanted.has(t))).sort(newestFirst), limit);
    },
    async unmatched(filter, topics, publishers, communities, limit) {
      const excluded = new Set(topics);
      const ok = articleFilter(filter);
      const matches = (a: Article) =>
        a.topics.some((t) => excluded.has(t)) || followMatch(a, publishers, communities) !== undefined;
      return firstIds(data.articles.filter((a) => ok(a) && !matches(a)).sort(newestFirst), limit);
    },
    async getArticles(ids) {
      return ids.flatMap((id) => byId.get(id) ?? []);
    },
    async getReads(ids, window) {
      const totals = readsIn(window);
      const wanted = new Set(ids);
      return new Map([...totals].filter(([id]) => wanted.has(id)));
    },
    async listPins() {
      return data.pins;
    },
  };
}
