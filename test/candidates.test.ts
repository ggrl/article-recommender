import { describe, expect, it, vi } from "vitest";
import { createMemoryRepository } from "../src/data/memoryRepository.ts";
import { articleFilter, availableIn, buildFilter, feedPools, readNextPools, unionPools, userLanguages } from "../src/engine/candidates.ts";
import { createRng } from "../src/engine/rng.ts";
import { DAY_MS, NOW, hoursAgo, loadDefaultConfig, makeArticle, makeUser } from "./helpers.ts";

const window = { fromDay: "2026-09-29", toDay: "2026-10-05" };

describe("buildFilter", () => {
  it("builds the feed filter from user and profile", () => {
    const user = makeUser({ language: "hr", fallbackLanguages: ["en"], readArticleIds: ["r1"] });
    expect(buildFilter(user, 60, NOW)).toEqual({
      statuses: ["published"],
      languages: ["hr", "en"],
      excludeIds: ["r1"],
      publishedSince: new Date(NOW.getTime() - 60 * DAY_MS),
    });
  });

  it("also excludes the anchor in read next", () => {
    expect(buildFilter(makeUser({ readArticleIds: ["r1"] }), 365, NOW, "anchor").excludeIds).toEqual(["r1", "anchor"]);
  });
});

describe("articleFilter", () => {
  const filter = buildFilter(makeUser({ readArticleIds: ["read"] }), 60, NOW);
  const passes = (overrides: Parameters<typeof makeArticle>[0]) => articleFilter(filter)(makeArticle(overrides));

  it("passes a published, recent, unread article in a language the user reads", () => {
    expect(passes({ id: "ok" })).toBe(true);
  });

  it("rejects a withdrawn or embargoed article", () => {
    expect(passes({ id: "w", status: "withdrawn" })).toBe(false);
    expect(passes({ id: "e", status: "embargoed" })).toBe(false);
  });

  it("rejects an article the user already read", () => {
    expect(passes({ id: "read" })).toBe(false);
  });

  it("includes the age boundary and rejects anything older", () => {
    expect(passes({ id: "edge", publishedAt: new Date(NOW.getTime() - 60 * DAY_MS) })).toBe(true);
    expect(passes({ id: "old", publishedAt: new Date(NOW.getTime() - 60 * DAY_MS - 1) })).toBe(false);
  });

  it("rejects an article in no language the user reads", () => {
    expect(passes({ id: "de", languages: ["de"] })).toBe(false);
  });
});

describe("userLanguages", () => {
  it("is the main language followed by fallbacks", () => {
    expect(userLanguages(makeUser({ language: "de", fallbackLanguages: ["en", "fr"] }))).toEqual(["de", "en", "fr"]);
  });
});

describe("availableIn", () => {
  it("is true when a fallback language matches", () => {
    const article = makeArticle({ id: "a", languages: ["hr", "en"] });
    expect(availableIn(article, ["de", "en"])).toBe(true);
  });

  it("is false when no language matches", () => {
    const article = makeArticle({ id: "a", languages: ["hr"] });
    expect(availableIn(article, ["de", "en"])).toBe(false);
  });
});

describe("unionPools", () => {
  it("records every pool that returned an article", async () => {
    const union = await unionPools([
      { name: "recent", size: 5, run: async () => ["a", "b"] },
      { name: "popular", size: 5, run: async () => ["b"] },
    ]);
    expect(union).toEqual(new Map([["a", ["recent"]], ["b", ["recent", "popular"]]]));
  });

  it("skips a pool with size 0", async () => {
    const run = vi.fn(async () => ["a"]);
    expect((await unionPools([{ name: "off", size: 0, run }])).size).toBe(0);
    expect(run).not.toHaveBeenCalled();
  });

  it("passes the configured size to the pool", async () => {
    const run = vi.fn(async () => []);
    await unionPools([{ name: "recent", size: 7, run }]);
    expect(run).toHaveBeenCalledWith(7);
  });

  it("returns an empty union when every pool is empty", async () => {
    expect((await unionPools([{ name: "recent", size: 5, run: async () => [] }])).size).toBe(0);
  });
});

