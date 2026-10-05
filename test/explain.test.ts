import { describe, expect, it } from "vitest";
import { reasonsFor } from "../src/engine/explain.ts";

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
});
