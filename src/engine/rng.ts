/** mulberry32: a small seeded generator, so the same seed always gives the same sequence. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** mulberry32 keeps 32 bits of state, so larger seeds would collide. */
export const MAX_SEED = 0xffff_ffff;

/** The seed for a request that sent none (D26); the only place the engine reads randomness. */
export function randomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

/** Up to n items without replacement (partial Fisher-Yates); the input is not changed. */
export function sample<T>(items: readonly T[], n: number, rng: () => number): T[] {
  const pool = [...items];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
