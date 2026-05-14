#!/usr/bin/env node
/**
 * Runs pending SQL migrations against $DATABASE_URL.
 * Used by `pnpm run render:migrate` during Render's build.
 * Uses the `pg` package (already a dependency via lib/db) so no system psql is needed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, "../lib/db/migrations");

if (!process.env.DATABASE_URL) {
  console.log("⏭  No DATABASE_URL set — skipping migrations");
  process.exit(0);
}

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`🗄  Applying ${files.length} migration(s)…`);
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});
try {
  await client.connect();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf-8");
    console.log(`   → ${f}`);
    await client.query(sql);
  }
  console.log("✅ Migrations applied");
} catch (err) {
  console.error("❌ Migration error:", err.message);
  console.error("   The deploy will continue, but the app may misbehave until migrations run.");
  // Exit 0 so we don't block the deploy — operator can fix and re-run.
  process.exit(0);
} finally {
  await client.end();
}
