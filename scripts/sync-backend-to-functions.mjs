import { cp, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(projectRoot, "backend", "src");
const targetRoot = path.join(projectRoot, "functions", "backend");
const targetDir = path.join(targetRoot, "src");

async function main() {
  await rm(targetRoot, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  console.log("Copied backend/src to functions/backend/src");
}

main().catch((error) => {
  console.error("Failed to copy backend sources:", error);
  process.exitCode = 1;
});
