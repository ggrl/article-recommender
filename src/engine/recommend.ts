import { z } from "zod";
import type { Repository } from "../data/repository.ts";
import { assemble, type AssembledItem } from "./assembly/index.ts";
import { activePins, placePins } from "./assembly/pins.ts";
import { buildFilter, feedPools, readNextPools, unionPools, type PoolQuery } from "./candidates.ts";
import { parseConfig } from "./config.ts";
import { reasonsFor } from "./explain.ts";
import { scoreCandidates } from "./scoring/index.ts";
import { popularityWindow } from "./scoring/popularity.ts";
import {
  recommendRequestSchema,
  type Article,
  type CandidateFilter,
  type EditorPin,
  type RecommendRequest,
  type RecommendResponse,
  type RecommendedItem,
} from "./types.ts";

/** The caller sent something the engine cannot serve; the HTTP layer answers 400. */
export class RequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestError";
  }
}

export interface Recommender {
  recommend(request: unknown): Promise<RecommendResponse>;
}

export function createRecommender(deps: { repository: Repository; config: unknown }): Recommender {
  const config = parseConfig(deps.config);
  const repo = deps.repository;

  async function loadPins(request: RecommendRequest, filter: CandidateFilter): Promise<Map<number, EditorPin>> {
    const pins = await repo.listPins();
    const articles = await repo.getArticles(pins.map((p) => p.articleId));
    const byId = new Map(articles.map((a) => [a.id, a] as const));
    return placePins(activePins(pins, byId, request.user, request.now, filter), request.limit);
  }

  return {
    async recommend(input) {
      const request = parseRequest(input);
      const { user, now, limit } = request;
      const profile = config.profiles[request.mode];
      const window = popularityWindow(now, profile.popularity.windowDays);

      let anchor: Article | undefined;
      let pools: PoolQuery[];
      let pinsLoaded: Promise<Map<number, EditorPin>> = Promise.resolve(new Map()); // pins are feed only (D3)
      if (request.mode === "feed") {
        const filter = buildFilter(user, profile.maxAgeDays, now);
        pools = feedPools(repo, filter, config.profiles.feed, window);
        pinsLoaded = loadPins(request, filter);
      } else {
        [anchor] = await repo.getArticles([request.anchorArticleId]);
        if (anchor === undefined) throw new RequestError(`Unknown anchorArticleId: ${request.anchorArticleId}`);
        const filter = buildFilter(user, profile.maxAgeDays, now, anchor.id);
        pools = readNextPools(repo, filter, config.profiles.readNext, anchor, window);
      }

      const [union, pins] = await Promise.all([unionPools(pools), pinsLoaded]);
      const ids = [...union.keys()];
      const [articles, reads] = await Promise.all([repo.getArticles(ids), repo.getReads(ids, window)]);
      const candidates = articles.map((article) => ({ article, sourcePools: union.get(article.id) ?? [] }));
      const scored = scoreCandidates(candidates, profile.weights, { now, profile, reads, anchor });
      const assembled = assemble(scored, pins, limit, profile.diversity.maxPerPublisher);

      return {
        items: assembled.map((item, i) => toItem(item, i + 1, profile.popularity.windowDays)),
        meta: { configVersion: config.version, candidateCount: union.size, profile: request.mode },
      };
    },
  };
}

function parseRequest(input: unknown): RecommendRequest {
  const result = recommendRequestSchema.safeParse(input);
  if (!result.success) throw new RequestError(z.prettifyError(result.error));
  return result.data;
}

function toItem(item: AssembledItem, rank: number, popularityWindowDays: number): RecommendedItem {
  if (item.kind === "pin") {
    const { pin } = item;
    return {
      articleId: pin.articleId,
      rank,
      finalScore: null,
      breakdown: {},
      sourcePools: [],
      slotType: "pin",
      reasons: [pin.note],
      pinNote: pin.note,
    };
  }
  const { article, finalScore, breakdown, sourcePools } = item.candidate;
  return {
    articleId: article.id,
    rank,
    finalScore,
    breakdown,
    sourcePools,
    slotType: "ranked",
    reasons: reasonsFor(breakdown, popularityWindowDays),
  };
}
