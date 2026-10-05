import { describe, expect, it } from "vitest";
import { popularity, popularityScores, popularityWindow, toDay } from "../../src/engine/scoring/popularity.ts";
import { NOW, makeArticle, makeContext } from "../helpers.ts";

const a = makeArticle({ id: "a", publisherId: "p1" });
const b = makeArticle({ id: "b", publisherId: "p1" });
const c = makeArticle({ id: "c", publisherId: "p2" });

describe("popularityScores", () => {
  it("maps the most-read candidate to 1 and zero reads to 0", () => {
    const scores = popularityScores([a, b, c], new Map([["a", 99], ["b", 9]]), false);
    expect(scores.get("a")).toBe(1);
    expect(scores.get("b")).toBeCloseTo(Math.log(10) / Math.log(100));
    expect(scores.get("c")).toBe(0);
  });

  it("gives 0 to everyone when nobody has reads", () => {
    const scores = popularityScores([a, b], new Map(), false);
    expect([...scores.values()]).toEqual([0, 0]);
  });

  it("returns an empty map for no candidates", () => {
    expect(popularityScores([], new Map(), false).size).toBe(0);
  });

  it("normalises per publisher when asked", () => {
    const scores = popularityScores([a, b, c], new Map([["a", 99], ["b", 9], ["c", 3]]), true);
    expect(scores.get("a")).toBe(1);
    expect(scores.get("c")).toBe(1);
  });
});

describe("popularityWindow", () => {
  it("covers the last windowDays UTC days including today", () => {
    expect(popularityWindow(NOW, 7)).toEqual({ fromDay: "2026-09-29", toDay: "2026-10-05" });
  });

  it("is just today for a one-day window", () => {
    expect(popularityWindow(NOW, 1)).toEqual({ fromDay: "2026-10-05", toDay: "2026-10-05" });
  });

  it("formats a date as its UTC day", () => {
    expect(toDay(new Date("2026-10-05T23:30:00Z"))).toBe("2026-10-05");
  });
});

describe("popularity criterion", () => {
  it("uses the context reads and profile setting", () => {
    const scores = popularity.score([a, c], makeContext({ reads: new Map([["a", 5]]) }));
    expect(scores.get("a")).toBe(1);
    expect(scores.get("c")).toBe(0);
  });
});
