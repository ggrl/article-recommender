import { describe, expect, it } from "vitest";
import { generateSeed } from "../../src/data/seed.ts";
import { DAY_MS, NOW } from "../helpers.ts";

describe("generateSeed", () => {
  const data = generateSeed(42, NOW);

  it("has the shape the work order asks for", () => {
    expect(data.publishers).toHaveLength(30);
    expect(new Set(data.publishers.map((p) => p.country)).size).toBe(12);
    expect(data.articles).toHaveLength(2000);
    expect(new Set(data.articles.flatMap((a) => a.topics)).size).toBe(15);
    expect(new Set(data.articles.flatMap((a) => a.communityIds)).size).toBe(20);
    expect(new Set(data.articles.flatMap((a) => a.languages)).size).toBe(8);
    expect(data.users).toHaveLength(5);
    expect(data.users[0]?.userId).toBeUndefined();
    expect(data.pins).toHaveLength(2);
  });

  it("dates every article within the last 90 days", () => {
    expect(data.articles.every((a) => a.publishedAt.getTime() > NOW.getTime() - 90 * DAY_MS)).toBe(true);
  });

  it("has two pins active now", () => {
    expect(data.pins.every((p) => p.startsAt.getTime() <= NOW.getTime() && NOW.getTime() < p.expiresAt.getTime())).toBe(true);
  });

  it("is deterministic for a seed and differs across seeds", () => {
    expect(generateSeed(42, NOW)).toEqual(data);
    expect(generateSeed(43, NOW).articles).not.toEqual(data.articles);
  });
});
