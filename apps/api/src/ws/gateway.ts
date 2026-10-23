/**
 * WebSocket gateway.
 *
 * Protocol:
 *  1. Client connects then immediately sends { type: "auth", token: "<jwt>" }
 *  2. Server replies { type: "auth_ack", userId, companyId } or closes with 4401
 *  3. Client subscribes: { type: "subscribe", conversationId, cursor?: number }
 *     - Server validates membership, then streams ServerEvents for that conversation
 *  4. Client sends { type: "ping" } ? server replies { type: "pong" }
 *  5. On disconnect, all subscriptions are cleaned up
 *
 * Deduplication: WS events carry `seq` + `id`; client tracks last seen seq per conversation.
 */
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { TokenClaimsSchema } from "@cs/contracts";
import { env } from "../env.js";
import { pubsub } from "../pubsub/index.js";
import { conversationsRepo } from "../repositories/conversations.js";
import type { RequestIdentity } from "../auth/plugin.js";

interface AuthMessage {
  type: "auth";
  token: string;
}
interface SubscribeMessage {
  type: "subscribe";
  conversationId: string;
  cursor?: number;
}
interface PingMessage {
  type: "ping";
}
type ClientMessage = AuthMessage | SubscribeMessage | PingMessage;

export default fp(async (fastify: FastifyInstance) => {
  const JWKS = createRemoteJWKSet(new URL(env.JWKS_URI));

  fastify.get("/v1/ws", { websocket: true }, (socket, _req) => {
    let identity: RequestIdentity | null = null;
    const unsubs: (() => void)[] = [];
    const AUTH_TIMEOUT_MS = 10_000;

    // Close if client doesn't auth within 10 seconds
    const authTimer = setTimeout(() => {
      if (!identity) {
        socket.close(4401, "Authentication timeout");
      }
    }, AUTH_TIMEOUT_MS);

    function send(data: unknown): void {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    }

    socket.on("message", (raw: Buffer | string) => {
      void (async () => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(raw.toString()) as ClientMessage;
        } catch {
          send({ type: "error", code: "INVALID_JSON" });
          return;
        }

        // -- auth ----------------------------------------------------------------
        if (msg.type === "auth") {
          if (identity) {
            send({ type: "error", code: "ALREADY_AUTHED" });
            return;
          }
          try {
            const { payload } = await jwtVerify(msg.token, JWKS, {
              issuer: env.JWT_ISSUER,
              audience: env.JWT_AUDIENCE,
              algorithms: ["RS256"],
              maxTokenAge: "15m",
            });
            const claims = TokenClaimsSchema.safeParse(payload);
            if (!claims.success) throw new Error("Invalid claims");
            identity = {
              userId: claims.data.sub,
              companyId: claims.data.company_id,
              permissions: claims.data.permissions,
              name: claims.data.name,
              avatarUrl: claims.data.avatar_url ?? null,
            };
            clearTimeout(authTimer);
            send({ type: "auth_ack", userId: identity.userId, companyId: identity.companyId });
          } catch {
            socket.close(4401, "Authentication failed");
          }
          return;
        }

        if (!identity) {
          send({ type: "error", code: "NOT_AUTHENTICATED" });
          return;
        }

        // -- subscribe ------------------------------------------------------------
        if (msg.type === "subscribe") {
          // Verify membership before subscribing
          const isMember = await conversationsRepo.isMember(identity, msg.conversationId);
          if (!isMember) {
            send({ type: "error", code: "NOT_A_MEMBER", conversationId: msg.conversationId });
            return;
          }

          const channel = `company_${identity.companyId}_conv_${msg.conversationId}`;
          const unsub = await pubsub.subscribe(channel, (event) => {
            send(event);
          });
          unsubs.push(unsub);
          send({ type: "subscribed", conversationId: msg.conversationId, cursor: msg.cursor ?? 0 });
          return;
        }

        // -- ping -----------------------------------------------------------------
        if (msg.type === "ping") {
          send({ type: "pong", ts: Date.now() });
          return;
        }
      })();
    });

    socket.on("close", () => {
      clearTimeout(authTimer);
      for (const unsub of unsubs) unsub();
    });

    socket.on("error", () => {
      clearTimeout(authTimer);
      for (const unsub of unsubs) unsub();
    });
  });
});
