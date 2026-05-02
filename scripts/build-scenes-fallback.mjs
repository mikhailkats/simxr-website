// Build-time generator for /connect/scenes.json — the static fallback the
// React Connect page uses when api.simxr.app is unreachable (server stopped,
// Cloudflare Tunnel down, etc.). Source of truth is scenes.yaml; this script
// transforms YAML → JSON 1:1 with the same schema the live API serves
// (`{ scenes: Scene[], ts: string }`), so the React fetcher can swap sources
// without conditional logic.
//
// Runs as `pnpm run build:scenes-fallback`, wired into the main `build` step
// so Netlify produces a fresh fallback on every deploy. The emitted JSON is
// gitignored — it's a build artifact, never hand-edited.
//
// Server-side (`/var/www/html/api/scenes.json`) is generated independently
// from the same scenes.yaml by simxr-update-scenes-json.py on the Brev box,
// so both consumers read the same source.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "client/public/connect/scenes.yaml");
const OUT = join(ROOT, "client/public/connect/scenes.json");

const ALLOWED_KEYS = new Set(["id", "name", "description", "status", "note"]);
const VALID_STATUS = new Set(["available", "broken", "live"]);

const raw = readFileSync(SRC, "utf8");
const parsed = yaml.load(raw);

if (!Array.isArray(parsed)) {
  console.error(`scenes.yaml top-level must be a list; got ${typeof parsed}`);
  process.exit(1);
}

const scenes = [];
for (let i = 0; i < parsed.length; i++) {
  const scene = parsed[i];
  if (!scene || typeof scene !== "object") {
    console.warn(`scenes[${i}] is not a mapping; skipping`);
    continue;
  }
  if (!scene.id || !scene.status) {
    console.warn(`scenes[${i}] missing required 'id' or 'status'; skipping`);
    continue;
  }
  if (!VALID_STATUS.has(scene.status)) {
    console.warn(
      `scenes[${i}] status="${scene.status}" not in {${[...VALID_STATUS].join(", ")}}; passing through`,
    );
  }
  const cleaned = {};
  for (const [k, v] of Object.entries(scene)) {
    if (ALLOWED_KEYS.has(k)) cleaned[k] = v;
  }
  scenes.push(cleaned);
}

const payload = {
  scenes,
  ts: new Date().toISOString(),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`scenes-fallback: wrote ${OUT} (${scenes.length} scenes)`);
