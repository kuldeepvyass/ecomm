import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";

function loadEnv() {
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.e2e", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

/** Resets ONLY the dedicated e2e database, applies migrations and seeds demo data. */
async function main() {
  const env = loadEnv();
  if (!env.DATABASE_URL.endsWith("/maison_e2e")) throw new Error("Refusing to reset a non-e2e database");
  const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
  run("npx prisma migrate deploy");
  const pg = new Client({ connectionString: env.DATABASE_URL });
  await pg.connect();
  const { rows } = await pg.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`);
  if (rows.length) await pg.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(",")} RESTART IDENTITY CASCADE`);
  await pg.end();
  run("npx tsx prisma/seed.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
