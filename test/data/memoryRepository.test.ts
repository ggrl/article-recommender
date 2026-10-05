import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../../src/data/memoryRepository.ts";
import type { CandidateFilter } from "../../src/engine/types.ts";
import { DAY_MS, NOW, hoursAgo, makeArticle } from "../helpers.ts";

const filter = (overrides: Partial<CandidateFilter> = {}): CandidateFilter => ({
  statuses: ["published"],
  languages: ["en"],
  excludeIds: [],
  publishedSince: new Date(NOW.getTime() - 30 * DAY_MS),
  ...overrides,
});
const window = { fromDay: "2026-09-29", toDay: "2026-10-05" };

describe("recent", () => {
  it("returns matching articles newest first", async () => {
    const repo = createMemoryRepository({
      articles: [makeArticle({ id: "old", publishedAt: hoursAgo(10) }), makeArticle({ id: "new", publishedAt: hoursAgo(1) })],
      reads: [],
      pins: [],
    });
    expect(await repo.recent(filter(), 10)).toEqual(["new", "old"]);
  });

  it("applies every filter part before the limit", async () => {
    const repo = createMemoryRepository({
      articles: [
        makeArticle({ id: "read", publishedAt: hoursAgo(1) }),
        makeArticle({ id: "withdrawn", status: "withdrawn", publishedAt: hoursAgo(2) }),
        makeArticle({ id: "german", languages: ["de"], publishedAt: hoursAgo(3) }),
        makeArticle({ id: "tooOld", publishedAt: new Date(NOW.getTime() - 31 * DAY_MS) }),
        makeArticle({ id: "ok", publishedAt: hoursAgo(5) }),
      ],
      reads: [],
      pins: [],
    });
    expect(await repo.recent(filter({ excludeIds: ["read"] }), 1)).toEqual(["ok"]);
  });

  it("matches a fallback language and the age boundary", async () => {
    const boundary = new Date(NOW.getTime() - 30 * DAY_MS);
    const repo = createMemoryRepository({
      articles: [makeArticle({ id: "edge", languages: ["de"], publishedAt: boundary })],
      reads: [],
      pins: [],
    });
    expect(await repo.recent(filter({ languages: ["en", "de"] }), 10)).toEqual(["edge"]);
  });
});

describe("popular", () => {
  it("orders by reads inside the window and leaves out zero reads", async () => {
    const repo = createMemoryRepository({
      articles: [makeArticle({ id: "a" }), makeArticle({ id: "b" }), makeArticle({ id: "c" })],
      reads: [
        { articleId: "a", day: "2026-10-05", reads: 5 },
        { articleId: "b", day: "2026-10-04", reads: 7 },
        { articleId: "c", day: "2026-09-01", reads: 100 },
      ],
      pins: [],
    });
    expect(await repo.popular(filter(), window, 10)).toEqual(["b", "a"]);
  });
});

describe("similar and sameSource", () => {
  const anchor = makeArticle({ id: "anchor", publisherId: "p1", communityIds: ["c1"], topics: ["x"] });
  const repo = createMemoryRepository({
    articles: [
      makeArticle({ id: "topic", publisherId: "p2", topics: ["x"] }),
      makeArticle({ id: "publisher", publisherId: "p1", topics: ["y"] }),
      makeArticle({ id: "community", publisherId: "p3", communityIds: ["c1"] }),
      makeArticle({ id: "none", publisherId: "p4", topics: ["y"] }),
    ],
    reads: [],
    pins: [],
  });

  it("similar returns topic overlap only", async () => {
    expect(await repo.similar(anchor, filter(), 10)).toEqual(["topic"]);
  });

  it("sameSource returns same publisher or shared community", async () => {
    expect((await repo.sameSource(anchor, filter(), 10)).sort()).toEqual(["community", "publisher"]);
  });
});

describe("follows and topics", () => {
  const repo = createMemoryRepository({
    articles: [
      makeArticle({ id: "byPublisher", publisherId: "p1", publishedAt: hoursAgo(3) }),
      makeArticle({ id: "byCommunity", publisherId: "p2", communityIds: ["c1"], publishedAt: hoursAgo(2) }),
      makeArticle({ id: "withdrawn", publisherId: "p1", status: "withdrawn", publishedAt: hoursAgo(1) }),
      makeArticle({ id: "gardening", publisherId: "p3", topics: ["gardening"], publishedAt: hoursAgo(4) }),
      makeArticle({ id: "unrelated", publisherId: "p4", topics: ["sport"], publishedAt: hoursAgo(5) }),
    ],
    reads: [],
    pins: [],
  });

  it("follows returns followed publishers and communities newest first, filtered before the limit", async () => {
    expect(await repo.follows(filter(), ["p1"], ["c1"], 10)).toEqual(["byCommunity", "byPublisher"]);
    expect(await repo.follows(filter(), ["p1"], ["c1"], 1)).toEqual(["byCommunity"]);
  });

  it("topics returns articles sharing a given topic", async () => {
    expect(await repo.topics(filter(), ["gardening", "climate"], 10)).toEqual(["gardening"]);
  });
});

describe("loads", () => {
  const repo = createMemoryRepository({
    articles: [makeArticle({ id: "a" }), makeArticle({ id: "b" })],
    reads: [
      { articleId: "a", day: "2026-10-05", reads: 2 },
      { articleId: "a", day: "2026-10-04", reads: 3 },
      { articleId: "a", day: "2026-09-01", reads: 50 },
    ],
    pins: [],
  });

  it("getArticles keeps the asked order and skips unknown IDs", async () => {
    expect((await repo.getArticles(["b", "missing", "a"])).map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("getReads sums reads inside the window", async () => {
    expect(await repo.getReads(["a", "b"], window)).toEqual(new Map([["a", 5]]));
  });
});
