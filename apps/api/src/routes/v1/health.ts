import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { sql } from "drizzle-orm";

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health/live", async (_req, reply) => {
    return reply.send({ status: "ok" });
  });

  fastify.get("/health/ready", async (_req, reply) => {
    try {
      await db.execute(sql`SELECT 1`);
      return reply.send({ status: "ok", db: "connected" });
    } catch {
      return reply.status(503).send({ status: "error", db: "disconnected" });
    }
  });
}
