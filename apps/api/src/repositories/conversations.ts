import { eq, and, asc, gt, sql } from "drizzle-orm";
import { conversations, memberships } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export interface CreateChannelInput {
  name: string;
  kind: "company" | "department" | "project" | "public" | "private" | "announcement";
  topic?: string;
  is_announcement_only?: boolean;
  department_id?: string;
  project_id?: string;
}

export const conversationsRepo = {
  async listForUser(identity: RequestIdentity, opts: { cursor?: string; limit: number }) {
    return withTenantTx(identity, async (tx: Db) => {
      const conditions = [
        eq(memberships.user_id, identity.userId),
        eq(memberships.company_id, identity.companyId),
      ];
      if (opts.cursor) conditions.push(gt(conversations.id, opts.cursor));
      return tx
        .select({
          id: conversations.id, company_id: conversations.company_id,
          type: conversations.type, kind: conversations.kind,
          name: conversations.name, topic: conversations.topic,
          is_archived: conversations.is_archived,
          is_announcement_only: conversations.is_announcement_only,
          member_count: conversations.member_count,
          last_message_at: conversations.last_message_at,
          created_at: conversations.created_at,
        })
        .from(conversations)
        .innerJoin(memberships, and(
          eq(memberships.conversation_id, conversations.id),
          eq(memberships.user_id, identity.userId),
        ))
        .where(and(...conditions))
        .orderBy(asc(conversations.id))
        .limit(opts.limit + 1);
    });
  },

  async getById(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const rows = await tx.select().from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.company_id, identity.companyId)))
        .limit(1);
      return rows[0] ?? null;
    });
  },

  async isMember(identity: RequestIdentity, conversationId: string): Promise<boolean> {
    return withTenantTx(identity, async (tx: Db) => {
      const rows = await tx.select({ id: memberships.id }).from(memberships)
        .where(and(
          eq(memberships.conversation_id, conversationId),
          eq(memberships.user_id, identity.userId),
          eq(memberships.company_id, identity.companyId),
        )).limit(1);
      return rows.length > 0;
    });
  },

  async createChannel(identity: RequestIdentity, input: CreateChannelInput) {
    return withTenantTx(identity, async (tx: Db) => {
      const [conv] = await tx.insert(conversations).values({
        company_id: identity.companyId,
        type: "channel",
        kind: input.kind,
        name: input.name,
        topic: input.topic ?? null,
        is_announcement_only: input.is_announcement_only ?? false,
        department_id: input.department_id ?? null,
        project_id: input.project_id ?? null,
        member_count: 1,
        created_by: identity.userId,
      }).returning();
      if (!conv) throw new Error("Failed to create conversation");

      await tx.insert(memberships).values({
        conversation_id: conv.id,
        user_id: identity.userId,
        company_id: identity.companyId,
        role: "owner",
      });

      await tx.execute(
        sql`INSERT INTO message_seq_counters (conversation_id, last_seq) VALUES (${conv.id}, 0)`,
      );

      return conv;
    });
  },
};
