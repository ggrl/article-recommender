import { readFileSync } from "node:fs";
import { createMemoryRepository } from "../data/memoryRepository.ts";
import { generateSeed } from "../data/seed.ts";
import { createRecommender } from "../engine/recommend.ts";
import { buildServer } from "./server.ts";

const config: unknown = JSON.parse(readFileSync(new URL("../../config/default.json", import.meta.url), "utf8"));
const recommender = createRecommender({ repository: createMemoryRepository(generateSeed(42, new Date())), config });
const port = Number(process.env.PORT ?? 3000);

await buildServer(recommender).listen({ port, host: "127.0.0.1" });
console.log(`Listening on http://127.0.0.1:${port}`);
