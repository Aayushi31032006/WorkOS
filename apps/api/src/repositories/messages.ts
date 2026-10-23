import { eq, and, lt, gt, desc, asc, isNull, sql } from "drizzle-orm";
import { messages, messageSeqCounters, conversations } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export interface SendMessageInput {
  conversationId: string;
  clientMsgId: string;
  body: string;
  parentId?: string;
  attachmentIds?: string[];
  mentionIds?: string[];
}

export interface SendMessageResult {
  message: typeof messages.$inferSelect;
  created: boolean;
}

export const messagesRepo = {
  async send(identity: RequestIdentity, input: SendMessageInput): Promise<SendMessageResult> {
    return withTenantTx(identity, async (tx: Db) => {
      const existing = await tx
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.author_id, identity.userId),
            eq(messages.conversation_id, input.conversationId),
            eq(messages.client_msg_id, input.clientMsgId),
            eq(messages.company_id, identity.companyId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return { message: existing[0], created: false };
      }

      const [counter] = await tx
        .update(messageSeqCounters)
        .set({ last_seq: sql`last_seq + 1` })
        .where(eq(messageSeqCounters.conversation_id, input.conversationId))
        .returning({ last_seq: messageSeqCounters.last_seq });

      if (!counter) {
        throw new Error(`No seq counter for conversation ${input.conversationId}`);
      }

      const [msg] = await tx
        .insert(messages)
        .values({
          conversation_id: input.conversationId,
          company_id: identity.companyId,
          author_id: identity.userId,
          client_msg_id: input.clientMsgId,
          seq: counter.last_seq,
          body: input.body,
          parent_id: input.parentId ?? null,
          attachment_ids: input.attachmentIds ?? [],
          mention_ids: input.mentionIds ?? [],
        })
        .returning();

      if (!msg) throw new Error("Failed to insert message");

      await tx
        .update(conversations)
        .set({ last_message_at: msg.created_at, updated_at: msg.created_at })
        .where(eq(conversations.id, input.conversationId));

      return { message: msg, created: true };
    });
  },

  async list(
    identity: RequestIdentity,
    opts: {
      conversationId: string;
      cursor?: number;
      limit: number;
      direction: "before" | "after";
    },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const conditions = [
        eq(messages.conversation_id, opts.conversationId),
        eq(messages.company_id, identity.companyId),
        isNull(messages.deleted_at),
        isNull(messages.parent_id), // top-level messages only in main list
      ];
      if (opts.cursor !== undefined) {
        if (opts.direction === "before") {
          conditions.push(lt(messages.seq, opts.cursor));
        } else {
          conditions.push(gt(messages.seq, opts.cursor));
        }
      }
      const order = opts.direction === "before" ? desc(messages.seq) : asc(messages.seq);

      const rows = await tx
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(order)
        .limit(opts.limit + 1);

      return opts.direction === "before" ? rows.reverse() : rows;
    });
  },

  async listThreadReplies(
    identity: RequestIdentity,
    opts: {
      conversationId: string;
      parentId: string;
      cursor?: number;
      limit: number;
    },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const conditions = [
        eq(messages.conversation_id, opts.conversationId),
        eq(messages.parent_id, opts.parentId),
        eq(messages.company_id, identity.companyId),
        isNull(messages.deleted_at),
      ];
      if (opts.cursor !== undefined) {
        conditions.push(gt(messages.seq, opts.cursor));
      }

      return tx
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(asc(messages.seq))
        .limit(opts.limit + 1);
    });
  },

  async edit(
    identity: RequestIdentity,
    opts: {
      messageId: string;
      conversationId: string;
      body: string;
    },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const [updated] = await tx
        .update(messages)
        .set({
          body: opts.body,
          edited_at: new Date(),
        })
        .where(
          and(
            eq(messages.id, opts.messageId),
            eq(messages.conversation_id, opts.conversationId),
            eq(messages.company_id, identity.companyId),
            eq(messages.author_id, identity.userId),
            isNull(messages.deleted_at),
          ),
        )
        .returning();
      return updated ?? null;
    });
  },

  async getById(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const rows = await tx
        .select()
        .from(messages)
        .where(and(eq(messages.id, id), eq(messages.company_id, identity.companyId)))
        .limit(1);
      return rows[0] ?? null;
    });
  },

  async softDelete(identity: RequestIdentity, messageId: string, deletedBy: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const now = new Date();
      const [updated] = await tx
        .update(messages)
        .set({ deleted_at: now, deleted_by: deletedBy })
        .where(
          and(
            eq(messages.id, messageId),
            eq(messages.company_id, identity.companyId),
            isNull(messages.deleted_at),
          ),
        )
        .returning();
      return updated ?? null;
    });
  },
};
