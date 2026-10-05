import { fastify, type FastifyInstance } from "fastify";
import { RequestError, type Recommender } from "../engine/recommend.ts";

export function buildServer(recommender: Recommender): FastifyInstance {
  const app = fastify();

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/recommend", async (request, reply) => {
    const body: object = typeof request.body === "object" && request.body !== null ? request.body : {};
    const rawNow = "now" in body ? body.now : undefined;
    // The engine never reads the clock; the demo layer supplies it when the caller does not.
    const now = rawNow === undefined ? new Date() : typeof rawNow === "string" ? new Date(rawNow) : rawNow;
    try {
      return await recommender.recommend({ ...body, now });
    } catch (error) {
      if (error instanceof RequestError) return reply.code(400).send({ error: error.message });
      throw error;
    }
  });

  return app;
}
