import { describe, expect, it } from "vitest";
import { MAX_SEED, createRng, randomSeed } from "../src/engine/rng.ts";

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
