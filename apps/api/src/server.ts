/**
 * Fastify application factory.
 * Import and call buildApp() for tests; call start() for production.
 */
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import { env } from "./env.js";
import authPlugin from "./auth/plugin.js";
import wsGateway from "./ws/gateway.js";
import healthRoutes from "./routes/v1/health.js";
import channelRoutes from "./routes/v1/channels.js";
import membershipRoutes from "./routes/v1/memberships.js";
import dmRoutes from "./routes/v1/dms.js";
import messageRoutes from "./routes/v1/messages.js";
import reactionRoutes from "./routes/v1/reactions.js";
import readStateRoutes from "./routes/v1/readState.js";
import draftRoutes from "./routes/v1/drafts.js";
import { pubsub } from "./pubsub/index.js";

export async function buildApp(opts?: { testing?: boolean }) {
  const app = Fastify({
    logger: opts?.testing
      ? false
      : {
          level: env.LOG_LEVEL,
          transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
        },
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // -- Security headers -----------------------------------------------------
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // handled by host app
  });

  // -- CORS ------------------------------------------------------------------
  await app.register(fastifyCors, {
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // -- Rate limiting ---------------------------------------------------------
  await app.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (req) => req.identity?.userId ?? req.ip,
    skipOnError: true,
  });

  // -- WebSocket -------------------------------------------------------------
  await app.register(fastifyWebsocket);

  // -- Auth plugin (JWKS verification, injects request.identity) ------------
  await app.register(authPlugin);

  // -- Error handler ---------------------------------------------------------
  app.setErrorHandler((err, request, reply) => {
    const statusCode = err.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error({ err, requestId: request.id }, "Unhandled error");
    }
    return reply.status(statusCode).send({
      error: {
        code: err.code ?? "INTERNAL_ERROR",
        message: statusCode < 500 ? err.message : "Internal server error",
        requestId: request.id,
      },
    });
  });

  // -- Routes ----------------------------------------------------------------
  await app.register(healthRoutes);
  await app.register(channelRoutes);
  await app.register(membershipRoutes);
  await app.register(dmRoutes);
  await app.register(messageRoutes);
  await app.register(reactionRoutes);
  await app.register(readStateRoutes);
  await app.register(draftRoutes);
  await app.register(wsGateway);

  // -- Lifecycle: connect pubsub on start ------------------------------------
  if (!opts?.testing) {
    app.addHook("onReady", async () => {
      await pubsub.connect();
    });
    app.addHook("onClose", async () => {
      await pubsub.close();
    });
  }

  return app;
}

export async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    app.log.info(`API running on ${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
