#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Detect repo root: script is in scripts/, so go up 1 level
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const src = path.join(REPO_ROOT, "flow", "flow.json");
const dst = path.join(REPO_ROOT, "web", "src", "flow.json");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  if (!fs.existsSync(src)) {
    console.error(`Source flow.json not found at ${src}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(src);
  ensureDir(path.dirname(dst));
  fs.writeFileSync(dst, buf);
  console.log(`Synced flow.json to ${dst}`);
}

main();


