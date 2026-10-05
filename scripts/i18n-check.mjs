#!/usr/bin/env node
// Verifies every en/am dictionary pair has identical keys, non-empty values,
// and identical {placeholder} tokens — the exit gate for i18n work.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NS = ["common", "worker", "customer", "admin", "public"];

function load(side, ns) {
  const p = join(root, "i18n", side, `${ns}.json`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`FAIL cannot read ${p}: ${e.message}`);
    process.exit(1);
  }
}

const placeholders = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(",");

let errors = 0;
let totalKeys = 0;

for (const ns of NS) {
  const en = load("en", ns);
  const am = load("am", ns);
  const enKeys = Object.keys(en);
  const amKeys = Object.keys(am);
  totalKeys += enKeys.length;

  for (const k of enKeys) if (!(k in am)) { console.error(`FAIL [${ns}] missing in am: ${k}`); errors++; }
  for (const k of amKeys) if (!(k in en)) { console.error(`FAIL [${ns}] missing in en: ${k}`); errors++; }

  for (const k of enKeys) {
    if (!String(en[k]).trim()) { console.error(`FAIL [${ns}] empty en value: ${k}`); errors++; }
    if (k in am && !String(am[k]).trim()) { console.error(`FAIL [${ns}] empty am value: ${k}`); errors++; }
    if (k in am && placeholders(en[k]) !== placeholders(am[k])) {
      console.error(`FAIL [${ns}] placeholder mismatch on ${k}: en=${placeholders(en[k])} am=${placeholders(am[k])}`);
      errors++;
    }
  }
}

// keys referenced in source must exist in en (catches drift from dict edits)
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(tsx|ts)$/.test(entry.name)) yield full;
  }
}

const used = new Set();
for (const dir of ["app", "components", "context"]) {
  try {
    for (const file of walk(join(root, dir))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
    }
  } catch {
    /* directory may not exist */
  }
}

if (used.size) {
  const flat = new Map();
  for (const ns of NS) {
    const en = load("en", ns);
    const am = load("am", ns);
    for (const k of Object.keys(en)) flat.set(k, { ns, en: en[k], am: am[k] });
  }
  const keys = [...used];
  for (const k of keys) {
    if (!flat.has(k)) { console.error(`FAIL key used in code but not in any dict: ${k}`); errors++; }
  }
  console.log(`checked ${keys.length} keys referenced in code`);
}

if (errors) {
  console.error(`\nI18N CHECK FAILED — ${errors} problem(s), ${totalKeys} dictionary keys`);
  process.exit(1);
}
console.log(`I18N CHECK OK — ${NS.length} namespaces, ${totalKeys} keys, en/am parity`);
