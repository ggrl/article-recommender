import { describe, expect, it } from "vitest";
import { recency, recencyScore } from "../../src/engine/scoring/recency.ts";
import { NOW, hoursAgo, makeArticle, makeContext } from "../helpers.ts";

describe("recencyScore", () => {
  it("is 1 for an article published now", () => {
    expect(recencyScore(NOW, NOW, 48)).toBe(1);
  });

  it("halves after one half-life", () => {
    expect(recencyScore(hoursAgo(48), NOW, 48)).toBeCloseTo(0.5);
  });

  it("is higher for newer articles", () => {
    expect(recencyScore(hoursAgo(10), NOW, 48)).toBeGreaterThan(recencyScore(hoursAgo(20), NOW, 48));
  });

  it("treats a future date as brand new", () => {
    expect(recencyScore(hoursAgo(-5), NOW, 48)).toBe(1);
  });
});

describe("recency criterion", () => {
  it("scores every candidate with the profile half-life", () => {
    const articles = [makeArticle({ id: "a", publishedAt: NOW }), makeArticle({ id: "b", publishedAt: hoursAgo(48) })];
    const scores = recency.score(articles, makeContext());
    expect(scores.get("a")).toBe(1);
    expect(scores.get("b")).toBeCloseTo(0.5);
  });

  it("returns an empty map for no candidates", () => {
    expect(recency.score([], makeContext()).size).toBe(0);
  });
});
