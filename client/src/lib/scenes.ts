// SIM XR Connect — scenes manifest + server liveness types and fetchers.
//
// The connect page hits three small read-only endpoints served by apache on
// the Brev server, routed through the Cloudflare Tunnel at
// `api.simxr.app/api/*`. See server-side spec at
// `Sim XR/03_ops_setup/v15_server_endpoints_2026-05-02/`.

export type SceneStatus = "available" | "broken";

export interface Scene {
  id: string;             // exact gym.register task id
  name: string;           // operator-friendly display name; falls back to id when uncurated
  description?: string;   // 1-line plain-English; absent when uncurated
  status: SceneStatus;
  note?: string;          // shown when status === "broken"
}

/** True when this scene hasn't been given a curated display name yet — name === id. */
export function isUncurated(scene: Scene): boolean {
  return scene.name === scene.id;
}

// Locked contract with server-side scaffolding at
// `Sim XR/03_ops_setup/v15_server_endpoints_2026-05-02/`.
//
// session_state semantics:
//   "idle"      — teleop launcher not running; live_scene === null
//   "ready"     — teleop running, no client connected; available for new visitor
//   "streaming" — teleop running, ≥1 client connected (likely busy)
export type SessionState = "idle" | "ready" | "streaming";

export interface Healthz {
  live_scene: string | null;        // task id, or null when session_state === "idle"
  session_state: SessionState;
  active_clients: number;            // connections on CloudXR signaling port
  device_profile: string | null;     // e.g. "auto-webrtc"; null if not yet read from server env
  media_port: number;                // UDP port (47998 default; 49100 is TCP signaling)
  ts: string;                        // ISO 8601, server time

  // v1.5+ optional fields for busy / queue UX. Server may omit any of these
  // — the React UI degrades gracefully (shows "In session" without ETA).
  // v2 will introduce a real queue endpoint; until then session_state +
  // active_clients alone signal busy, and these fields are best-effort hints.
  session_started_at?: string;       // ISO 8601 — when the current session began
  max_session_duration_sec?: number; // soft cap on a single session, if enforced server-side
  wait_time_seconds?: number;        // estimated time until next slot opens (server's best guess)
  queue_length?: number;             // visitors currently waiting (v2; absent in v1.5)
}

// Derived per-card visual state. Computed from Scene.status + Healthz.
//
//   "live-ready" — scene is currently loaded on the server, no client connected,
//                  Connect button enabled (visitor can join in one tap)
//   "live-busy"  — scene is loaded but ≥1 client connected; Connect disabled,
//                  show wait-time hint if available (queue affordance lives here in v2)
//   "offline"    — scene exists in scenes.yaml but isn't the currently-loaded one
//   "broken"     — scene.status === "broken" (e.g. 3DGS-stereo affected)
export type CardState = "live-ready" | "live-busy" | "offline" | "broken";

export function computeCardState(scene: Scene, health: Healthz | null): CardState {
  if (scene.status === "broken") return "broken";
  if (!health || health.live_scene !== scene.id) return "offline";
  if (health.session_state === "streaming" && health.active_clients > 0) {
    return "live-busy";
  }
  return "live-ready";
}

export function formatWaitTime(seconds: number | undefined): string | null {
  if (seconds === undefined || seconds <= 0) return null;
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin === 0 ? `~${hours}h` : `~${hours}h ${remMin}m`;
}

// API endpoints live behind the Cloudflare Tunnel on `api.simxr.app`. Frontend
// is hosted at `simxr.app` (Netlify) — two separate subdomains, both DNS-managed
// in Cloudflare. The tunnel routes `api.simxr.app/api/*` → apache:80 on the Brev
// server (static JSON files: ip.json, healthz, scenes.json) and `api.simxr.app/*`
// → WSS proxy at localhost:48322 for CloudXR signaling.
const API_BASE = "https://api.simxr.app/api";

export class ServerOfflineError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ServerOfflineError";
  }
}

