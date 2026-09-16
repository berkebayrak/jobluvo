import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/**
 * Migrations run against the direct Neon host, not the pooler. Everything else
 * in the app uses the pooled DATABASE_URL.
 *
 * drizzle-kit does not read .env.local on its own, so the file is parsed here
 * without a dependency. Values already in the environment win.
 */
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set for drizzle-kit");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
