// SIM XR Dashboard — v2 Connect page (operator-style "personal cabinet" feel).
//
// Mounted at /v2 on simxr.app. Reuses the existing useCloudXRSession hook
// (same WebXR + CloudXR.js connect flow that runs on /connect), the same
// scenes/healthz fetch contract, and the same computeCardState logic.
// Visual layer is new: sidebar + topbar + stat row + live-scene banner +
// image-cover catalog grid. Operator dashboard at /operator/app.html was
// the design reference.
//
// Real-data wiring per Mike's "all 5 improvements" list:
//   1. Stat cards + live banner pull from session.health (not hardcoded)
//   2. Filter chips actually filter the catalog client-side
//   3. Hover micro-interactions on scene cards (CSS in Dashboard.css)
//   4. Staggered fade-in on first paint (CSS @keyframes + nth-child delay)
//   5. NVIDIA Inception + CloudXR marks in the footer

import { Suspense, useEffect, useMemo, useState } from "react";
import { computeCardState, fetchScenes, type Scene } from "@/lib/scenes";
import { useCloudXRSession, type UiSessionState } from "@/lib/useCloudXRSession";
import "./Dashboard.css";

// ─── Scene → preview asset map ────────────────────────────────────────────
// Reuses operator/* images and the one looping pour video. When per-scene
// custom previews land, swap the URLs here.
type SceneAsset = { type: "image" | "video"; src: string; poster?: string };

const SCENE_ASSETS: Record<string, SceneAsset> = {
  "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0": {
    type: "video",
    src: "/operator/videos/mission-pour.mp4",
    poster: "/operator/images/mission-pour.png",
  },
  "Isaac-PickPlace-GR1T2-Abs-v0": {
    // Custom Pick & Place GR1T2 clip — Mike's hand-picked footage 2026-05-03.
    type: "video",
    src: "/operator/videos/pickplace-gr1t2.mp4",
  },
  "Isaac-PickPlace-GR1T2-WaistEnabled-Abs-v0": {
    // Inherited the looping arena gif from Locomanip-G1 (Mike's swap 2026-05-03):
    // Locomanip-G1 got a custom mp4 of the actual scene we connected to,
    // and this card keeps the previously-shared placeholder for now.
    type: "image",
    src: "/operator/images/task-references/g1_galileo_arena_box_pnp_locomanip.gif",
  },
  "Isaac-ExhaustPipe-GR1T2-Pink-IK-Abs-v0": {
    // Custom Exhaust Pipe Assembly clip — Mike's hand-picked footage 2026-05-03.
    type: "video",
    src: "/operator/videos/exhaust-pipe-gr1t2.mp4",
  },
  "Isaac-PickPlace-G1-InspireFTP-Abs-v0": {
    type: "image",
    src: "/operator/images/task-references/kitchen_gr1_arena.gif",
  },
  "Isaac-PickPlace-Locomanipulation-G1-Abs-v0": {
    // Custom clip of the actual Locomanip-G1 scene we connected to via VR
    // 2026-05-03 — Mike's hand-picked footage, not a generic operator
    // placeholder. When we ship per-scene preview pipeline, swap here.
    type: "video",
    src: "/operator/videos/locomanip-g1.mp4",
  },
  "Isaac-PickPlace-FixedBaseUpperBodyIK-G1-Abs-v0": {
    type: "image",
    src: "/operator/images/task-references/franka_kitchen_pickup.gif",
  },
  "Isaac-PickPlace-Locomanipulation-G1-3DGS-Abs-v0": {
    type: "image",
    src: "/operator/images/task-references/scene-cosmos-data-reasoning.gif",
  },
  "Isaac-PickPlace-FixedBaseUpperBodyIK-G1-3DGS-Abs-v0": {
    type: "image",
    src: "/operator/images/task-references/scene-isaac-groot-loop.gif",
  },
};

// Robot tag derived from scene id — used by filter chips and card tags.
function robotTag(id: string): "GR1T2" | "G1" | "other" {
  if (id.includes("GR1T2")) return "GR1T2";
  if (id.includes("-G1-")) return "G1";
  return "other";
}

