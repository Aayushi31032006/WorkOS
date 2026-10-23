/**
 * Mock Identity Provider HTTP server.
 *
 * Endpoints:
 *   GET  /.well-known/jwks.json   � Public keys for JWT verification
 *   GET  /token?user_id=<id>      � Issue a token for a synthetic user (dev only)
 *   GET  /token?tag=<tag>         � Issue a token by user tag
 *   POST /token                   � Same, JSON body { user_id } or { tag }
 *   GET  /users                   � List available synthetic users
 *   POST /rotate-keys             � Rotate signing keys (for testing rotation)
 *   GET  /health                  � Health check
 *
 * This server MUST NEVER be used in production.
 * It has no auth on the /token endpoint intentionally � it is a dev tool.
 */
import http from "http";
import { config } from "./config.js";
import { initKeyStore, keyStore } from "./keypair.js";
import { issueToken } from "./token.js";
import { ALL_USERS, findUserById } from "@cs/test-fixtures";

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    // Remind anyone who stumbles across this that it is dev-only
    "X-Cs-Mock-Idp": "true",
    "X-Cs-Warning": "dev-only-not-for-production",
  });
  res.end(payload);
}

function parseQuery(url: string): URLSearchParams {
  return new URL(url, "http://localhost").searchParams;
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > 4096) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as unknown) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function resolveUser(query: URLSearchParams, body: Record<string, unknown>) {
  const userId = (query.get("user_id") ?? body.user_id) as string | undefined;
  const tag = (query.get("tag") ?? body.tag) as string | undefined;

  if (userId) {
    const user = findUserById(userId);
    if (!user) return { error: `User not found: ${userId}` };
    return { user };
  }

  if (tag) {
    const user = ALL_USERS.find((u) => u.tag === tag);
    if (!user) return { error: `No user with tag: ${tag}` };
    return { user };
  }

  return { error: "Provide user_id or tag query parameter" };
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const urlObj = new URL(req.url ?? "/", `http://localhost:${config.PORT}`);
  const path = urlObj.pathname;
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  // Health
  if (path === "/health" && method === "GET") {
    json(res, 200, {
      status: "ok",
      service: "mock-idp",
      warning: "dev-only",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // JWKS
  if (path === "/.well-known/jwks.json" && method === "GET") {
    json(res, 200, { keys: keyStore.getPublicKeys() });
    return;
  }

  // List users
  if (path === "/users" && method === "GET") {
    json(res, 200, {
      users: ALL_USERS.map((u) => ({
        id: u.id,
        tag: u.tag,
        name: u.name,
        email: u.email,
        company_id: u.company_id,
        role: u.role,
        permissions: u.permissions,
      })),
    });
    return;
  }

  // Issue token
  if (path === "/token" && (method === "GET" || method === "POST")) {
    const query = parseQuery(req.url ?? "/");
    let body: Record<string, unknown> = {};

    if (method === "POST") {
      try {
        const raw = await readBody(req);
        body = raw as Record<string, unknown>;
      } catch (e) {
        json(res, 400, { error: String(e) });
        return;
      }
    }

    const result = resolveUser(query, body);
    if ("error" in result) {
      json(res, 400, { error: result.error });
      return;
    }

    try {
      const issued = await issueToken(result.user);
      console.error(
        `[mock-idp] Issued token for ${result.user.name} (${result.user.tag}) exp=${issued.expires_at}`,
      );
      json(res, 200, issued);
    } catch (e) {
      console.error("[mock-idp] Token issuance failed:", e);
      json(res, 500, { error: "Token issuance failed" });
    }
    return;
  }

  // Rotate keys
  if (path === "/rotate-keys" && method === "POST") {
    const newKey = await keyStore.rotate();
    console.error(`[mock-idp] Keys rotated. New kid: ${newKey.kid}`);
    json(res, 200, {
      message: "Keys rotated",
      kid: newKey.kid,
      total_keys: keyStore.getPublicKeys().length,
    });
    return;
  }

  json(res, 404, { error: "Not found" });
}

export async function startServer(): Promise<void> {
  await initKeyStore();

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      console.error("[mock-idp] Unhandled error:", err);
      if (!res.headersSent) {
        json(res, 500, { error: "Internal server error" });
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(config.PORT, "0.0.0.0", () => {
      console.error(`[mock-idp] ??  DEV ONLY � Mock IdP running on http://0.0.0.0:${config.PORT}`);
      console.error(`[mock-idp] JWKS: http://localhost:${config.PORT}/.well-known/jwks.json`);
      console.error(`[mock-idp] Token: http://localhost:${config.PORT}/token?tag=acme-owner`);
      console.error(`[mock-idp] Users: http://localhost:${config.PORT}/users`);
      resolve();
    });
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.error("[mock-idp] Shutting down...");
    server.close(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    console.error("[mock-idp] Shutting down...");
    server.close(() => process.exit(0));
  });
}
