/**
 * MessagesRepository
 *
 * Key invariants:
 *  - Idempotent send: unique(author_id, conversation_id, client_msg_id).
 *    On conflict, returns the existing row (HTTP 200) vs new row (HTTP 201).
 *  - Monotonic seq: obtained via UPDATE ... RETURNING on message_seq_counters,
 *    which is serialized within the transaction by the row-level lock.
 *  - All queries are scoped to company_id via RLS + explicit WHERE.
 */
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
  created: boolean; // false = idempotent replay
}

export const messagesRepo = {
  /**
   * Idempotent message send.
   * Returns { message, created: true } on first send.
   * Returns { message, created: false } on replay (same clientMsgId).
   */
  async send(
    identity: RequestIdentity,
    input: SendMessageInput,
  ): Promise<SendMessageResult> {
    return withTenantTx(identity, async (tx: Db) => {
      // Check for idempotent replay first (avoids lock contention)
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

      // Atomically increment seq counter (row-level lock prevents gaps)
      const [counter] = await tx
        .update(messageSeqCounters)
        .set({ last_seq: sql`last_seq + 1` })
        .where(eq(messageSeqCounters.conversation_id, input.conversationId))
        .returning({ last_seq: messageSeqCounters.last_seq });

      if (!counter) {
        throw new Error(`No seq counter for conversation ${input.conversationId}`);
      }

      // Insert message
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

      // Update conversation.last_message_at
      await tx
        .update(conversations)
        .set({ last_message_at: msg.created_at, updated_at: msg.created_at })
        .where(eq(conversations.id, input.conversationId));

      return { message: msg, created: true };
    });
  },

  /**
   * Keyset-paginated message list.
   * direction=before: messages older than cursor (default, for initial load)
   * direction=after: messages newer than cursor (for live updates / resume)
   */
  async list(
    identity: RequestIdentity,
    opts: {
      conversationId: string;
      cursor?: number; // seq value
      limit: number;
      direction: "before" | "after";
    },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const conditions = [
        eq(messages.conversation_id, opts.conversationId),
        eq(messages.company_id, identity.companyId),
        isNull(messages.deleted_at),
      ];
      if (opts.cursor !== undefined) {
        if (opts.direction === "before") {
          conditions.push(lt(messages.seq, opts.cursor));
        } else {
          conditions.push(gt(messages.seq, opts.cursor));
        }
      }
      const order =
        opts.direction === "before"
          ? desc(messages.seq)
          : asc(messages.seq);

      const rows = await tx
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(order)
        .limit(opts.limit + 1);

      // Normalize to chronological order
      return opts.direction === "before" ? rows.reverse() : rows;
    });
  },

  /** Get single message by id, company-scoped */
  async getById(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const rows = await tx
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.id, id),
            eq(messages.company_id, identity.companyId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    });
  },

  /** Soft-delete a message */
  async softDelete(
    identity: RequestIdentity,
    messageId: string,
    deletedBy: string,
  ) {
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