function skillTag(id: string): string {
  if (id.includes("NutPour")) return "Pink-IK · Pour";
  if (id.includes("ExhaustPipe")) return "Assembly";
  if (id.includes("Locomanipulation")) return "Locomanipulation";
  if (id.includes("FixedBase")) return "Fixed-base · Upper body IK";
  if (id.includes("WaistEnabled")) return "Waist-enabled";
  if (id.includes("InspireFTP")) return "Dexterous";
  if (id.includes("PickPlace")) return "Bimanual";
  return "Manipulation";
}

// Robot family label for tags (more descriptive than the bare token).
function robotLabel(id: string): string {
  if (id.includes("GR1T2")) return "Fourier GR1T2";
  if (id.includes("G1-InspireFTP")) return "Unitree G1 + Inspire";
  if (id.includes("-G1-")) return "Unitree G1";
  return "Robot";
}

// CTA label mirrors SceneCard.tsx's ctaLabel — same in-flight phrasing
// across both /connect and /v2 so visitor messaging stays consistent.
function ctaLabel(state: UiSessionState): string {
  switch (state) {
    case "preflight": return "Checking server…";
    case "requesting-xr": return "Opening VR…";
    case "connecting": return "Connecting…";
    case "connected":
    case "streaming": return "In session";
    case "disconnecting": return "Disconnecting…";
    default: return "Connect";
  }
}

// ─── Header pills — independent latency tracker ──────────────────────────
// useCloudXRSession polls /healthz internally but doesn't expose round-trip
// latency. We do a lightweight parallel poll here just to populate the
// "Latency" pill. Same Page-Visibility-aware pattern as the preview HTML.
const LATENCY_HISTORY_LEN = 20;

