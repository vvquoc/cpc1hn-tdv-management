import { cp, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const templates = path.join(root, "data-templates");
const checkOnly = process.argv.includes("--check");

async function main() {
  if (!existsSync(src)) {
    throw new Error("Missing src directory.");
  }

  const sourceStat = await stat(src);
  if (!sourceStat.isDirectory()) {
    throw new Error("src must be a directory.");
  }

  if (!checkOnly) {
    await rm(dist, { recursive: true, force: true });
    await mkdir(dist, { recursive: true });
    await cp(src, dist, { recursive: true });
    if (existsSync(templates)) {
      await cp(templates, path.join(dist, "templates"), { recursive: true });
    }
  }

  console.log(checkOnly ? "Build inputs are valid." : "Built static app into dist/.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
