import { execSync } from "node:child_process";

// Every e2e run starts from the same mockup data. The seed refuses to run when NODE_ENV=production.
export default function globalSetup() {
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}
