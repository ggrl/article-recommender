import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../src/data/memoryRepository.ts";
import { generateSeed } from "../src/data/seed.ts";
import { createRecommender } from "../src/engine/recommend.ts";
import { buildServer } from "../src/http/server.ts";
import { NOW, loadDefaultConfig } from "./helpers.ts";

const data = generateSeed(42, NOW);
const app = buildServer(createRecommender({ repository: createMemoryRepository(data), config: loadDefaultConfig() }));
const [user] = data.users;
const post = (payload: object) => app.inject({ method: "POST", url: "/recommend", payload });

describe("HTTP demo", () => {
  it("answers the health check", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("serves a feed for a given now", async () => {
    const res = await post({ mode: "feed", user, limit: 5, now: NOW.toISOString() });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(5);
  });

  it("uses the server clock when now is missing", async () => {
    const res = await post({ mode: "feed", user, limit: 5 });
    expect(res.statusCode).toBe(200);
  });

  it("answers 400 for an invalid request", async () => {
    const res = await post({ mode: "feed", user, limit: 0 });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/limit/);
  });

  it("answers 400 for an unparseable now", async () => {
    expect((await post({ mode: "feed", user, limit: 5, now: "yesterday-ish" })).statusCode).toBe(400);
  });

  it("answers 400 for an unknown anchor", async () => {
    const res = await post({ mode: "readNext", user, anchorArticleId: "nope", limit: 5, now: NOW.toISOString() });
    expect(res.statusCode).toBe(400);
  });
});
