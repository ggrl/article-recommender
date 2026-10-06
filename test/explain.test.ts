import { describe, expect, it } from "vitest";
import { reasonsFor, slotReasons } from "../src/engine/explain.ts";

const entry = (contribution: number) => ({ score: contribution, weight: 1, contribution });

describe("reasonsFor", () => {
  it("names the two largest contributions, largest first", () => {
    expect(reasonsFor({ recency: entry(0.2), popularity: entry(0.5), similarity: entry(0.9) }, 7)).toEqual([
      "Related to the article you're reading",
      "Popular this week",
    ]);
  });

  it("leaves out criteria that contributed nothing", () => {
    expect(reasonsFor({ recency: entry(0.4), popularity: entry(0) }, 7)).toEqual(["New"]);
  });

  it("uses the configured window in the popularity text", () => {
    expect(reasonsFor({ popularity: entry(0.4) }, 14)).toEqual(["Popular in the last 14 days"]);
  });

  it("falls back to a generic reason when nothing contributed", () => {
    expect(reasonsFor({ popularity: entry(0) }, 7)).toEqual(["Recommended for you"]);
  });

  it("throws for a criterion without a template", () => {
    expect(() => reasonsFor({ mystery: entry(1) }, 7)).toThrow(/mystery/);
  });

  it("names the matched topic", () => {
    expect(reasonsFor({ topics: { ...entry(0.5), detail: "gardening" } }, 7)).toEqual(["Matches your interest in gardening"]);
  });

  it("says which kind of follow matched", () => {
    expect(reasonsFor({ follows: { ...entry(0.8), detail: "publisher" } }, 7)).toEqual(["From a publisher you follow"]);
    expect(reasonsFor({ follows: { ...entry(0.8), detail: "community" } }, 7)).toEqual(["From a community you follow"]);
  });

  it("throws for a topics or follows reason without its detail", () => {
    expect(() => reasonsFor({ topics: entry(0.5) }, 7)).toThrow(/needs the matched topic/);
    expect(() => reasonsFor({ follows: entry(0.5) }, 7)).toThrow(/needs "publisher" or "community"/);
  });
});

describe("slotReasons", () => {
  const breakdown = { recency: entry(0.4), popularity: entry(0.2) };

  it("gives a surprise item only the surprise reason", () => {
    expect(slotReasons({ slotType: "surprise" }, breakdown, 7)).toEqual(["Something outside your usual topics"]);
  });

  it("puts the featured topic first, two reasons at most", () => {
    expect(slotReasons({ slotType: "quota", featuredTopic: "climate" }, breakdown, 7)).toEqual(["Featured topic: climate", "New"]);
  });

  it("keeps the usual reasons for every other slot", () => {
    expect(slotReasons({ slotType: "quota" }, breakdown, 7)).toEqual(["New", "Popular this week"]);
    expect(slotReasons({ slotType: "ranked" }, breakdown, 7)).toEqual(["New", "Popular this week"]);
  });
});
