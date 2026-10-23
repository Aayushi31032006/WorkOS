/**
 * In-process pub/sub via PostgreSQL LISTEN/NOTIFY.
 * Each API instance subscribes to "company_{companyId}" channels.
 * This fan-out approach works for a single instance; add Redis for multi-node.
 */
import postgres from "postgres";
import { env } from "../env.js";

type Listener = (payload: unknown) => void;

class PubSub {
  private sql: ReturnType<typeof postgres> | null = null;
  private listeners = new Map<string, Set<Listener>>();

  async connect(): Promise<void> {
    this.sql = postgres(env.DATABASE_URL, {
      max: 1,
      idle_timeout: 0,
      connect_timeout: 10,
    });

    // Re-establish subscriptions after reconnect
    for (const channel of this.listeners.keys()) {
      await this.sql.listen(channel, (payload) => {
        this.dispatch(channel, payload);
      });
    }
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    // Use a separate quick connection for NOTIFY
    const sql = postgres(env.DATABASE_URL, { max: 1 });
    await sql.notify(channel, JSON.stringify(payload));
    await sql.end();
    // Also dispatch locally for same-process subscribers (no round-trip latency)
    this.dispatch(channel, JSON.stringify(payload));
  }

  async subscribe(channel: string, listener: Listener): Promise<() => void> {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      if (this.sql) {
        await this.sql.listen(channel, (payload) => {
          this.dispatch(channel, payload);
        });
      }
    }
    this.listeners.get(channel)!.add(listener);

    return () => {
      this.listeners.get(channel)?.delete(listener);
    };
  }

  private dispatch(channel: string, raw: string | undefined): void {
    if (!raw) return;
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return; }
    this.listeners.get(channel)?.forEach((fn) => fn(payload));
  }

  async close(): Promise<void> {
    await this.sql?.end();
    this.sql = null;
  }
}

export const pubsub = new PubSub();
