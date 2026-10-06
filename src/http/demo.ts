import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Repository } from "../data/repository.ts";
import { parseConfig, type Config } from "../engine/config.ts";
import { compareIds } from "../engine/order.ts";
import { RequestError, createRecommender } from "../engine/recommend.ts";
import type { Article, ArticleId, UserContext } from "../engine/types.ts";

export interface DemoDeps {
  repository: Repository;
  /** config/default.json as parsed JSON, before validation. */
  rawConfig: unknown;
  /** The seed readers the page can choose from. */
  users: UserContext[];
  topics: string[];
  now: () => Date;
}

const DEMO_LIMIT = 20;
const HOUR_MS = 3_600_000;

export function topicsOf(articles: Article[]): string[] {
  return [...new Set(articles.flatMap((a) => a.topics))].sort(compareIds);
}

/** Strips parseConfig's "Invalid config:" header and zod's "→ at ..." path lines, leaving plain issue text. */
export function plainConfigError(message: string): string {
  const lines = message.split("\n").map((line) => line.trim());
  if (lines[0] === "Invalid config:") lines.shift();
  return lines
    .filter((line) => !line.startsWith("→"))
    .map((line) => (line.startsWith("✖ ") ? line.slice(2) : line))
    .join("; ");
}

/** Local-only demo routes (D31): the page, its options, and a feed built from posted weights and quotas. */
export function registerDemo(app: FastifyInstance, deps: DemoDeps): void {
  const page = readFileSync(new URL("./demo.html", import.meta.url), "utf8");
  const base = parseConfig(deps.rawConfig);
  // Only the outer shape is checked here; weight and quota values are parseConfig's job.
  const feedBody = z.strictObject({
    reader: z.number().int().min(0).max(deps.users.length - 1),
    seed: z.unknown().optional(),
    weights: z.unknown(),
    quotas: z.unknown(),
  });

  app.get("/", async (_request, reply) => reply.type("text/html; charset=utf-8").send(page));

  app.get("/demo/options", async () => ({
    readers: deps.users.map((user) => ({ label: user.userId ?? "Anonymous (cold start)", user })),
    topics: deps.topics,
    defaults: { weights: base.profiles.feed.weights, quotas: base.profiles.feed.quotas },
  }));

  app.post("/demo/feed", async (request, reply) => {
    const body = feedBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: z.prettifyError(body.error) });
    const { reader, seed, weights, quotas } = body.data;

    let config: Config;
    try {
      config = parseConfig({ ...base, profiles: { ...base.profiles, feed: { ...base.profiles.feed, weights, quotas } } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(400).send({ error: plainConfigError(message) });
    }

    const now = deps.now();
    try {
      const response = await createRecommender({ repository: deps.repository, config }).recommend({
        mode: "feed",
        user: deps.users[reader],
        limit: DEMO_LIMIT,
        now,
        seed,
      });
      const found = await deps.repository.getArticles(response.items.map((i) => i.articleId));
      const articles: Record<ArticleId, { publisherId: string; topics: string[]; ageHours: number }> = {};
      for (const a of found) {
        articles[a.id] = {
          publisherId: a.publisherId,
          topics: a.topics,
          ageHours: Math.round((now.getTime() - a.publishedAt.getTime()) / HOUR_MS),
        };
      }
      return { ...response, articles };
    } catch (error) {
      if (error instanceof RequestError) return reply.code(400).send({ error: error.message });
      throw error;
    }
  });
}
