import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PERMISSIONS, encodeCursor, decodeCursor } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { auditRepo } from "../../repositories/audit.js";

const CreateChannelBody = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/),
  kind: z.enum(["company","department","project","public","private","announcement"]),
  topic: z.string().max(250).optional(),
  is_announcement_only: z.boolean().optional(),
});

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export default async function channelRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/channels", async (request, reply) => {
    const q = ListQuery.safeParse(request.query);
    if (!q.success) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });

    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const cursorData = q.data.cursor ? decodeCursor(q.data.cursor) : undefined;
    const rows = await conversationsRepo.listForUser(identity, {
      cursor: cursorData?.id as string | undefined,
      limit: q.data.limit,
    });

    const hasNext = rows.length > q.data.limit;
    const items = hasNext ? rows.slice(0, -1) : rows;
    const last = items.at(-1);

    return reply.send({
      data: items,
      pageInfo: {
        hasNextPage: hasNext,
        endCursor: last ? encodeCursor({ id: last.id }) : null,
      },
    });
  });

  fastify.post("/v1/channels", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const body = CreateChannelBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    if (body.data.kind === "private") {
      policy.require(identity, PERMISSIONS.PRIVATE_CHANNEL_CREATE);
    } else {
      policy.require(identity, PERMISSIONS.CHANNEL_CREATE);
    }

    const conv = await conversationsRepo.createChannel(identity, body.data);

    await auditRepo.write(identity, {
      action: "channel.created",
      resourceType: "conversation",
      resourceId: conv.id,
      metadata: { name: body.data.name, kind: body.data.kind },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.status(201).send({ data: conv });
  });

  fastify.get("/v1/channels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const conv = await conversationsRepo.getById(identity, id);
    if (!conv) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Channel not found" } });
    return reply.send({ data: conv });
  });
}
