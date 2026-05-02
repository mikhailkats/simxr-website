#!/usr/bin/env bash
# SIM XR Connect — render the multi-scene connect page with the current server IP
# and push it to the simxr-tech repo. Netlify auto-builds on push, page goes
# live at https://simxr.tech/connect/ in ~30 seconds.
#
# New architecture (2026-05-02):
# - CloudXR signaling via Cloudflare Tunnel at teleop.simxr.tech (WSS, port 443, real cert)
# - UDP media direct from headset to AWS server's public IP (no proxy)
# - Multi-scene picker reads from scenes.yaml and /var/run/simxr-current-scene.txt
# - All available scenes shown; live scene has the Connect button; others are offline
#
# Idempotent: identical inputs produce byte-identical HTML. Repeated runs with
# unchanged IP/scene won't create empty commits.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/index.html.template"
SCENES_MANIFEST="${SCRIPT_DIR}/scenes.yaml"

# Where the rendered file lands inside the simxr-tech repo.
REPO_DIR="${SIMXR_REPO_DIR:-${HOME}/Documents/Claude/Projects/Sim XR/web/simxr-tech}"
OUT_DIR="${REPO_DIR}/client/public/connect"

DRY_RUN=0
NO_PUSH=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [--dry-run] [--no-push] [-h|--help]

Renders ${TEMPLATE} with the current public IP, reads the live scene from
/var/run/simxr-current-scene.txt, and uses scenes.yaml to build scene cards.
Writes to ${OUT_DIR}/index.html and (by default) commits + pushes to GitHub.
Netlify auto-builds on push.

New architecture (2026-05-02):
  - Cloudflare Tunnel handles WSS signaling at teleop.simxr.tech (port 443)
  - UDP media flows direct to bare AWS public IP
  - Scene picker shows all available scenes; live one gets the Connect button
  - Broken scenes shown with warning note

Optional env:
  SIMXR_IP_OVERRIDE        skip public-IP lookup, use this bare IP for UDP media
  SIMXR_REPO_DIR           local path to simxr-tech repo (default ~/Documents/Claude/Projects/Sim XR/web/simxr-tech)
  SIMXR_WSS_HOSTNAME       Cloudflare Tunnel hostname for WebSocket signaling (default teleop.simxr.tech)

Flags:
  --dry-run                print rendered HTML to stdout, do not write or push
  --no-push                write to repo + git add/commit, but skip git push
  -h, --help               this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --no-push) NO_PUSH=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

WSS_HOSTNAME="${SIMXR_WSS_HOSTNAME:-teleop.simxr.tech}"

if [[ -n "${SIMXR_IP_OVERRIDE:-}" ]]; then
  IP="$SIMXR_IP_OVERRIDE"
else
  IP="$(curl -fsS --max-time 5 https://ifconfig.me || true)"
fi
if [[ -z "$IP" ]]; then
  echo "ERROR: could not resolve public IP (curl ifconfig.me failed, no SIMXR_IP_OVERRIDE)." >&2
  exit 1
