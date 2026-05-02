# SIM XR Connect — Deployment Notes (2026-05-02)

## What changed

Migrated the connect page from the standalone `connect/index.html.template` (deployed to `simxr-connect.netlify.app`) into the main `simxr.tech` repo under `web/simxr-tech/client/public/connect/`. The page now lives at `https://simxr.tech/connect/` and features a multi-scene picker UI instead of a single static "Connect" button.

## Architecture (new server: sim-xr-dev-test)

- **WSS signaling:** Cloudflare Tunnel at `teleop.simxr.tech` (port 443, real TLS cert, no cert-accept tap needed)
- **UDP media:** Direct from headset → AWS server's bare public IP (no proxy)
- **Scene picker:** Reads from `scenes.yaml` + `/var/run/simxr-current-scene.txt`
- **Page source:** `web/simxr-tech/client/public/connect/index.html.template` + deploy script

## Files created / modified

### New files

1. **`web/simxr-tech/client/public/connect/index.html.template`** (6.5 KB)
   - Multi-scene picker layout, dark navy/blue theme, mobile-first
   - Placeholder tokens: `__IP__`, `__TIMESTAMP__`, `__SCENES_BLOCK__`
   - Connect button on live scene → `/client/?serverIP=teleop.simxr.tech`
   - Offline scenes shown dimly, no button
   - Broken scenes with warning color + note
   - localStorage seeding script (mediaAddress, immersiveMode, deviceProfile)

2. **`web/simxr-tech/client/public/connect/scenes.yaml`** (1.1 KB)
   - Curated scene manifest: id, name, description, status (available|broken), optional note
   - Four initial entries: NutPour, Pick&Place-Waist, ExhaustPipe, LocomanipG1-broken
   - Comment at top flags CC to verify against actual IsaacLab registry

3. **`web/simxr-tech/client/public/connect/update_connect_page.sh`** (9.7 KB)
   - New deploy script with multi-scene support
   - Reads `scenes.yaml` + `/var/run/simxr-current-scene.txt` (live scene ID)
   - Renders all scenes; live one gets LIVE badge + Connect button; others offline/broken
   - Resolves public IP for UDP media (same as old script)
   - WSS hostname hardcoded to `teleop.simxr.tech` (no port — default 443)
   - Idempotent, dry-run capable, git-aware
   - Env vars: `SIMXR_IP_OVERRIDE`, `SIMXR_REPO_DIR`, `SIMXR_WSS_HOSTNAME` (optional)

### Modified files

1. **`web/simxr-tech/netlify.toml`**
   - Added redirect: `/connect` → `/connect/` (trailing slash)
   - Added header: `/connect/*` → `X-Robots-Tag: noindex, nofollow` (defense in depth)

2. **`connect/README.md`** (old root-level directory)
   - Added one-line deprecation notice at top, pointing to new location
   - Left entire file intact for reference

## Key design decisions

### 1. Connect button URL format
**`/client/?serverIP=teleop.simxr.tech`** (no port, no port param)
- Cloudflare Tunnel is port 443 (HTTPS/WSS standard)
- IsaacTeleop client defaults to port 443 when no port param given
- Removes port ambiguity vs. old CloudXR port (48322 was TLS signaling, not WSS)

### 2. Live scene detection
Script reads `/var/run/simxr-current-scene.txt` (single-line, task ID)
- Must be written by server-side status writer (CC responsibility)
- If file missing or empty: all scenes shown as offline, offline-notice rendered
- Filename is standard sysrun path, not in `/tmp/` (survives reboots)

### 3. Scene card styling
- **Live:** accent blue border, blue tint background, LIVE badge, Connect button
- **Offline (available):** dimmed, gray "Currently offline" subtitle
- **Broken:** warning amber border/tint, strikethrough name, note with ETA
- Grid: 1 column mobile, 2 columns at 600px+ (Quest browser ≈ 540px, stays 1-col)

### 4. Idempotency
- Template mtime used as timestamp (not system time) → same inputs = same output
- No spurious commits if IP/scene unchanged
- `git pull --rebase` before stage to avoid conflicts

### 5. No forking NVIDIA client
- Still proxies via `/client/*` → `nvidia.github.io/IsaacTeleop/client`
- localStorage seeding same as old MVP (mediaAddress, immersiveMode, deviceProfile)
- URL params only pass serverIP (Cloudflare Tunnel hostname, no port)

## Integration checklist for CC

Before deploying:

1. **Create `/var/run/simxr-current-scene.txt` writer** on sim-xr-dev-test
   - Triggered when a scene is launched (as part of VR teleop startup)
   - Write single line: `Isaac-NutPour-GR1T2-Pink-IK-Abs-v0` (or whatever is live)
   - Owned by the teleop process or a systemd service

2. **Verify `scenes.yaml` against actual Isaac Lab registry**
   - Enumerate all curated tasks available on sim-xr-dev-test
   - Update the four placeholder entries with real task IDs, names, descriptions
   - Mark any known-broken scenes with status: broken + note

3. **Clone simxr-tech repo locally** (if not already done)
   - Set `SIMXR_REPO_DIR` env or use default `~/Documents/Claude/Projects/Sim XR/web/simxr-tech`
   - Test dry-run: `SIMXR_IP_OVERRIDE=203.0.113.1 ./update_connect_page.sh --dry-run`

4. **Add deploy step to VR teleop workflow**
   - After teleop is up + WSS signaling ready, run:
     ```bash
     cd /path/to/simxr-tech && ./client/public/connect/update_connect_page.sh
     ```
   - (no --scene flag needed; script reads /var/run/simxr-current-scene.txt)

5. **Netlify will auto-build on commit** to simxr-tech
   - HTML published at `https://simxr.tech/connect/` in ~30s

## Testing the page locally (without server)

```bash
cd web/simxr-tech/client/public/connect

# Dry-run: render with placeholder IP, print to stdout
SIMXR_IP_OVERRIDE=198.51.100.42 ./update_connect_page.sh --dry-run

# No live scene (all offline)
cat /tmp/simxr-connect-dry.*/index.html | grep -A 5 "All Scenes Offline"

# Simulate live scene (requires temp /var/run/simxr-current-scene.txt on the test machine)
sudo bash -c 'echo "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0" > /var/run/simxr-current-scene.txt'
SIMXR_IP_OVERRIDE=198.51.100.42 ./update_connect_page.sh --dry-run
# Should show: LIVE badge + Connect button on NutPour card, others offline
```

## Known limits / v2 blockers

- **Scene editor:** No UI to add scenes; edit `scenes.yaml` manually and re-deploy
- **Live scene writer:** CC must implement `/var/run/simxr-current-scene.txt` writes (not in this deliverable)
- **Offline notice:** Only shows when file is missing; can't distinguish between "no session active" and "file writer broken"
- **Broken scene detail:** Note is static in manifest; no real-time health check

## Rollback / fallback

If the Cloudflare Tunnel is down:
- WSS connection fails at the client level (expected)
- Page still loads + shows live scene
- Operator sees Connect button but can't establish session
- No silent failures or error pages (same UX as old MVP)

If `scenes.yaml` is corrupted:
- Script exits with error during dry-run
- No commit, nothing deploys
- Last good version stays live

If `/var/run/simxr-current-scene.txt` is missing:
- All scenes shown as offline
- No error, page loads cleanly
- CC should make file-write part of their startup checklist

## Files to preserve

- `connect/` (root-level, now deprecated) — keep for git history, reference only
- `web/simxr-tech/` (live) — this is the source of truth going forward