function useLatencyPing(intervalMs = 5000): {
  latency: number | null;
  reachable: boolean;
  history: (number | null)[];
} {
  const [latency, setLatency] = useState<number | null>(null);
  const [reachable, setReachable] = useState<boolean>(true);
  const [history, setHistory] = useState<(number | null)[]>([]);

  useEffect(() => {
    if (intervalMs <= 0) return;
    let timer: number | null = null;
    let cancelled = false;

    const ping = async () => {
      const t0 = performance.now();
      try {
        const r = await fetch("https://api.simxr.app/api/healthz", {
          cache: "no-store",
          mode: "cors",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if (cancelled) return;
        const ms = Math.round(performance.now() - t0);
        setLatency(ms);
        setReachable(true);
        setHistory((h) => [...h.slice(-(LATENCY_HISTORY_LEN - 1)), ms]);
      } catch {
        if (cancelled) return;
        setLatency(null);
        setReachable(false);
        // Push null to leave a gap in the sparkline (visualises the offline window).
        setHistory((h) => [...h.slice(-(LATENCY_HISTORY_LEN - 1)), null]);
      }
    };

    const start = () => {
      if (timer != null) return;
      ping();
      timer = window.setInterval(ping, intervalMs);
    };
    const stop = () => {
      if (timer == null) return;
      window.clearInterval(timer);
      timer = null;
    };

    if (!document.hidden) start();
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  return { latency, reachable, history };
}

// ─── Latency sparkline ──────────────────────────────────────────────────
// Inline SVG bar-chart of last N round-trip latency samples. Uses the same
// values already polled for the latency pill — no extra server load. Bar
// colour by threshold (green <200ms / amber 200-500 / red >500). Null
// samples (offline windows) render as a faint ghost bar so the timeline
// visibly gaps instead of silently compressing.
function LatencySparkline({ history }: { history: (number | null)[] }) {
  const N = LATENCY_HISTORY_LEN;
  const W = 2, GAP = 1, H = 14;
  const totalW = N * W + (N - 1) * GAP;
  const cap = 600; // anything >cap fills the full bar height

  // Pad history at left with nulls so newest sample always sits at the right.
  const padded: (number | null)[] = Array(N).fill(null);
  const tail = history.slice(-N);
  for (let i = 0; i < tail.length; i++) padded[N - tail.length + i] = tail[i];

  return (
    <svg
      width={totalW}
      height={H}
      viewBox={`0 0 ${totalW} ${H}`}
      style={{ verticalAlign: "middle", marginLeft: 4 }}
      aria-hidden="true"
    >
      {padded.map((v, i) => {
        const x = i * (W + GAP);
        if (v == null) {
          return <rect key={i} x={x} y={H - 3} width={W} height={3} fill="currentColor" opacity={0.18} />;
        }
        const ratio = Math.min(1, v / cap);
        const h = Math.max(2, Math.round(ratio * H));
        const colour = v > 500 ? "#FF4A5C" : v > 200 ? "#F5B842" : "#4ECE8C";
        return <rect key={i} x={x} y={H - h} width={W} height={h} fill={colour} />;
      })}
    </svg>
  );
}

// ─── Live datetime in topbar ─────────────────────────────────────────────
function useLiveClock(): string {
  const [str, setStr] = useState("—");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
      const monthDay = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const time = d.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
      const tzMatch = d
        .toLocaleTimeString("en-US", { timeZoneName: "short" })
        .match(/[A-Z]{2,5}$/);
      const tz = tzMatch ? tzMatch[0] : "";
      setStr(`${weekday}, ${monthDay} · ${time}${tz ? " " + tz : ""}`);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return str;
}

// ─── Theme toggle ───────────────────────────────────────────────────────
// Resolution order on first visit:
//   1. localStorage (if user has explicitly toggled before, that wins)
//   2. window.matchMedia('(prefers-color-scheme: light)') — system preference
//   3. dark (default for the operator-console aesthetic)
// After the first toggle we save explicitly and stop following the system —
// classic "respect user choice once made" pattern.
function resolveInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage?.getItem("sim-xr-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* localStorage might be blocked */ }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

function useTheme(): { theme: "dark" | "light"; toggle: () => void } {
  const [theme, setTheme] = useState<"dark" | "light">(resolveInitialTheme);
  const toggle = () => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      try { localStorage.setItem("sim-xr-theme", next); } catch { /* ignore */ }
      return next;
    });
  };
  return { theme, toggle };
}

// ─── Component ──────────────────────────────────────────────────────────
function DashboardInner() {
  const session = useCloudXRSession();
  const { latency, reachable, history: latencyHistory } = useLatencyPing(5000);
  const datetime = useLiveClock();
  const { theme, toggle } = useTheme();

  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [scenesError, setScenesError] = useState<string | null>(null);

  // Filter chips state — pure client-side, applied to the catalog only.
  const [robotFilter, setRobotFilter] = useState<"all" | "GR1T2" | "G1">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "broken">("all");

  useEffect(() => {
    let cancelled = false;
    fetchScenes()
      .then((s) => !cancelled && setScenes(s))
      .catch((e) => !cancelled && setScenesError((e as Error).message));
    return () => { cancelled = true; };
  }, []);

  const liveSceneId = session.health?.live_scene ?? null;

  const decorated = useMemo(() => {
    if (!scenes) return [];
    return scenes.map((s) => ({
      scene: s,
      state: computeCardState(s, session.health),
    }));
  }, [scenes, session.health]);

  // Sort: live-ready → live-busy → offline → broken
  const sortedScenes = useMemo(() => {
    const order: Record<string, number> = {
      "live-ready": 0, "live-busy": 1, offline: 2, broken: 3,
    };
    return [...decorated].sort(
      (a, b) => (order[a.state] ?? 99) - (order[b.state] ?? 99),
    );
  }, [decorated]);

  // Filter chips applied AFTER sort.
  const visibleScenes = useMemo(() => {
    return sortedScenes.filter(({ scene, state }) => {
      if (robotFilter !== "all" && robotTag(scene.id) !== robotFilter) return false;
      if (statusFilter === "available" && state !== "live-ready" && state !== "offline") return false;
      if (statusFilter === "broken" && state !== "broken") return false;
      return true;
    });
  }, [sortedScenes, robotFilter, statusFilter]);

  const liveScene = scenes?.find((s) => s.id === liveSceneId) ?? null;
  const sessionInFlight = session.state !== "idle" && session.state !== "error";

  // Stats values — all derived from real session.health
  const liveSceneShortName = liveScene?.name ?? "None";
  const sessionStateLabel = session.health?.session_state ?? "—";
  const sessionStateMeta = session.health
    ? `${session.health.active_clients} active client${session.health.active_clients === 1 ? "" : "s"}`
    : "no server contact";
  const scenesCount = scenes?.length ?? 0;
  const scenesMeta = scenes
    ? `${scenes.filter((s) => s.status === "available").length} ready · ${scenes.filter((s) => s.status === "broken").length} in repair`
    : "—";

  const lastPollHHMMSS = (() => {
    const ts = session.health?.ts;
    if (!ts) return null;
    const m = ts.match(/T(\d{2}:\d{2}:\d{2})/);
    return m ? `${m[1]}Z` : null;
  })();

  return (
    <div className={`dashboard-root ${theme === "light" ? "light" : ""}`}>
      <Fonts />
      <div className="layout">

        {/* ============ SIDEBAR ============ */}
        <aside className="sidebar">
          <div className="logo-block">
            <span className="wordmark-side">
              SIM <span className="accent">XR.</span>
            </span>
            <span className="wordmark-section">Operator</span>
          </div>

          <nav>
            <div className="nav-section-label">Demo</div>
            <a className="nav-item active">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="3" width="7" height="9" rx="1"/>
                <rect x="14" y="3" width="7" height="5" rx="1"/>
                <rect x="14" y="12" width="7" height="9" rx="1"/>
                <rect x="3" y="16" width="7" height="5" rx="1"/>
              </svg>
              <span>Tasks</span>
              <span className="badge">{scenesCount || "—"}</span>
            </a>
            <a className="nav-item disabled">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="9"/>
                <polygon points="10 8 16 12 10 16" fill="currentColor"/>
              </svg>
              <span>Live session</span>
              <span className="soon">soon</span>
            </a>
            <a className="nav-item disabled">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="M3 10h18"/>
              </svg>
              <span>Recordings</span>
              <span className="soon">soon</span>
            </a>
            <a className="nav-item disabled">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>
              </svg>
              <span>Profile</span>
              <span className="soon">soon</span>
            </a>

            <div className="nav-section-label">Library</div>
            <a className="nav-item disabled">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M2 20h20M6 20V10M11 20V4M16 20v-8M21 20v-5"/>
              </svg>
              <span>Stats</span>
              <span className="soon">soon</span>
            </a>
            <a className="nav-item disabled">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Docs</span>
              <span className="soon">soon</span>
            </a>
          </nav>

          <div className="sidebar-bottom">
            <div className="device-card">
              <div className="device-header">
                <span className="device-label">DEVICE</span>
                <span className="device-status">
                  <span className="dot" />
                  DETECTED
                </span>
              </div>
              <div className="device-row">
                <span>Quest 3</span>
                <span className="dot" />
              </div>
            </div>
            <div className="user-pill">
              <div className="user-avatar">MK</div>
              <div className="user-name">Mike K.</div>
            </div>
          </div>
        </aside>

        {/* ============ MAIN ============ */}
        <main className="main">
          <div className="topbar">
            <div>
              <div className="welcome">Welcome back, Mike.</div>
              <div className="welcome-date">{datetime}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {reachable ? (
                <span className="status-pill">
                  <span className="dot pulse-success" />
                  Server live
                </span>
              ) : (
                <span className="status-pill offline">
                  <span className="dot pulse-danger" />
                  Server offline
                </span>
              )}

              <span className={`h-pill ${reachable ? "" : "dim"}`} title="Round-trip latency · last 20 samples">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                Latency{" "}
                <span className={
                  !reachable || latency == null ? "" :
                  latency > 500 ? "accent-warn" :
                  latency > 200 ? "accent-warn" : "accent-success"
                }>
                  {reachable && latency != null ? `~${latency}ms` : "—"}
                </span>
                <LatencySparkline history={latencyHistory} />
              </span>

              <span className={`h-pill ${reachable ? "" : "dim"}`} title="Server timestamp of last successful poll">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9"/>
                  <polyline points="12 7 12 12 15 14"/>
                </svg>
                Last poll <span className="accent-volt">{reachable && lastPollHHMMSS ? lastPollHHMMSS : "—"}</span>
              </span>

              <span className={`h-pill volt-soft ${reachable ? "" : "dim"}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4361FF" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="9" rx="1"/>
                  <rect x="14" y="3" width="7" height="5" rx="1"/>
                  <rect x="14" y="12" width="7" height="9" rx="1"/>
                  <rect x="3" y="16" width="7" height="5" rx="1"/>
                </svg>
                <span className="accent-volt">{reachable && scenesCount ? scenesCount : "—"}</span> scenes
              </span>

              <button onClick={toggle} className="h-icon-btn" title="Toggle theme">
                {theme === "dark" ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                  </svg>
                )}
              </button>

              <button className="h-icon-btn" title="Notifications">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                  <path d="M10 21a2 2 0 0 0 4 0"/>
                </svg>
                <span className="notif-dot" />
              </button>
            </div>
          </div>

          <div className="grid-dark" style={{ minHeight: "calc(100vh - 60px)" }}>
            <div className="wrap">

              <div className="page-header">
                <div className="eyebrow">Live demo · sim-xr-dev-test · eu-north-1</div>
                <h1>Choose a scene to step into.</h1>
              </div>

              {session.error && (
                <div className="error-banner">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4A5C" strokeWidth="1.8" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div>
                    <div className="label">Connect failed</div>
                    <div className="text">{session.error}</div>
                  </div>
                </div>
              )}

              {/* STATS ROW */}
              <div className="stats-row">
                <div className="stat-card">
                  <div className="label">Live scene</div>
                  <div className={`value small ${liveSceneShortName === "None" ? "muted" : ""}`}>
                    {liveSceneShortName}
                  </div>
                  <div className={`meta ${liveSceneId ? "success" : ""}`}>
                    {liveSceneId
                      ? session.health?.session_state === "ready"
                        ? "Ready · tap to enter"
                        : `In session · ${session.health?.active_clients ?? 0} client${(session.health?.active_clients ?? 0) === 1 ? "" : "s"}`
                      : "No scene currently loaded"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="label">Session state</div>
                  <div className="value small">{sessionStateLabel}</div>
                  <div className="meta">{sessionStateMeta}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Scenes available</div>
                  <div className="value tabular">{scenesCount || "—"}</div>
                  <div className="meta">{scenesMeta}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Server</div>
                  <div className="value small">eu-north-1</div>
                  <div className="meta">UDP {session.health?.media_port ?? "—"} · WSS 443</div>
                </div>
              </div>

              {/* LIVE SCENE BANNER — real or placeholder */}
              {liveScene ? (
                <LiveSceneBanner
                  scene={liveScene}
                  asset={SCENE_ASSETS[liveScene.id]}
                  sessionState={session.state}
                  sessionInFlight={sessionInFlight}
                  onConnect={() => void session.connect()}
                />
              ) : (
                <div className="live-banner no-live">
                  <div className="image" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    No live scene
                  </div>
                  <div className="body">
                    <div className="eyebrow">Server idle</div>
                    <h2>No scene currently loaded.</h2>
                    <p>{scenesError ? `Server unreachable: ${scenesError}` : "When the operator launches a scene from the simulator, it will appear here ready to enter."}</p>
                  </div>
                </div>
              )}

              {/* CATALOG HEADER */}
              <div className="catalog-header">
                <div>
                  <h2>Scene catalog</h2>
                  <div className="count" style={{ marginTop: 4 }}>
                    {scenes ? `${scenes.length} scenes total · pulled from server scenes.yaml` : "loading…"}
                  </div>
                </div>
              </div>

              {/* FILTER CHIPS — wired to state */}
              <div className="chips">
                <span className="label">Robot</span>
                {(["all", "GR1T2", "G1"] as const).map((r) => (
                  <button
                    key={r}
                    className={`chip ${robotFilter === r ? "active" : ""}`}
                    onClick={() => setRobotFilter(r)}
                  >
                    {r === "all" ? "All" : r}
                  </button>
                ))}
                <span className="sep" />
                <span className="label">Status</span>
                {(["all", "available", "broken"] as const).map((s) => (
                  <button
                    key={s}
                    className={`chip ${statusFilter === s ? "active" : ""}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "All" : s === "available" ? "Available" : "In repair"}
                  </button>
                ))}
              </div>

              {/* SCENE GRID */}
              <div className="scene-grid">
                {visibleScenes.map(({ scene, state }) => (
                  <SceneCardDb
                    key={scene.id}
                    scene={scene}
                    state={state}
                    asset={SCENE_ASSETS[scene.id]}
                    sessionState={session.state}
                    sessionInFlight={sessionInFlight}
                    onConnect={() => void session.connect()}
                  />
                ))}
              </div>

              {/* FOOTER STRIP — NVIDIA brand marks (improvement #5) */}
              <div className="footer-strip">
                <span className="footer-mark">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76B900" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span className="nv-wordmark">NVIDIA</span> Inception Member
                </span>
                <span className="pipe">·</span>
                <span className="footer-mark">
                  Powered by <span className="nv-wordmark">NVIDIA</span> CloudXR
                </span>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Same Google Fonts injection trick Connect.tsx uses — keeps the dashboard
// brand consistent with the operator dashboard's typography (Inter + IBM
// Plex Mono) without depending on global page CSS.
function Fonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"
      />
      <meta name="robots" content="noindex, nofollow" />
    </>
  );
}