describe("pool definitions", () => {
  const anchor = makeArticle({ id: "anchor", publisherId: "p1", topics: ["x"] });
  const repo = createMemoryRepository({
    articles: [anchor, makeArticle({ id: "a", topics: ["x"], publishedAt: hoursAgo(2) })],
    reads: [{ articleId: "a", day: "2026-10-05", reads: 3 }],
    pins: [],
  });
  const config = loadDefaultConfig();

  it("feed uses the recent and popular pools", async () => {
    const filter = buildFilter(makeUser(), 60, NOW);
    const union = await unionPools(feedPools(repo, filter, config.profiles.feed, window, makeUser(), createRng(1)));
    expect(union.get("a")).toEqual(["recent", "popular"]);
  });

  it("gives the follows and topics pools size 0 for a user with neither", () => {
    const pools = feedPools(repo, buildFilter(makeUser(), 60, NOW), config.profiles.feed, window, makeUser(), createRng(1));
    expect(pools.filter((p) => p.size > 0).map((p) => p.name)).toEqual(["recent", "popular"]);
  });

  it("adds the follows and topics pools for a user with both", async () => {
    const user = makeUser({ followedPublishers: ["p1"], topicInterests: { x: 1 } });
    const union = await unionPools(feedPools(repo, buildFilter(user, 60, NOW), config.profiles.feed, window, user, createRng(1)));
    expect(union.get("a")).toEqual(["recent", "popular", "follows", "topics"]);
  });

  it("read next uses the similar, sameSource and popular pools", async () => {
    const filter = buildFilter(makeUser(), 365, NOW, "anchor");
    const union = await unionPools(readNextPools(repo, filter, config.profiles.readNext, anchor, window));
    expect(union.get("a")).toEqual(["similar", "sameSource", "popular"]);
    expect(union.has("anchor")).toBe(false);
  });
});

describe("exploration pool", () => {
  const articles = Array.from({ length: 30 }, (_, i) =>
    makeArticle({ id: `e${String(i).padStart(2, "0")}`, publisherId: `p${i}`, publishedAt: hoursAgo(i + 1) }),
  );
  const repo = createMemoryRepository({ articles, reads: [], pins: [] });
  const filter = buildFilter(makeUser(), 60, NOW);
  const profile = (surprise: number) => {
    const feed = loadDefaultConfig().profiles.feed;
    feed.pools.recent = 20;
    feed.pools.exploration = 5;
    feed.quotas = { enabled: true, topics: {}, follows: { communities: 0, publishers: 0 }, surprise };
    return feed;
  };
  const explored = async (seed: number) => {
    const union = await unionPools(feedPools(repo, filter, profile(0.2), window, makeUser(), createRng(seed)));
    return [...union].filter(([, pools]) => pools.includes("exploration")).map(([id]) => id);
  };
  const explorationSize = (feed: ReturnType<typeof profile>) =>
    feedPools(repo, filter, feed, window, makeUser(), createRng(1)).find((p) => p.name === "exploration")?.size;

  it("is off with the default config and when surprise is 0", () => {
    expect(explorationSize(loadDefaultConfig().profiles.feed)).toBe(0);
    expect(explorationSize(profile(0))).toBe(0);
    expect(explorationSize(profile(0.2))).toBe(5);
  });

  it("samples pools.exploration articles from the newest pools.recent unmatched ones", async () => {
    const ids = await explored(1);
    expect(ids).toHaveLength(5);
    const newest20 = articles.slice(0, 20).map((a) => a.id);
    for (const id of ids) expect(newest20).toContain(id);
  });

  it("gives the same sample for the same seed and differs across seeds", async () => {
    expect(await explored(1)).toEqual(await explored(1));
    const samples = new Set(await Promise.all([1, 2, 3, 4, 5].map(async (s) => (await explored(s)).join())));
    expect(samples.size).toBeGreaterThan(1);
  });

  it("asks the repository to leave out what the user follows or is interested in", async () => {
    const unmatched = vi.spyOn(repo, "unmatched");
    const user = makeUser({ topicInterests: { x: 1, y: 0 }, followedPublishers: ["p1"], followedCommunities: ["c1"] });
    await unionPools(feedPools(repo, filter, profile(0.2), window, user, createRng(1)));
    expect(unmatched).toHaveBeenCalledWith(filter, ["x"], ["p1"], ["c1"], 20);
  });
});
