import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../src/data/memoryRepository.ts";
import { generateSeed } from "../src/data/seed.ts";
import { createRecommender } from "../src/engine/recommend.ts";
import { NOW, loadDefaultConfig } from "./helpers.ts";

const data = generateSeed(42, NOW);
const recommender = createRecommender({ repository: createMemoryRepository(data), config: loadDefaultConfig() });
const [coldStart] = data.users;
const seeded = data.users[1];
const feed = { mode: "feed", user: coldStart, limit: 20, now: NOW };
const seededFeed = { mode: "feed", user: seeded, limit: 20, now: NOW };

describe("on seed data", () => {
  it("gives the cold-start user a full-length feed", async () => {
    expect((await recommender.recommend(feed)).items).toHaveLength(20);
  });

  it("shows both seed pins to the cold-start user at ranks 1 and 4", async () => {
    const pins = (await recommender.recommend(feed)).items.filter((i) => i.slotType === "pin");
    expect(pins.map((i) => i.rank)).toEqual([1, 4]);
  });

  it("returns identical output for an identical request", async () => {
    expect(await recommender.recommend(feed)).toEqual(await recommender.recommend(feed));
  });

  it("returns identical output for an identical request, seeded user", async () => {
    expect(await recommender.recommend(seededFeed)).toEqual(await recommender.recommend(seededFeed));
  });

  it("never repeats an article for any sample user", async () => {
    for (const user of data.users) {
      const ids = (await recommender.recommend({ ...feed, user })).items.map((i) => i.articleId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("never exceeds the per-publisher cap in the cold-start feed", async () => {
    const byId = new Map(data.articles.map((a) => [a.id, a] as const));
    const { items } = await recommender.recommend(feed);
    const counts = new Map<string, number>();
    for (const item of items.filter((i) => i.slotType === "ranked")) {
      const publisherId = byId.get(item.articleId)?.publisherId;
      if (publisherId !== undefined) counts.set(publisherId, (counts.get(publisherId) ?? 0) + 1);
    }
    for (const count of counts.values()) expect(count).toBeLessThanOrEqual(3);
  });

  it("serves a feed over 2,000 articles in under 100 ms", async () => {
    await recommender.recommend(feed); // warm-up, so start-up cost is not measured
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await recommender.recommend(feed);
      times.push(performance.now() - start);
    }
    const median = times.sort((a, b) => a - b)[2];
    expect(median).toBeLessThan(100);
  });

  it("serves a feed over 2,000 articles in under 100 ms, seeded user", async () => {
    await recommender.recommend(seededFeed); // warm-up, so start-up cost is not measured
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await recommender.recommend(seededFeed);
      times.push(performance.now() - start);
    }
    const median = times.sort((a, b) => a - b)[2];
    expect(median).toBeLessThan(100);
  });
});
