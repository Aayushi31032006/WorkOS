import { ALL_USERS, COMPANY_ACME, COMPANY_GLOBEX } from "@cs/test-fixtures";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";
import { users, conversations, memberships, messages, messageSeqCounters } from "./schema/index.js";
import { sql } from "drizzle-orm";
import { env } from "../env.js";

const connUrl = process.env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
const pool = postgres(connUrl, { max: 1 });
const db = drizzle(pool, { schema });

async function seed() {
  console.log(`Seeding development database via ${connUrl.replace(/:[^:@]+@/, ":***@")}...`);

  // Seed Users
  for (const u of ALL_USERS) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.company_id', ${u.company_id}, true)`);
      await tx
        .insert(users)
        .values({
          id: u.id,
          company_id: u.company_id,
          name: u.name,
          avatar_url: u.avatar_url,
          department_ids: [],
          project_ids: [],
          is_active: true,
        })
        .onConflictDoNothing();
    });
  }
  console.log(`✓ Seeded ${ALL_USERS.length} users`);

  // Seed Channels for Acme and Globex
  const companies = [COMPANY_ACME, COMPANY_GLOBEX];
  for (const comp of companies) {
    const compUsers = ALL_USERS.filter((u) => u.company_id === comp.id);
    const owner = compUsers.find((u) => u.role === "owner") ?? compUsers[0];

    const channelDefs = [
      { name: "general", kind: "public" as const, topic: "Company-wide announcements and watercooler" },
      { name: "engineering", kind: "public" as const, topic: "Tech discussions, architecture, and deployments" },
      { name: "announcements", kind: "announcement" as const, topic: "Official company updates", is_announcement_only: true },
    ];

    for (const def of channelDefs) {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.company_id', ${comp.id}, true)`);

        // Check if channel already exists
        const [existing] = await tx
          .select()
          .from(conversations)
          .where(sql`company_id = ${comp.id} AND name = ${def.name}`)
          .limit(1);

        let conv = existing;
        if (!conv) {
          const [created] = await tx
            .insert(conversations)
            .values({
              company_id: comp.id,
              type: "channel",
              kind: def.kind,
              name: def.name,
              topic: def.topic,
              is_announcement_only: def.is_announcement_only ?? false,
              member_count: compUsers.length,
              created_by: owner.id,
            })
            .returning();
          conv = created;

          if (conv) {
            await tx.insert(messageSeqCounters).values({
              conversation_id: conv.id,
              last_seq: 0,
            }).onConflictDoNothing();

            // Add initial welcome message with author_id = owner.id
            const [seqRes] = await tx
              .update(messageSeqCounters)
              .set({ last_seq: sql`last_seq + 1` })
              .where(sql`conversation_id = ${conv.id}`)
              .returning({ last_seq: messageSeqCounters.last_seq });

            await tx.insert(messages).values({
              conversation_id: conv.id,
              company_id: comp.id,
              author_id: owner.id,
              client_msg_id: crypto.randomUUID(),
              seq: seqRes?.last_seq ?? 1,
              body: `Welcome to #${def.name} in ${comp.name}! This channel is ready for collaboration.`,
            });
          }
        }

        if (conv) {
          // Add all company users as members
          for (const u of compUsers) {
            await tx
              .insert(memberships)
              .values({
                conversation_id: conv.id,
                user_id: u.id,
                company_id: comp.id,
                role: u.role === "owner" ? "owner" : u.role === "admin" ? "admin" : "member",
              })
              .onConflictDoNothing();
          }

          // Update member_count
          await tx
            .update(conversations)
            .set({
              member_count: sql`(SELECT count(*)::int FROM memberships WHERE memberships.conversation_id = ${conv.id})`,
            })
            .where(sql`id = ${conv.id}`);
        }
      });
    }
  }

  console.log("✓ Seeded default channels, memberships, and welcome messages");
  await pool.end();
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
