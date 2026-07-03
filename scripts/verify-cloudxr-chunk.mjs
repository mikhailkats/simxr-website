#!/usr/bin/env node
// SIM XR — post-build guard: fail the build if the CloudXR SDK chunk is
// missing or suspiciously small in dist/public/assets/.
//
// Why this exists: Netlify CI builds used to silently drop the ~900 KB
// cloudxr chunk (root cause: `import("@nvidia/cloudxr" as string)` — the
// cast hid the dependency from Vite's static analysis; fixed in
// useCloudXRSession.ts 2026-07-03). Result was a deployed simxr.app where
// tapping Connect did nothing useful, with no build-time signal. This
// guard turns that silent failure into a hard build error — Netlify keeps
// the previous (working) deploy published when the build fails.
//
// The chunk name isn't stable (content-hash), so we detect by content: any
// emitted .js asset containing the SDK's createSession marker counts.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = join(process.cwd(), "dist", "public", "assets");
const MIN_BYTES = 400_000; // real SDK chunk is ~900 KB; anything under 400 KB is a strip

let files = [];
try {
  files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"));
} catch (e) {
  console.error(`[verify-cloudxr-chunk] cannot read ${ASSETS_DIR}: ${e.message}`);
  process.exit(1);
}

const hits = [];
for (const f of files) {
  const p = join(ASSETS_DIR, f);
  const src = readFileSync(p, "utf8");
  // SDK-internal validator string unique to the vendored @nvidia/cloudxr
  // 6.1.0 bundle — app code merely CALLING createSession (or logging
  // "CloudXR" strings) can't satisfy this, so a large app chunk can't
  // false-positive the guard (Codex review 2026-07-03).
  if (src.includes("perEyeWidth must be a positive")) {
    hits.push({ file: f, bytes: statSync(p).size });
  }
}

const big = hits.filter((h) => h.bytes >= MIN_BYTES);
if (big.length === 0) {
  console.error(
    `[verify-cloudxr-chunk] FAIL — no CloudXR SDK chunk ≥${MIN_BYTES} bytes in dist/public/assets/. ` +
      `Candidates found: ${JSON.stringify(hits)}. ` +
      `The SDK got tree-shaken out of the build; do NOT deploy this artifact. ` +
      `See web/simxr-tech/client/src/lib/useCloudXRSession.ts loadSdk() comment.`,
  );
  process.exit(1);
}

console.log(
  `[verify-cloudxr-chunk] OK — CloudXR SDK present: ${big
    .map((h) => `${h.file} (${Math.round(h.bytes / 1024)} KB)`)
    .join(", ")}`,
);
