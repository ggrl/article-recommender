import { describe, expect, it } from "vitest";
import { followMatch, follows } from "../../src/engine/scoring/follows.ts";
import { makeArticle, makeContext, makeUser } from "../helpers.ts";

const article = makeArticle({ id: "a", publisherId: "p1", communityIds: ["c1"] });

describe("followMatch", () => {
  it("matches a followed publisher", () => {
    expect(followMatch(article, ["p1"], [])).toBe("publisher");
  });

  it("matches a followed community", () => {
    expect(followMatch(article, [], ["c1"])).toBe("community");
  });

  it("prefers the publisher when both match", () => {
    expect(followMatch(article, ["p1"], ["c1"])).toBe("publisher");
  });

  it("matches nothing otherwise", () => {
    expect(followMatch(article, ["p2"], ["c2"])).toBeUndefined();
  });
});

describe("follows criterion", () => {
  it("gives 1 with the kind of follow, and 0 for no follow", () => {
    const user = makeUser({ followedCommunities: ["c1"] });
    const other = makeArticle({ id: "b", publisherId: "p2" });
    const scores = follows.score([article, other], makeContext({ user }));
    expect(scores.get("a")).toEqual({ score: 1, detail: "community" });
    expect(scores.get("b")).toBe(0);
  });
});
