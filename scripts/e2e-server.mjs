// Builds and serves the app for Playwright with .env.e2e applied (overrides .env).
import { spawnSync, spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const env = { ...process.env };
for (const line of readFileSync(".env.e2e", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}
const next = "node_modules/next/dist/bin/next";
// The DB is reset before every run, so persisted data/ISR caches from earlier runs must go too.
rmSync(".next-e2e", { recursive: true, force: true });
const build = spawnSync(process.execPath, [next, "build"], { stdio: "inherit", env });
if (build.status !== 0) process.exit(build.status ?? 1);
const server = spawn(process.execPath, [next, "start", "-p", process.argv[2] ?? "3200"], { stdio: "inherit", env });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
server.on("exit", (code) => process.exit(code ?? 0));