// Mock mode — set ?mock=1 in the URL to render the page with canned data,
// useful for offline preview / iteration without server-side endpoints.
// Optional refinements via URL params:
//   ?mock=1                                       → NutPour live, idle session
//   ?mock=1&live=offline                          → no live scene (all-offline state)
//   ?mock=1&live=Isaac-ExhaustPipe-GR1T2-Pink-IK-Abs-v0   → that scene as live
//   ?mock=1&error=scenes                          → simulate /scenes.json fetch error
export function isMockMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mock") === "1";
}

function mockUrlParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

// Mock data simulating the hybrid auto-discover + override pipeline:
//   - First few entries: curated (have name + description)
//   - Last few: raw / uncurated (name === id, no description) — what a freshly
//     auto-discovered scene looks like before someone adds a YAML override
const MOCK_SCENES: Scene[] = [
  {
    id: "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0",
    name: "NutPour — GR1T2",
    description: "Humanoid GR1T2 with Pink-IK arms pours nuts from a beaker into a target bowl.",
    status: "available",
  },
  {
    id: "Isaac-PickPlace-GR1T2-Abs-v0",
    name: "Pick & Place — GR1T2",
    description: "Vanilla bimanual pick-and-place with Fourier GR1T2 humanoid; no special IK.",
    status: "available",
  },
  {
    id: "Isaac-PickPlace-GR1T2-WaistEnabled-Abs-v0",
    name: "Pick & Place — Waist-Enabled",
    description: "Bimanual pick-and-place with full GR1T2 waist articulation enabled.",
    status: "available",
  },
  {
    id: "Isaac-ExhaustPipe-GR1T2-Pink-IK-Abs-v0",
    name: "Exhaust Pipe Assembly",
    description: "Industrial exhaust-pipe routing task with Pink-IK arms.",
    status: "available",
  },
  // Uncurated: name === id, no description. Auto-discovered, awaits YAML override.
  {
    id: "Isaac-PickPlace-G1-InspireFTP-Abs-v0",
    name: "Isaac-PickPlace-G1-InspireFTP-Abs-v0",
    status: "available",
  },
  {
    id: "Isaac-PickPlace-Locomanipulation-G1-Abs-v0",
    name: "Isaac-PickPlace-Locomanipulation-G1-Abs-v0",
    status: "available",
  },
  {
    id: "Isaac-PickPlace-FixedBaseUpperBodyIK-G1-Abs-v0",
    name: "Isaac-PickPlace-FixedBaseUpperBodyIK-G1-Abs-v0",
    status: "available",
  },
  {
    id: "Isaac-PickPlace-Locomanipulation-G1-3DGS-Abs-v0",
    name: "Locomanipulation 3DGS — G1",
    description: "Mobile Unitree G1 with NuRec/Gaussian Bali room background.",
    status: "broken",
    note: "3DGS background renders incorrectly in Quest stereo (foreground/robot/hands/table fine). Tracking the open NuRec stereo investigation.",
  },
  {
    id: "Isaac-PickPlace-FixedBaseUpperBodyIK-G1-3DGS-Abs-v0",
    name: "Fixed-Base Upper-Body IK 3DGS — G1",
    description: "Unitree G1 fixed-base with NuRec/Gaussian Bali room background.",
    status: "broken",
    note: "Same 3DGS-stereo blocker as the locomanipulation 3DGS variant.",
  },
];

