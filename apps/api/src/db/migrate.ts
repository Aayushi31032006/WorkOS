/**
 * Migration runner – executes all *.sql migrations via psql.
 * Uses psql for full PL/pgSQL support (DO blocks, dollar-quoting, etc).
 * Run: pnpm --filter @cs/api db:migrate
 */
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }

// Parse connection string
const url = new URL(DATABASE_URL);
const PGHOST = url.hostname;
const PGPORT = url.port || "5432";
const PGDATABASE = url.pathname.slice(1);
const PGUSER = url.username;
const PGPASSWORD = url.password;

async function migrate() {
  const migrationsDir = join(__dirname, "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
    .sort();

  console.log(`Running ${files.length} migration(s) on ${PGDATABASE}...`);

  const env = {
    ...process.env,
    PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD,
  };

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    console.log(`  ? ${file}`);
    execFileSync("psql", ["-f", filePath, "-v", "ON_ERROR_STOP=1"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log(`  ? ${file}`);
  }
  console.log("Migrations complete.");
}

migrate().catch((err: unknown) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
