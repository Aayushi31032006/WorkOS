import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PERMISSIONS, encodeCursor, decodeCursor } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { messagesRepo } from "../../repositories/messages.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { pubsub } from "../../pubsub/index.js";

const SendBody = z.object({
  client_msg_id: z.string().uuid(),
  body: z.string().min(1).max(8000),
  parent_id: z.string().uuid().optional(),
  attachment_ids: z.array(z.string().uuid()).max(10).optional(),
  mention_ids: z.array(z.string().uuid()).max(50).optional(),
});

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  direction: z.enum(["before","after"]).default("before"),
});

export default async function messageRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/conversations/:id/messages", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const q = ListQuery.safeParse(request.query);
    if (!q.success) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });
    }

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const cursorData = q.data.cursor ? decodeCursor(q.data.cursor) : undefined;
    const seq = typeof cursorData?.seq === "number" ? cursorData.seq : undefined;

    const rows = await messagesRepo.list(identity, {
      conversationId,
      cursor: seq,
      limit: q.data.limit,
      direction: q.data.direction,
    });

    const hasMore = rows.length > q.data.limit;
    const items = hasMore ? rows.slice(0, -1) : rows;
    const last = items.at(-1);

    return reply.send({
      data: items,
      pageInfo: {
        hasNextPage: hasMore,
        endCursor: last ? encodeCursor({ seq: last.seq }) : null,
      },
    });
  });

  fastify.post("/v1/conversations/:id/messages", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.MESSAGE_SEND);

    const body = SendBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const { message, created } = await messagesRepo.send(identity, {
      conversationId,
      clientMsgId: body.data.client_msg_id,
      body: body.data.body,
      parentId: body.data.parent_id,
      attachmentIds: body.data.attachment_ids,
      mentionIds: body.data.mention_ids,
    });

    if (created) {
      await pubsub.publish(`company_${identity.companyId}_conv_${conversationId}`, {
        type: "message.created",
        v: 1,
        message,
        ts: new Date().toISOString(),
      });
    }

    return reply.status(created ? 201 : 200).send({ data: message, created });
  });
}
