import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../src/data/memoryRepository.ts";
import { generateSeed } from "../src/data/seed.ts";
import { createRecommender } from "../src/engine/recommend.ts";
import { registerDemo, topicsOf } from "../src/http/demo.ts";
import { buildServer } from "../src/http/server.ts";
import { NOW, loadDefaultConfig, makeArticle } from "./helpers.ts";

const data = generateSeed(42, NOW);
const repository = createMemoryRepository(data);
const rawConfig: unknown = loadDefaultConfig();
const app = buildServer(createRecommender({ repository, config: rawConfig }));
registerDemo(app, { repository, rawConfig, users: data.users, topics: topicsOf(data.articles), now: () => NOW });

const defaults = loadDefaultConfig().profiles.feed;
const settings = { weights: defaults.weights, quotas: defaults.quotas };
const demoFeed = (body: object) => app.inject({ method: "POST", url: "/demo/feed", payload: body });

describe("topicsOf", () => {
  it("lists every topic once, sorted", () => {
    const articles = [makeArticle({ id: "1", topics: ["b", "a"] }), makeArticle({ id: "2", topics: ["a", "c"] })];
    expect(topicsOf(articles)).toEqual(["a", "b", "c"]);
  });
});

describe("demo page and options", () => {
  it("serves the page as HTML", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.body).toMatch(/<title>/);
  });

  it("lists the five seed readers, the seed topics and the default feed settings", async () => {
    const options = (await app.inject({ method: "GET", url: "/demo/options" })).json();
    expect(options.readers).toHaveLength(5);
    expect(options.readers[0].label).toBe("Anonymous (cold start)");
    expect(options.readers[1]).toEqual({ label: "u1", user: JSON.parse(JSON.stringify(data.users[1])) });
    expect(options.topics).toEqual(topicsOf(data.articles));
    expect(options.topics).toHaveLength(15);
    expect(options.defaults).toEqual(settings);
  });
});

describe("demo feed", () => {
  it("gives the same feed as POST /recommend for the default settings", async () => {
    const viaDemo = await demoFeed({ reader: 1, seed: 7, ...settings });
    const viaApi = await app.inject({
      method: "POST",
      url: "/recommend",
      payload: { mode: "feed", user: data.users[1], limit: 20, now: NOW.toISOString(), seed: 7 },
    });
    expect(viaDemo.statusCode).toBe(200);
    const { articles, ...response } = viaDemo.json();
    expect(response).toEqual(viaApi.json());
    expect(Object.keys(articles).sort()).toEqual(response.items.map((i: { articleId: string }) => i.articleId).sort());
  });

  it("describes each returned article with publisher, topics and age at the request's now", async () => {
    const { items, articles } = (await demoFeed({ reader: 0, seed: 7, ...settings })).json();
    const first = data.articles.find((a) => a.id === items[1].articleId);
    expect(first).toBeDefined();
    expect(articles[items[1].articleId]).toEqual({
      publisherId: first?.publisherId,
      topics: first?.topics,
      ageHours: Math.round((NOW.getTime() - (first?.publishedAt.getTime() ?? 0)) / 3_600_000),
    });
  });

  it("drops a criterion whose weight is 0", async () => {
    const res = await demoFeed({ reader: 1, seed: 7, ...settings, weights: { ...defaults.weights, popularity: 0 } });
    expect(res.statusCode).toBe(200);
    for (const item of res.json().items.filter((i: { slotType: string }) => i.slotType !== "pin")) {
      expect(item.breakdown).not.toHaveProperty("popularity");
    }
  });

  it("shows surprise items when quotas are on", async () => {
    const quotas = { enabled: true, topics: {}, follows: { communities: 0, publishers: 0 }, surprise: 0.2 };
    const res = await demoFeed({ reader: 0, seed: 7, weights: defaults.weights, quotas });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.some((i: { slotType: string }) => i.slotType === "surprise")).toBe(true);
  });

  it("answers 400 with the config check's message for invalid settings", async () => {
    const overbooked = { ...defaults.quotas, enabled: true, surprise: 0.9 };
    const tooMuch = await demoFeed({ reader: 0, weights: defaults.weights, quotas: overbooked });
    expect(tooMuch.statusCode).toBe(400);
    expect(tooMuch.json().error).toMatch(/more than 1/);
    expect(tooMuch.json().error).toBe("quota shares may not add up to more than 1");

    const allOff = await demoFeed({ reader: 0, weights: { recency: 0, popularity: 0, topics: 0, follows: 0 }, quotas: defaults.quotas });
    expect(allOff.statusCode).toBe(400);
    expect(allOff.json().error).toMatch(/at least one weight/);
    expect(allOff.json().error).toBe("at least one weight must be above 0");

    const unknownWeight = await demoFeed({ reader: 0, weights: { ...defaults.weights, location: 1 }, quotas: defaults.quotas });
    expect(unknownWeight.statusCode).toBe(400);
    expect(unknownWeight.json().error).toMatch(/location/);
  });

  it("answers 400 for a reader that does not exist or an unknown body key", async () => {
    for (const reader of [5, -1, 1.5]) {
      expect((await demoFeed({ reader, ...settings })).statusCode).toBe(400);
    }
    expect((await demoFeed({ reader: 0, ...settings, limit: 5 })).statusCode).toBe(400);
  });

  it("answers 400 for an invalid seed", async () => {
    expect((await demoFeed({ reader: 0, seed: -1, ...settings })).statusCode).toBe(400);
  });
});
