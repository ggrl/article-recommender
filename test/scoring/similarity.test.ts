import { describe, expect, it } from "vitest";
import { sharesSource, similarity, similarityScore } from "../../src/engine/scoring/similarity.ts";
import { makeArticle, makeContext } from "../helpers.ts";

const anchor = makeArticle({ id: "anchor", publisherId: "p1", communityIds: ["c1"], topics: ["a", "b"] });

describe("similarityScore", () => {
  it("is 1 for identical topics from another source", () => {
    expect(similarityScore(makeArticle({ id: "x", publisherId: "p2", topics: ["a", "b"] }), anchor)).toBe(1);
  });

  it("is the Jaccard overlap of topics", () => {
    expect(similarityScore(makeArticle({ id: "x", publisherId: "p2", topics: ["b", "c"] }), anchor)).toBeCloseTo(1 / 3);
  });

  it("is 0 with no shared topic and another source", () => {
    expect(similarityScore(makeArticle({ id: "x", publisherId: "p2", topics: ["z"] }), anchor)).toBe(0);
  });

  it("adds 0.3 for the same publisher", () => {
    expect(similarityScore(makeArticle({ id: "x", publisherId: "p1", topics: ["z"] }), anchor)).toBeCloseTo(0.3);
  });

  it("adds 0.3 for a shared community", () => {
    expect(similarityScore(makeArticle({ id: "x", publisherId: "p2", communityIds: ["c1"] }), anchor)).toBeCloseTo(0.3);
  });

  it("clips at 1", () => {
    expect(similarityScore(makeArticle({ id: "x", publisherId: "p1", topics: ["a", "b"] }), anchor)).toBe(1);
  });

  it("is 0 when neither has topics and sources differ", () => {
    const bare = makeArticle({ id: "y", publisherId: "p9" });
    expect(similarityScore(makeArticle({ id: "x", publisherId: "p2" }), bare)).toBe(0);
  });
});

describe("sharesSource", () => {
  it("is false for a different publisher and no shared community", () => {
    expect(sharesSource(makeArticle({ id: "x", publisherId: "p2", communityIds: ["c2"] }), anchor)).toBe(false);
  });
});

describe("similarity criterion", () => {
  it("scores against the context anchor", () => {
    const scores = similarity.score([makeArticle({ id: "x", publisherId: "p2", topics: ["a", "b"] })], makeContext({ anchor }));
    expect(scores.get("x")).toBe(1);
  });

  it("throws without an anchor", () => {
    expect(() => similarity.score([anchor], makeContext())).toThrow(/anchor/);
  });
});
