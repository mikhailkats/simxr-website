# V1.5 Connect Page — Setup Notes

The connect page lives at **`simxr.app`** apex (React renders Connect directly at `/` based on hostname). Same React route is also reachable at `simxr.tech/connect` and `simxr.app/connect` for direct linking. v1 (multi-scene picker that proxied to NVIDIA's IsaacTeleop client) is preserved as a fallback at `/connect-classic` on either domain.

Domain layout:
- **`simxr.app`** — Cloudflare Registrar, CF DNS. Apex serves the React Connect page (Netlify build, hostname-based routing in App.tsx), `api.simxr.app` is the CF Tunnel for backend (apache + WSS). This is the demo URL operators receive.
- **`simxr.tech`** — zone.eu, unchanged. Marketing site at apex; `/connect` continues to work as the same React route.

## What's already in this repo

- `vendor/nvidia-cloudxr-6.1.0.tgz` — the NGC tarball, committed to the repo (~387 KB).
- `package.json` — `@nvidia/cloudxr-js` declared as `file:./vendor/nvidia-cloudxr-6.1.0.tgz`.
- `client/src/pages/Connect.tsx` — the v1.5 React route.
- `client/src/lib/useCloudXRSession.ts` — React hook wrapping the SDK lifecycle.
- `client/src/lib/scenes.ts` — fetchers for `/api/scenes.json`, `/api/healthz`, `/api/ip.json`.
- `client/src/components/SceneCard.tsx` — visual card matching the v1 dark theme.
- `client/src/App.tsx` — `/connect` and `/connect/` registered as a lazy-loaded route.
- `netlify.toml` — `/connect-classic/*` redirect + noindex headers; `/client/*` proxy preserved (only used by the v1 fallback).

## What's needed to ship

### 1. Install the new dep

```bash
cd web/simxr-tech
pnpm install
# Verify the SDK is importable:
node -e "console.log(Object.keys(require('@nvidia/cloudxr-js')))"
```

If `pnpm install` fails on the file-protocol dep, double-check that `vendor/nvidia-cloudxr-6.1.0.tgz` exists at that exact path — the SDK ships as an NGC tarball, not a public npm package.

### 2. Move the v1 static page to `/connect-classic`

```bash
mv client/public/connect client/public/connect-classic
```

This makes `/connect` (no static file at that path) fall through to the SPA, which routes to `pages/Connect.tsx`. The v1 page stays accessible at `/connect-classic` as a fallback during the v1.5 stabilization window.

### 3. Update `update_connect_page.sh`

The v1 deploy script writes to `client/public/connect/index.html`. Update its `OUT_DIR` to `client/public/connect-classic/index.html` so the v1 fallback continues to refresh on each `brev start`. Also add a step to emit `/api/scenes.json` (apache-served on the server, not in this repo) — see server-side spec at `Sim XR/03_ops_setup/v15_server_endpoints_2026-05-02/`.

### 4. Server-side endpoints (CC's task)

The React app fetches three endpoints from `https://teleop.simxr.tech/api/*`, served by apache on the Brev server:

- `/api/ip.json` — `{ "ip": "16.171.14.153" }`. Refreshed on each `brev start`.
- `/api/healthz` — current live scene + session state + active client count. Refreshed every 5s by a systemd timer.
- `/api/scenes.json` — `scenes.yaml` converted to JSON.

These are wired through path-based ingress on the existing Cloudflare Tunnel (same `teleop.simxr.tech` hostname). See server-side spec for details.

### 5. Cloudflare Tunnel config (in Mike's CF account)

Create a tunnel in the Mike-owned CF account, generate a token, hand to CC for installation. Then add a public hostname:

- Subdomain: `api`, Domain: `simxr.app`
- Two ingress rules in this exact order (path-matching is order-sensitive):
  1. **`api.simxr.app/api/*` → `http://localhost:80`** (apache serves static JSON files)
  2. **`api.simxr.app` (catch-all) → `https://localhost:48322`** with TLS Verify off (WSS proxy for CloudXR signaling)

Plus a Cache Rule:
- Match: `api.simxr.app/api/healthz`
- Action: Bypass cache (otherwise edge caches the live-state JSON)

Verify after deploy:

```bash
curl -I https://api.simxr.app/api/ip.json
# Expected: 200 OK, Content-Type: application/json, no upgrade-required headers
```

### 6. Phase 6 Quest test

End-to-end smoke test from a Quest 3 (OS 79+) on home WiFi:

1. Open the headset's browser, navigate to `https://simxr.app` (apex auto-redirects to `/connect`)
2. Page loads with the live scene's Connect button
3. Tap Connect → WebXR session opens → CloudXR streaming starts → in-VR
4. Verify hand tracking responsive, no error banner, no cert dialog

Repeat from a phone tether to validate UDP traversal outside home network.

### 7. Cutover decision

After ~1 week of v1.5 operating cleanly:

- Drop `/client/*` Netlify redirect (no longer needed; only the v1 fallback used it)
- Retire `client/public/connect-classic/` directory
- Update operator guide `docs/operator_guide_quest3_2026-05-02.md` to reflect the v1.5 single-tap flow

## Known limits

- **Latency**: Cloudflare Tunnel adds 50–200 ms to the WSS signaling path. If Phase 6 testing reveals motion-to-photon latency above ~200 ms, swap the tunnel for direct AWS exposure (port 443 on the bare IP, Let's Encrypt cert via certbot). ~30-min change, doesn't affect any of the above code.
- **Single-tenant**: the CloudXR Runtime supports one VR session at a time per server. v1.5 doesn't add a queue. Visitors who arrive while a session is in progress will see the live scene but their Connect attempt will fail. v2 adds queue + auth.
- **Pico 4 Ultra**: not explicitly tested in v1.5 scope. Same code path should work (`@nvidia/cloudxr-js` is GA across Quest 2/3/3S, Pico 4 Ultra, AVP, iOS, desktop) but Pico has known right-eye rendering issues per the CloudXR 6.1 release notes.
- **Device profile mismatch**: if the server is started without `--device-profile auto-webrtc`, codec/resolution may silently fall back. The hook compares `health.device_profile` against the requested profile and surfaces a diagnostic if they don't match.

## Rollback

If v1.5 has issues post-launch:

1. Add a Netlify redirect: `[[redirects]] from = "/connect" to = "/connect-classic/" status = 302`
2. Visitors hit `/connect-classic` (the v1 page) until the issue is resolved
3. Roll forward: drop the redirect when v1.5 is fixed

The v1 fallback works as long as `client/public/connect-classic/` exists and `/client/*` proxy is in `netlify.toml`.

## Sources

- API research: `Sim XR/03_ops_setup/cloudxr_js_api_research_2026-05-02.md`
- Original v1.5 spec: `Sim XR/03_ops_setup/connect_page_v15_inline_cloudxr_js_spec_2026-05-02.md`
- Server-side spec: `Sim XR/03_ops_setup/v15_server_endpoints_2026-05-02/`
- KB connection card: `Sim XR/03_ops_setup/kb_connection_card_draft_2026-05-02.md`
