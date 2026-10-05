import { describe, expect, it } from "vitest";
import { createMemoryRepository, type MemoryData } from "../src/data/memoryRepository.ts";
import { RequestError, createRecommender } from "../src/engine/recommend.ts";
import { NOW, hoursAgo, loadDefaultConfig, makeArticle, makePin, makeUser } from "./helpers.ts";

const data: MemoryData = {
  articles: [
    makeArticle({ id: "fresh", publisherId: "p1", publishedAt: hoursAgo(1), topics: ["x"] }),
    makeArticle({ id: "hit", publisherId: "p2", publishedAt: hoursAgo(30), topics: ["x"] }),
    makeArticle({ id: "multi", publisherId: "p3", languages: ["en", "de", "hr"], publishedAt: hoursAgo(5) }),
    makeArticle({ id: "withdrawn", publisherId: "p4", status: "withdrawn", publishedAt: hoursAgo(1) }),
    makeArticle({ id: "anchor", publisherId: "p5", publishedAt: hoursAgo(50), topics: ["x"] }),
    makeArticle({ id: "pinned", publisherId: "p6", publishedAt: hoursAgo(200) }),
    makeArticle({ id: "stale", publisherId: "p7", publishedAt: hoursAgo(61 * 24) }),
  ],
  reads: [{ articleId: "hit", day: "2026-10-05", reads: 40 }],
  pins: [
    makePin({ articleId: "pinned", position: 0, note: "Our pick" }),
    makePin({ articleId: "fresh", position: 1, expiresAt: hoursAgo(1) }),
    makePin({ articleId: "withdrawn", position: 2 }),
    makePin({ articleId: "stale", position: 3 }),
  ],
};
const recommender = (config: unknown = loadDefaultConfig()) =>
  createRecommender({ repository: createMemoryRepository(data), config });
const feed = (overrides = {}) => ({ mode: "feed", user: makeUser(), limit: 10, now: NOW, ...overrides });

describe("createRecommender", () => {
  it("fails at once on an invalid config", () => {
    expect(() => recommender({ version: "x" })).toThrow(/Invalid config/);
  });
});

describe("feed", () => {
  it("returns ranked items with a breakdown and at least one reason", async () => {
    const { items, meta } = await recommender().recommend(feed());
    expect(items.map((i) => i.rank)).toEqual(items.map((_, i) => i + 1));
    for (const item of items.filter((i) => i.slotType === "ranked")) {
      expect(Object.keys(item.breakdown)).toEqual(["recency", "popularity"]);
      expect(item.reasons.length).toBeGreaterThan(0);
    }
    expect(meta).toEqual({ configVersion: "2026-10-proto-1", candidateCount: 5, profile: "feed" });
  });

  it("puts an active pin at its position and never an expired one", async () => {
    const { items } = await recommender().recommend(feed());
    expect(items[0]).toMatchObject({ articleId: "pinned", slotType: "pin", finalScore: null, reasons: ["Our pick"], pinNote: "Our pick" });
    expect(items.filter((i) => i.slotType === "pin")).toHaveLength(1);
  });

  it("never shows a pin on a withdrawn or already read article", async () => {
    const withdrawnPin = await recommender().recommend(feed());
    expect(withdrawnPin.items.map((i) => i.articleId)).not.toContain("withdrawn");
    const readPin = await recommender().recommend(feed({ user: makeUser({ readArticleIds: ["pinned"] }) }));
    expect(readPin.items.some((i) => i.slotType === "pin")).toBe(false);
  });

  it("never shows a pin on an article older than the feed's maximum age", async () => {
    const { items } = await recommender().recommend(feed());
    expect(items.map((i) => i.articleId)).not.toContain("stale");
  });

  it("never returns a withdrawn or already read article", async () => {
    const { items } = await recommender().recommend(feed({ user: makeUser({ readArticleIds: ["hit"] }) }));
    const ids = items.map((i) => i.articleId);
    expect(ids).not.toContain("withdrawn");
    expect(ids).not.toContain("hit");
  });

  it("returns a translated article once, with every pool that found it", async () => {
    const user = makeUser({ language: "de", fallbackLanguages: ["hr", "en"] });
    const { items } = await recommender().recommend(feed({ user }));
    const ids = items.map((i) => i.articleId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("multi");
    expect(items.find((i) => i.articleId === "hit")?.sourcePools).toEqual(["recent", "popular"]);
  });

  it("drops a criterion with weight 0 from scores and reasons", async () => {
    const config = loadDefaultConfig();
    config.profiles.feed.weights.popularity = 0;
    const { items } = await recommender(config).recommend(feed());
    for (const item of items.filter((i) => i.slotType === "ranked")) {
      expect(item.breakdown).not.toHaveProperty("popularity");
      expect(item.reasons.join()).not.toMatch(/Popular/);
    }
  });
});

describe("read next", () => {
  const readNext = { mode: "readNext", user: makeUser(), anchorArticleId: "anchor", limit: 10, now: NOW };

  it("never returns the anchor and shows no pins", async () => {
    const { items } = await recommender().recommend(readNext);
    expect(items.map((i) => i.articleId)).not.toContain("anchor");
    expect(items.some((i) => i.slotType === "pin")).toBe(false);
  });

  it("ranks related articles first", async () => {
    const { items } = await recommender().recommend(readNext);
    expect(items.slice(0, 2).map((i) => i.articleId).sort()).toEqual(["fresh", "hit"]);
    expect(items[0]?.reasons).toContain("Related to the article you're reading");
  });

  it("rejects an unknown anchor", async () => {
    await expect(recommender().recommend({ ...readNext, anchorArticleId: "nope" })).rejects.toThrow(RequestError);
  });

  it("rejects a read next request without an anchor", async () => {
    await expect(recommender().recommend({ ...readNext, anchorArticleId: undefined })).rejects.toThrow(RequestError);
  });
});

describe("request validation", () => {
  it("rejects a limit outside 1 to 100", async () => {
    await expect(recommender().recommend(feed({ limit: 0 }))).rejects.toThrow(RequestError);
    await expect(recommender().recommend(feed({ limit: 101 }))).rejects.toThrow(RequestError);
  });

  it("rejects an invalid date", async () => {
    await expect(recommender().recommend(feed({ now: new Date("not a date") }))).rejects.toThrow(RequestError);
  });
});
