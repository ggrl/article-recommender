import { describe, expect, it } from "vitest";
import { MAX_SEED, createRng, randomSeed, sample } from "../src/engine/rng.ts";

describe("createRng", () => {
  it("repeats the same sequence for the same seed and stays in [0, 1)", () => {
    const a = createRng(7);
    const b = createRng(7);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("gives the sequence the seed data was generated with", () => {
    const rng = createRng(42);
    expect([rng(), rng(), rng()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
  });
});

describe("randomSeed", () => {
  it("is an integer in [0, MAX_SEED]", () => {
    for (let i = 0; i < 100; i++) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(MAX_SEED);
    }
  });
});

describe("sample", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("picks n distinct items, the same ones for the same seed", () => {
    const first = sample(items, 3, createRng(1));
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(sample(items, 3, createRng(1))).toEqual(first);
  });

  it("returns every item when n is not smaller than the list", () => {
    expect(sample(items, 10, createRng(1)).sort()).toEqual(items);
  });

  it("does not change its input", () => {
    sample(items, 3, createRng(1));
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("varies with the seed", () => {
    const picks = new Set(Array.from({ length: 20 }, (_, s) => sample(items, 2, createRng(s)).join()));
    expect(picks.size).toBeGreaterThan(1);
  });
});
