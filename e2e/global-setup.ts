import { execSync } from "node:child_process";

// Every e2e run starts from the same mockup data. The seed refuses to run when NODE_ENV=production.
// PW_NO_SEED=1 skips it, for running a self-cleaning spec against a dev database you don't want wiped.
export default function globalSetup() {
  if (process.env.PW_NO_SEED === "1") return;
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}
