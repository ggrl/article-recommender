import { describe, expect, it } from "vitest";
import { assemble, type AssembledItem } from "../src/engine/assembly/index.ts";
import { activePins, placePins } from "../src/engine/assembly/pins.ts";
import { buildFilter } from "../src/engine/candidates.ts";
import type { Quotas } from "../src/engine/config.ts";
import type { Article, ScoredCandidate } from "../src/engine/types.ts";
import { DAY_MS, NOW, hoursAgo, makeArticle, makePin, makeUser } from "./helpers.ts";

const scored = (id: string, finalScore: number, publisherId = id, hours = 1): ScoredCandidate => ({
  article: makeArticle({ id, publisherId, publishedAt: hoursAgo(hours) }),
  sourcePools: ["recent"],
  finalScore,
  breakdown: {},
});
const ids = (items: AssembledItem[]) => items.map((i) => (i.kind === "pin" ? `pin:${i.pin.articleId}` : i.candidate.article.id));

describe("activePins", () => {
  const articles = new Map([
    ["en", makeArticle({ id: "en", languages: ["en"] })],
    ["de", makeArticle({ id: "de", languages: ["de"] })],
    ["withdrawn", makeArticle({ id: "withdrawn", status: "withdrawn" })],
    ["embargoed", makeArticle({ id: "embargoed", status: "embargoed" })],
    ["old", makeArticle({ id: "old", publishedAt: new Date(NOW.getTime() - 61 * DAY_MS) })],
  ]);
  const active = (pin: ReturnType<typeof makePin>, user = makeUser()) =>
    activePins([pin], articles, user, NOW, buildFilter(user, 60, NOW)).length === 1;

  it("keeps a running pin in a language the user reads", () => {
    expect(active(makePin({ articleId: "en" }))).toBe(true);
  });

  it("includes the start and excludes the expiry instant", () => {
    expect(active(makePin({ articleId: "en", startsAt: NOW }))).toBe(true);
    expect(active(makePin({ articleId: "en", expiresAt: NOW }))).toBe(false);
  });

  it("drops a pin that has not started", () => {
    expect(active(makePin({ articleId: "en", startsAt: hoursAgo(-1) }))).toBe(false);
  });

  it("drops a pin whose article is not in a language the user reads", () => {
    expect(active(makePin({ articleId: "de" }))).toBe(false);
    expect(active(makePin({ articleId: "de" }), makeUser({ fallbackLanguages: ["de"] }))).toBe(true);
  });

  it("applies language targeting to the user's main language", () => {
    expect(active(makePin({ articleId: "en", languages: ["hr"] }))).toBe(false);
    expect(active(makePin({ articleId: "en", languages: ["en"] }))).toBe(true);
  });

  it("does not match a region-targeted pin for a user without a region", () => {
    expect(active(makePin({ articleId: "en", regions: ["HR"] }))).toBe(false);
    expect(active(makePin({ articleId: "en", regions: ["HR"] }), makeUser({ region: "HR" }))).toBe(true);
  });

  it("drops a pin whose article is withdrawn or embargoed", () => {
    expect(active(makePin({ articleId: "withdrawn" }))).toBe(false);
    expect(active(makePin({ articleId: "embargoed" }))).toBe(false);
  });

  it("drops a pin whose article the user already read", () => {
    expect(active(makePin({ articleId: "en" }), makeUser({ readArticleIds: ["en"] }))).toBe(false);
  });

  it("drops a pin whose article is older than the maximum age", () => {
    expect(active(makePin({ articleId: "old" }))).toBe(false);
  });

  it("drops a pin whose article does not exist", () => {
    expect(active(makePin({ articleId: "missing" }))).toBe(false);
  });
});

describe("placePins", () => {
  it("gives a clashing slot to the earlier start and moves the other on", () => {
    const early = makePin({ articleId: "early", position: 1, startsAt: hoursAgo(48) });
    const late = makePin({ articleId: "late", position: 1, startsAt: hoursAgo(2) });
    expect(placePins([late, early], 10)).toEqual(new Map([[1, early], [2, late]]));
  });

  it("drops a pin at or beyond the limit", () => {
    expect(placePins([makePin({ articleId: "x", position: 5 })], 5).size).toBe(0);
  });
});