fi
if ! [[ "$IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  echo "ERROR: resolved IP does not look like IPv4: $IP" >&2
  exit 1
fi

# Soft-check UDP media port on host. Warn only. Port can vary (CloudXR uses ephemeral UDP).
# This is mainly a sanity check that the server is reachable.
if command -v ss >/dev/null 2>&1; then
  if ! ss -tlnH 2>/dev/null | grep -qE ':443'; then
    echo "WARN: nothing listening on TCP port 443 on this host. WSS may not be ready." >&2
  fi
fi

html_escape() {
  local s="$1"
  s="${s//&/&amp;}"
  s="${s//</&lt;}"
  s="${s//>/&gt;}"
  s="${s//\"/&quot;}"
  s="${s//\'/&#39;}"
  printf '%s' "$s"
}

# Read the live scene ID from /var/run/simxr-current-scene.txt, if it exists.
LIVE_SCENE=""
if [[ -f /var/run/simxr-current-scene.txt ]]; then
  LIVE_SCENE="$(cat /var/run/simxr-current-scene.txt | tr -d '\n')"
fi

# Parse scenes.yaml and build the HTML scene cards.
# If YAML is not parseable, fallback to Python to avoid external deps.
render_scene_cards() {
  local live_scene="$1"
  python3 - "$SCENES_MANIFEST" "$live_scene" "$IP" "$WSS_HOSTNAME" <<'PYSCRIPT'
import sys, pathlib, json

scenes_path = sys.argv[1]
live_scene = sys.argv[2]
media_ip = sys.argv[3]
wss_hostname = sys.argv[4]

# Minimal YAML parsing for our simple schema.
scenes = []
current_scene = None

try:
  with open(scenes_path, 'r') as f:
    for line in f:
      line = line.rstrip('\n')
      if line.startswith('- id:'):
        if current_scene:
          scenes.append(current_scene)
        current_scene = {'id': line.split(': ', 1)[1].strip()}
      elif line.startswith('  name:'):
        current_scene['name'] = line.split(': ', 1)[1].strip('"\'')
      elif line.startswith('  description:'):
        current_scene['description'] = line.split(': ', 1)[1].strip('"\'')
      elif line.startswith('  status:'):
        current_scene['status'] = line.split(': ', 1)[1].strip()
      elif line.startswith('  note:'):
        current_scene['note'] = line.split(': ', 1)[1].strip('"\'')
    if current_scene:
      scenes.append(current_scene)
except Exception as e:
  print(f"ERROR parsing {scenes_path}: {e}", file=sys.stderr)
  sys.exit(1)

if not scenes:
  print("<div class='offline-notice'><div class='eyebrow'>No scenes configured</div><p>Scenes manifest is empty.</p></div>", end='')
  sys.exit(0)

# Render scene cards.
html = '<div class="scenes-grid">'

for scene in scenes:
  scene_id = scene.get('id', '')
  scene_name = scene.get('name', 'Unknown')
  scene_desc = scene.get('description', '')
  scene_status = scene.get('status', 'available')
  scene_note = scene.get('note', '')

  is_live = (scene_id == live_scene)
  is_broken = (scene_status == 'broken')
  is_available = (scene_status == 'available')

  # Card class
  card_class = 'scene-card'
  if is_live:
    card_class += ' live'
  elif not is_live and is_available:
    card_class += ' offline'
  elif is_broken:
    card_class += ' broken'

  html += f'<div class="{card_class}">'

  # LIVE badge
  if is_live:
    html += '<div class="scene-badge">Live</div>'

  # Scene name
  html += f'<h2 class="scene-name">{scene_name}</h2>'

  # Description
  html += f'<p class="scene-description">{scene_desc}</p>'

  # Status line
  if is_live:
    # Live scene: show Connect button
    connect_url = f'/client/?serverIP={wss_hostname}'
    html += f'<a class="cta-connect" href="{connect_url}">Connect</a>'
  elif is_available:
    # Offline available scene
    html += '<p class="scene-status offline">Currently offline</p>'
  elif is_broken:
    # Broken scene
    html += '<p class="scene-status broken">Unavailable</p>'
    if scene_note:
      html += f'<p class="scene-note">{scene_note}</p>'

  html += '</div>'

html += '</div>'

# If no live scene, add an offline notice before the grid
if not live_scene:
  notice = '<div class="offline-notice"><div class="eyebrow">All Scenes Offline</div><p>No scene is currently active. Check back when a session is running.</p></div>'
  html = notice + html

print(html, end='')
PYSCRIPT
}

# Timestamp = template mtime, so re-runs with identical inputs produce
# byte-identical HTML. The "Updated" label means "page content last changed at X".
TIMESTAMP="$(python3 -c "import os, datetime; print(datetime.datetime.utcfromtimestamp(os.path.getmtime('$TEMPLATE')).strftime('%Y-%m-%d %H:%M:%SZ'))")"

# Render via literal substitution — no sed delimiters that might collide with URLs.
render() {
  local out_path="$1"
  local scenes_html="$2"
  python3 - "$TEMPLATE" "$out_path" "$IP" "$scenes_html" "$TIMESTAMP" <<'PY'
import sys, pathlib
tmpl_path, out_path, ip, scenes_html, ts = sys.argv[1:]
tmpl = pathlib.Path(tmpl_path).read_text()
out = (tmpl
       .replace("__IP__", ip)
       .replace("__SCENES_BLOCK__", scenes_html)
       .replace("__TIMESTAMP__", ts))
pathlib.Path(out_path).write_text(out)
PY
}

print_summary() {
  cat <<EOF
-------- SIM XR Connect deploy summary --------
IP (UDP media)    : ${IP}
WSS hostname      : ${WSS_HOSTNAME}
Live scene        : ${LIVE_SCENE:-<none>}
Timestamp         : ${TIMESTAMP}
Rendered to       : ${OUT_DIR}/index.html
-----------------------------------------------
EOF
}

# Render scene cards
SCENES_BLOCK="$(render_scene_cards "$LIVE_SCENE")"

# Dry-run: render to a temp dir, print to stdout, exit.
if [[ "$DRY_RUN" -eq 1 ]]; then
  TMP_DIR="$(mktemp -d /tmp/simxr-connect-dry.XXXXXX)"
  render "${TMP_DIR}/index.html" "$SCENES_BLOCK"
  if grep -qE '__[A-Z_]+__' "${TMP_DIR}/index.html"; then
    echo "ERROR: unsubstituted placeholder remains in rendered HTML:" >&2
    grep -nE '__[A-Z_]+__' "${TMP_DIR}/index.html" >&2 || true
    exit 1
  fi
  echo "---- rendered index.html ----"
  cat "${TMP_DIR}/index.html"
  echo "-----------------------------"
  print_summary
  echo "(dry-run: tmp dir ${TMP_DIR}, repo not touched, nothing pushed)"
  exit 0
fi

# Real run: write into the simxr-tech repo.
if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "ERROR: ${REPO_DIR} is not a git repo. Set SIMXR_REPO_DIR to your local clone of simxr-tech." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"
render "${OUT_DIR}/index.html" "$SCENES_BLOCK"

if grep -qE '__[A-Z_]+__' "${OUT_DIR}/index.html"; then
  echo "ERROR: unsubstituted placeholder remains in rendered HTML:" >&2
  grep -nE '__[A-Z_]+__' "${OUT_DIR}/index.html" >&2 || true
  exit 1
fi

cd "${REPO_DIR}"

# Pull latest first to avoid push conflicts on shared repos.
git pull --rebase --autostash 2>&1 | head -5 || true

# Stage. If nothing changed (same IP, same scene), exit cleanly.
git add client/public/connect/index.html
if git diff --cached --quiet; then
  echo "No changes to commit. Connect page already at IP ${IP}, scene ${LIVE_SCENE:-<none>}."
  print_summary
  exit 0
fi

COMMIT_MSG="Update connect page (IP ${IP}${LIVE_SCENE:+, live scene: ${LIVE_SCENE}})"
git commit -m "${COMMIT_MSG}"

if [[ "$NO_PUSH" -eq 1 ]]; then
  echo "(--no-push: committed locally, did not push. Run 'git push' when ready.)"
  print_summary
  exit 0
fi

git push
print_summary
echo "Pushed. Netlify will auto-build; live at https://simxr.tech/connect/ in ~30s."