interface SceneCardDbProps {
  scene: Scene;
  state: ReturnType<typeof computeCardState>;
  asset?: SceneAsset;
  sessionState: UiSessionState;
  sessionInFlight: boolean;
  onConnect: () => void;
}

function SceneCardDb({ scene, state, asset, sessionState, sessionInFlight, onConnect }: SceneCardDbProps) {
  const cls = `scene-card ${state === "live-ready" ? "live" : state === "live-busy" ? "live" : state === "broken" ? "broken" : "offline"}`;
  return (
    <div className={cls}>
      <div className="image">
        {asset?.type === "video" ? (
          <video
            src={asset.src}
            poster={asset.poster}
            muted playsInline preload="metadata" loop autoPlay
          />
        ) : asset?.type === "image" ? (
          <img src={asset.src} alt="" />
        ) : null}
        {state === "live-ready" && (
          <span className="badge live"><span className="dot" /> LIVE</span>
        )}
        {state === "live-busy" && (
          <span className="badge live"><span className="dot" /> IN SESSION</span>
        )}
        {state === "broken" && <span className="badge broken">⚠ IN REPAIR</span>}
      </div>
      <div className="body">
        <div className="tags">
          <span className="tag">{robotLabel(scene.id)}</span>
          <span className="tag dot">{skillTag(scene.id)}</span>
        </div>
        <h3>{scene.name}</h3>
        {scene.description && <p>{scene.description}</p>}
        <div className="footer">
          {state === "live-ready" && (
            <>
              <span className="status">Ready · tap to enter</span>
              <button
                className="btn-connect"
                onClick={onConnect}
                disabled={sessionInFlight}
              >
                {ctaLabel(sessionState)}
              </button>
            </>
          )}
          {state === "live-busy" && (
            <>
              <span className="status">In session</span>
              <button className="btn-disabled" disabled>queue · soon</button>
            </>
          )}
          {state === "offline" && (
            <>
              <span className="status offline">Currently offline</span>
              <button className="btn-disabled">—</button>
            </>
          )}
          {state === "broken" && (
            <>
              <span className="status broken">Stereo render bug</span>
              <button className="btn-disabled">—</button>
            </>
          )}
        </div>
        {state === "broken" && scene.note && (
          <div className="note" title={scene.note}>{scene.note}</div>
        )}
      </div>
    </div>
  );
}

interface LiveSceneBannerProps {
  scene: Scene;
  asset?: SceneAsset;
  sessionState: UiSessionState;
  sessionInFlight: boolean;
  onConnect: () => void;
}

function LiveSceneBanner({ scene, asset, sessionState, sessionInFlight, onConnect }: LiveSceneBannerProps) {
  return (
    <div className="live-banner">
      <div className="image">
        {asset?.type === "video" ? (
          <video src={asset.src} poster={asset.poster} muted playsInline preload="metadata" loop autoPlay />
        ) : asset?.type === "image" ? (
          <img src={asset.src} alt={scene.name} />
        ) : null}
        <span className="live-badge"><span className="dot" /> LIVE</span>
      </div>
      <div className="body">
        <div className="eyebrow">In session · ready to enter</div>
        <h2>{scene.name}</h2>
        {scene.description && <p>{scene.description}</p>}
      </div>
      <button className="btn-primary" onClick={onConnect} disabled={sessionInFlight}>
        {ctaLabel(sessionState)}
        {sessionState === "idle" || sessionState === "error" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 5l7 7-7 7"/>
          </svg>
        ) : null}
      </button>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