describe("assemble", () => {
  it("puts a pin at its position regardless of score, once", () => {
    const pins = new Map([[1, makePin({ articleId: "low", position: 1 })]]);
    const items = assemble([scored("a", 0.9), scored("b", 0.8), scored("low", 0.01)], pins, 3, 3);
    expect(ids(items)).toEqual(["a", "pin:low", "b"]);
  });

  it("puts a pin at the end when the list is shorter than its position", () => {
    const pins = new Map([[5, makePin({ articleId: "p", position: 5 })]]);
    expect(ids(assemble([scored("a", 0.9)], pins, 10, 3))).toEqual(["a", "pin:p"]);
  });

  it("respects the publisher cap", () => {
    const items = assemble([scored("a", 0.9, "p1"), scored("b", 0.8, "p1"), scored("c", 0.7, "p1"), scored("d", 0.1, "p2")], new Map(), 3, 2);
    expect(ids(items)).toEqual(["a", "b", "d"]);
  });

  it("does not count pins toward the publisher cap", () => {
    const pinned = new Map([[0, makePin({ articleId: "pinned", position: 0 })]]);
    const items = assemble([scored("a", 0.9, "p1")], pinned, 2, 1);
    expect(ids(items)).toEqual(["pin:pinned", "a"]);
  });

  it("orders by score, then newer first, then lower ID", () => {
    const items = assemble([scored("b", 0.5, "p1", 5), scored("a", 0.5, "p2", 5), scored("new", 0.5, "p3", 1), scored("top", 0.9, "p4")], new Map(), 10, 3);
    expect(ids(items)).toEqual(["top", "new", "a", "b"]);
  });

  it("fills only limit minus pins ranked slots", () => {
    const pins = new Map([[0, makePin({ articleId: "p", position: 0 })]]);
    expect(assemble([scored("a", 0.9), scored("b", 0.8)], pins, 2, 3)).toHaveLength(2);
  });

  it("marks every item ranked without quotas", () => {
    const items = assemble([scored("a", 0.9), scored("b", 0.8)], new Map(), 2, 3);
    expect(items.map((i) => (i.kind === "scored" ? i.slotType : "pin"))).toEqual(["ranked", "ranked"]);
  });
});

