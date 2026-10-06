import { readFileSync } from "node:fs";
import { createMemoryRepository } from "../data/memoryRepository.ts";
import { generateSeed } from "../data/seed.ts";
import { createRecommender } from "../engine/recommend.ts";
import { registerDemo, topicsOf } from "./demo.ts";
import { buildServer } from "./server.ts";

const config: unknown = JSON.parse(readFileSync(new URL("../../config/default.json", import.meta.url), "utf8"));
const seed = generateSeed(42, new Date());
const repository = createMemoryRepository(seed);
const app = buildServer(createRecommender({ repository, config }));
registerDemo(app, { repository, rawConfig: config, users: seed.users, topics: topicsOf(seed.articles), now: () => new Date() });
const port = Number(process.env.PORT ?? 3000);

await app.listen({ port, host: "127.0.0.1" });
console.log(`Listening on http://127.0.0.1:${port}`);
