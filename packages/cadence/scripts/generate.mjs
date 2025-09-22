#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Detect repo root: script is in packages/cadence/scripts/, so go up 3 levels
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const FLOW_DIR = path.join(REPO_ROOT, "flow", "cadence");
const OUT_DIR = path.join(REPO_ROOT, "packages", "cadence");
const API_DIR = path.join(REPO_ROOT, "services", "api");

function walk(dir, filterExt = ".cdc") {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        stack.push(p);
      } else if (e.isFile() && p.endsWith(filterExt)) {
        out.push(p);
      }
    }
  }
  return out;
}

function relFromCadence(p) {
  return path.relative(path.join(FLOW_DIR), p).replace(/\\/g, "/");
}

function safeConstName(relPath) {
  const base = relPath
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1");
  return base;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, { encoding: "utf8" });
}

function generate() {
  const txDir = path.join(FLOW_DIR, "transactions");
  const scriptsDir = path.join(FLOW_DIR, "scripts");
  const files = [...walk(txDir), ...walk(scriptsDir)];

  const records = files.map((abs) => {
    const rel = relFromCadence(abs);
    const src = fs.readFileSync(abs, "utf8");
    return { rel, src };
  });

  // Build ESM module
  const esmLines = [];
  esmLines.push("// Auto-generated. Do not edit by hand.\n");
  esmLines.push("export const files = {};\n");
  for (const r of records) {
    esmLines.push(
      `files[${JSON.stringify(r.rel)}] = ${JSON.stringify(r.src)};\n`
    );
  }
  esmLines.push("export const list = Object.keys(files);\n");
  esmLines.push(
    "export function get(pathRel) { return files[pathRel] ?? null }\n"
  );
  // Also export stable constants for common filenames
  for (const r of records) {
    const name = safeConstName(r.rel);
    esmLines.push(`export const ${name} = files[${JSON.stringify(r.rel)}];\n`);
  }

  // Build CJS module
  const cjsLines = [];
  cjsLines.push("// Auto-generated. Do not edit by hand.\n");
  cjsLines.push("const files = {};\n");
  for (const r of records) {
    cjsLines.push(
      `files[${JSON.stringify(r.rel)}] = ${JSON.stringify(r.src)};\n`
    );
  }
  cjsLines.push("const list = Object.keys(files);\n");
  cjsLines.push(
    "function get(pathRel){ return Object.prototype.hasOwnProperty.call(files, pathRel) ? files[pathRel] : null }\n"
  );
  cjsLines.push("module.exports.files = files;\n");
  cjsLines.push("module.exports.list = list;\n");
  cjsLines.push("module.exports.get = get;\n");
  for (const r of records) {
    const name = safeConstName(r.rel);
    cjsLines.push(`module.exports.${name} = files[${JSON.stringify(r.rel)}];\n`);
  }

  // d.ts
  const dtsLines = [];
  dtsLines.push("// Auto-generated. Do not edit by hand.\n");
  dtsLines.push("export const files: Record<string, string>;\n");
  dtsLines.push("export const list: string[];\n");
  dtsLines.push("export function get(pathRel: string): string | null;\n");
  for (const r of records) {
    const name = safeConstName(r.rel);
    dtsLines.push(`export const ${name}: string;\n`);
  }

  writeFile(path.join(OUT_DIR, "index.mjs"), esmLines.join(""));
  writeFile(path.join(OUT_DIR, "index.cjs"), cjsLines.join(""));
  writeFile(path.join(OUT_DIR, "index.d.ts"), dtsLines.join(""));
  console.log(
    `Generated ${records.length} Cadence files into @flow-hackathon/cadence`
  );

  // --- Generate transaction cadence hashes for API allowlist ---
  const normalizeCadence = (src) => {
    // Remove line and block comments, trim
    const noLine = src.replace(/\/\/.*$/gm, "");
    const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//gm, "");
    return noBlock.trim();
  };

  const txFiles = walk(txDir);
  const txHashes = txFiles.map((abs) => {
    const rel = relFromCadence(abs);
    const raw = fs.readFileSync(abs, "utf8");
    const norm = normalizeCadence(raw);
    const hash = crypto.createHash("sha256").update(Buffer.from(norm, "utf8")).digest("hex");
    return { path: rel, hash };
  });

  // Build allowlist array (unique, stable order by path)
  txHashes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const allowlist = Array.from(new Set(txHashes.map((t) => t.hash)));

  const byPath = {};
  for (const rec of txHashes) byPath[rec.path] = rec.hash;

  const outJson = {
    generatedAt: new Date().toISOString(),
    algorithm: "SHA-256",
    normalize: "strip-comments-trim",
    transactions: txHashes,
    allowlist,
    byPath,
  };

  writeFile(path.join(API_DIR, "cadence-hashes.json"), `${JSON.stringify(outJson, null, 2)}\n`);
  console.log(`Wrote ${txHashes.length} transaction hashes to services/api/cadence-hashes.json`);
}

generate();