describe("assemble with quotas", () => {
  const quotas = (overrides: Partial<Quotas> = {}): Quotas => ({
    enabled: true,
    topics: {},
    follows: { communities: 0, publishers: 0 },
    surprise: 0,
    ...overrides,
  });
  const user = makeUser({ followedPublishers: ["fp"], followedCommunities: ["fc"] });
  const member = (id: string, finalScore: number, article: Partial<Article>, sourcePools = ["recent"]): ScoredCandidate => ({
    article: makeArticle({ id, publisherId: id, ...article }),
    sourcePools,
    finalScore,
    breakdown: {},
  });
  const top = (n: number) => Array.from({ length: n }, (_, i) => scored(`t${i}`, 0.9 - i * 0.01));
  const slots = (items: AssembledItem[]) =>
    items.map((i) => (i.kind === "pin" ? `pin:${i.pin.articleId}` : `${i.candidate.article.id}:${i.slotType}`));

  it("reserves a share for followed publishers even when they score lowest", () => {
    const candidates = [...top(10), member("f1", 0.1, { publisherId: "fp" }), member("f2", 0.05, { publisherId: "fp" })];
    const items = assemble(candidates, new Map(), 10, 3, { quotas: quotas({ follows: { communities: 0, publishers: 0.2 } }), user });
    expect(slots(items)).toEqual([...top(8).map((c) => `${c.article.id}:ranked`), "f1:quota", "f2:quota"]);
  });

  it("leaves the slots of a short bucket to the normal fill", () => {
    const candidates = [...top(5), member("c1", 0.1, { communityIds: ["fc"] })];
    const items = assemble(candidates, new Map(), 4, 3, { quotas: quotas({ follows: { communities: 0.5, publishers: 0 } }), user });
    expect(slots(items)).toEqual(["t0:ranked", "t1:ranked", "t2:ranked", "c1:quota"]);
  });

  it("counts an article in two buckets once, in the earlier bucket", () => {
    const candidates = [
      ...top(2),
      member("both", 0.1, { publisherId: "fp", topics: ["climate"] }),
      member("f2", 0.05, { publisherId: "fp" }),
    ];
    const items = assemble(candidates, new Map(), 4, 3, {
      quotas: quotas({ topics: { climate: 0.25 }, follows: { communities: 0, publishers: 0.25 } }),
      user,
    });
    expect(slots(items)).toEqual(["t0:ranked", "t1:ranked", "both:quota", "f2:quota"]);
    const both = items.find((i) => i.kind === "scored" && i.candidate.article.id === "both");
    expect(both?.kind === "scored" && both.featuredTopic).toBe("climate");
  });

  it("caps over-booked rounding at the slots still free", () => {
    // round(0.5 * 3) = 2 for each topic; the second gets the 1 slot left.
    const candidates = [
      ...top(3),
      member("a1", 0.2, { topics: ["a"] }),
      member("a2", 0.19, { topics: ["a"] }),
      member("b1", 0.18, { topics: ["b"] }),
      member("b2", 0.17, { topics: ["b"] }),
    ];
    const items = assemble(candidates, new Map(), 3, 3, { quotas: quotas({ topics: { a: 0.5, b: 0.5 } }), user });
    expect(slots(items)).toEqual(["a1:quota", "a2:quota", "b1:quota"]);
  });

  it("fills the surprise bucket from the exploration pool", () => {
    const candidates = [...top(4), member("x", 0.01, {}, ["exploration"])];
    const items = assemble(candidates, new Map(), 4, 3, { quotas: quotas({ surprise: 0.25 }), user });
    expect(slots(items)).toEqual(["t0:ranked", "t1:ranked", "t2:ranked", "x:surprise"]);
  });

  it("holds the publisher cap across reserved and filled slots", () => {
    const candidates = [
      member("samePublisher", 0.9, { publisherId: "pX" }),
      member("other", 0.5, { publisherId: "pO" }),
      member("c1", 0.1, { publisherId: "pX", communityIds: ["fc"] }),
    ];
    const items = assemble(candidates, new Map(), 2, 1, { quotas: quotas({ follows: { communities: 0.5, publishers: 0 } }), user });
    expect(slots(items)).toEqual(["other:ranked", "c1:quota"]);
  });

  it("orders reserved items among the rest by score", () => {
    const candidates = [scored("t0", 0.9), scored("t1", 0.8), member("x", 0.95, {}, ["exploration"])];
    const items = assemble(candidates, new Map(), 2, 3, { quotas: quotas({ surprise: 0.5 }), user });
    expect(slots(items)).toEqual(["x:surprise", "t0:ranked"]);
  });

  it("computes shares over the slots left after pins", () => {
    // 3 slots minus 1 pin leaves 2; round(0.5 * 2) = 1 surprise slot.
    const pins = new Map([[0, makePin({ articleId: "p", position: 0 })]]);
    const candidates = [...top(3), member("x", 0.01, {}, ["exploration"]), member("y", 0.005, {}, ["exploration"])];
    const items = assemble(candidates, pins, 3, 3, { quotas: quotas({ surprise: 0.5 }), user });
    expect(slots(items)).toEqual(["pin:p", "t0:ranked", "x:surprise"]);
  });

  it("fills featured topics alphabetically, whatever the config order", () => {
    const candidates = [member("both", 0.5, { topics: ["a", "b"] }), member("b1", 0.4, { topics: ["b"] })];
    const items = assemble(candidates, new Map(), 2, 3, { quotas: quotas({ topics: { b: 0.5, a: 0.5 } }), user });
    const both = items.find((i) => i.kind === "scored" && i.candidate.article.id === "both");
    expect(both?.kind === "scored" && both.featuredTopic).toBe("a");
  });
});
