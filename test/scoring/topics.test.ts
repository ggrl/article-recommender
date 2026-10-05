import { describe, expect, it } from "vitest";
import { interestedTopics, positiveInterests, topics, topicsScore } from "../../src/engine/scoring/topics.ts";
import { makeArticle, makeContext, makeUser } from "../helpers.ts";

const interests = positiveInterests({ gardening: 0.25, culture: 0.25, politics: 1 });

describe("topicsScore", () => {
  it("is 0 for a user without interests", () => {
    expect(topicsScore(["gardening"], positiveInterests({}))).toBe(0);
  });

  it("is 0 for an article without topics", () => {
    expect(topicsScore([], interests)).toBe(0);
  });

  it("is 1 for the strongest interest, naming it", () => {
    expect(topicsScore(["politics"], interests)).toEqual({ score: 1, detail: "politics" });
  });

  it("is proportional for a weaker interest", () => {
    expect(topicsScore(["gardening"], interests)).toEqual({ score: 0.25, detail: "gardening" });
  });

  it("adds weaker interests up and names the alphabetically first on a tie", () => {
    expect(topicsScore(["gardening", "culture"], interests)).toEqual({ score: 0.5, detail: "culture" });
  });

  it("clamps at 1 and names the strongest match", () => {
    expect(topicsScore(["gardening", "culture", "politics"], interests)).toEqual({ score: 1, detail: "politics" });
  });

  it("counts a repeated topic once", () => {
    expect(topicsScore(["gardening", "gardening"], interests)).toEqual({ score: 0.25, detail: "gardening" });
  });

  it("ignores an interest of 0", () => {
    const withZero = positiveInterests({ gardening: 0, politics: 0.5 });
    expect(topicsScore(["gardening"], withZero)).toBe(0);
  });
});

describe("interestedTopics", () => {
  it("lists only interests above 0", () => {
    expect(interestedTopics(makeUser({ topicInterests: { a: 0.5, b: 0 } }))).toEqual(["a"]);
  });
});

describe("topics criterion", () => {
  it("scores against the context user's interests", () => {
    const user = makeUser({ topicInterests: { gardening: 1 } });
    const scores = topics.score([makeArticle({ id: "g", topics: ["gardening"] })], makeContext({ user }));
    expect(scores.get("g")).toEqual({ score: 1, detail: "gardening" });
  });
});