function buildMockHealth(): Healthz {
  const liveOverride = mockUrlParam("live");
  let liveScene: string | null = "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0";
  if (liveOverride === "offline") liveScene = null;
  else if (liveOverride && MOCK_SCENES.some((s) => s.id === liveOverride)) liveScene = liveOverride;

  let sessionState: SessionState = "idle";
  if (liveScene) {
    // Default mock = "ready" (server up, no client). Override with ?busy=1 to
    // simulate "streaming" (someone else connected — visitor sees in-use UI).
    sessionState = mockUrlParam("busy") === "1" ? "streaming" : "ready";
  }

  // Optional wait-time injection for previewing the busy-with-ETA state.
  //   ?busy=1            → busy with no ETA (generic "In session")
  //   ?busy=1&wait=180   → busy with ~3 min ETA
  const waitParam = mockUrlParam("wait");
  const waitSeconds = waitParam ? parseInt(waitParam, 10) : undefined;
  const sessionStartedAtParam = mockUrlParam("started");

  const health: Healthz = {
    live_scene: liveScene,
    session_state: sessionState,
    active_clients: sessionState === "streaming" ? 1 : 0,
    device_profile: "auto-webrtc",
    media_port: 47998,
    ts: new Date().toISOString(),
  };
  if (sessionState === "streaming") {
    if (waitSeconds && Number.isFinite(waitSeconds)) {
      health.wait_time_seconds = waitSeconds;
    }
    if (sessionStartedAtParam) {
      health.session_started_at = sessionStartedAtParam;
    } else {
      // Default mock: session started 2 minutes ago.
      health.session_started_at = new Date(Date.now() - 120_000).toISOString();
    }
    health.max_session_duration_sec = 600;  // 10 min soft cap (mock value)
  }
  return health;
}

const MOCK_DELAY_MS = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
    });
  } catch (e) {
    throw new ServerOfflineError(`Failed to reach ${path}`, e);
  }
  if (!response.ok) {
    throw new ServerOfflineError(`${path} returned HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchScenes(): Promise<Scene[]> {
  if (isMockMode()) {
    await sleep(MOCK_DELAY_MS);
    if (mockUrlParam("error") === "scenes") {
      throw new ServerOfflineError("(mock) /scenes.json simulated failure");
    }
    return MOCK_SCENES;
  }
  // Live path: api.simxr.app/api/scenes.json. Server returns
  // { scenes: Scene[], ts: string } per the locked endpoint contract.
  try {
    const data = await fetchJson<{ scenes: Scene[]; ts: string }>("/scenes.json");
    return data.scenes;
  } catch (apiErr) {
    // Static fallback: same-origin /connect/scenes.json, generated at build
    // time from scenes.yaml by scripts/build-scenes-fallback.mjs. Lets the
    // catalog render even when the Brev server / Cloudflare Tunnel is down.
    // Per-scene live status (live-ready / live-busy) requires healthz, which
    // remains api-only — fallback scenes always render as "offline" (or
    // "broken" if scenes.yaml flagged them).
    try {
      const res = await fetch("/connect/scenes.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`fallback /connect/scenes.json HTTP ${res.status}`);
      const data = (await res.json()) as { scenes: Scene[]; ts: string };
      return data.scenes;
    } catch (fallbackErr) {
      // Both sources failed — re-throw the original API error so the UI shows
      // the "between sessions" state with the correct upstream context.
      throw apiErr;
    }
  }
}

export async function fetchHealth(): Promise<Healthz> {
  if (isMockMode()) {
    await sleep(MOCK_DELAY_MS);
    return buildMockHealth();
  }
  return fetchJson<Healthz>("/healthz");
}

export async function fetchMediaIp(): Promise<string> {
  if (isMockMode()) {
    await sleep(MOCK_DELAY_MS);
    if (mockUrlParam("error") === "ip") {
      throw new ServerOfflineError("(mock) /ip.json simulated failure");
    }
    return "192.0.2.42";  // RFC 5737 documentation IP
  }
  // Server returns { ip: string | null, ts: string } per locked contract.
  // null means teleop launcher hasn't run since the last brev start.
  const data = await fetchJson<{ ip: string | null; ts: string }>("/ip.json");
  if (data.ip === null) {
    throw new ServerOfflineError(
      "Server reports no current IP — teleop launcher hasn't been started yet for this session.",
    );
  }
  if (!/^[0-9]{1,3}(?:\.[0-9]{1,3}){3}$/.test(data.ip)) {
    throw new Error(`Server returned non-IPv4 mediaAddress: ${data.ip}`);
  }
  return data.ip;
}
