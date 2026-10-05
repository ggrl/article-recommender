import { describe, expect, it, vi } from "vitest";
import { criteria, scoreCandidates } from "../../src/engine/scoring/index.ts";
import type { Article, ArticleId, Criterion, CriterionScore } from "../../src/engine/types.ts";
import { makeArticle, makeContext } from "../helpers.ts";

const constant = (id: string, value: number): Criterion => ({
  id,
  score: (candidates: Article[]) => new Map(candidates.map((a): [ArticleId, number] => [a.id, value])),
});
const candidates = [{ article: makeArticle({ id: "a" }), sourcePools: ["recent"] }];

describe("scoreCandidates", () => {
  it("divides the weighted sum by the total weight", () => {
    const [scored] = scoreCandidates(candidates, { one: 1, zero: 3 }, makeContext(), [constant("one", 1), constant("zero", 0)]);
    expect(scored?.finalScore).toBeCloseTo(0.25);
    expect(scored?.breakdown).toEqual({
      one: { score: 1, weight: 1, contribution: 1 },
      zero: { score: 0, weight: 3, contribution: 0 },
    });
    expect(scored?.sourcePools).toEqual(["recent"]);
  });

  it("does not compute or report a criterion with weight 0", () => {
    const off = constant("off", 1);
    const spy = vi.spyOn(off, "score");
    const [scored] = scoreCandidates(candidates, { one: 1, off: 0 }, makeContext(), [constant("one", 1), off]);
    expect(spy).not.toHaveBeenCalled();
    expect(scored?.breakdown).not.toHaveProperty("off");
  });

  it("treats a missing weight as off", () => {
    const [scored] = scoreCandidates(candidates, { one: 1 }, makeContext(), [constant("one", 1), constant("missing", 1)]);
    expect(Object.keys(scored?.breakdown ?? {})).toEqual(["one"]);
  });

  it("registers every criterion", () => {
    expect(criteria.map((c) => c.id)).toEqual(["recency", "popularity", "similarity", "topics", "follows"]);
  });

  it("copies a criterion's detail into the breakdown", () => {
    const detailed: Criterion = {
      id: "d",
      score: (articles: Article[]) =>
        new Map(articles.map((a): [ArticleId, CriterionScore] => [a.id, { score: 0.5, detail: "gardening" }])),
    };
    const [scored] = scoreCandidates(candidates, { d: 1 }, makeContext(), [detailed]);
    expect(scored?.breakdown.d).toEqual({ score: 0.5, weight: 1, contribution: 0.5, detail: "gardening" });
    expect(scored?.finalScore).toBe(0.5);
  });

  it("gives a plain-number criterion no detail", () => {
    const [scored] = scoreCandidates(candidates, { one: 1 }, makeContext(), [constant("one", 1)]);
    expect(scored?.breakdown.one).not.toHaveProperty("detail");
  });
});
