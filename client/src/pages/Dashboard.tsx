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

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { computeCardState, fetchScenes, type Scene } from "@/lib/scenes";
import { useCloudXRSession, type UiSessionState } from "@/lib/useCloudXRSession";
import { SCENE_ASSETS, robotLabel, skillTag, type SceneAsset } from "@/lib/scene_assets";
import {
  fetchRecordings,
  shouldHighlightFresh,
  type Recording,
  type RecordingsResponse,
} from "@/lib/recordings";
import "./Dashboard.css";

// SCENE_ASSETS + SceneAsset + robotLabel + skillTag now live in
// @/lib/scene_assets so the Recordings view can reuse the same id → media
// mapping without forcing a separate chunk.

// Robot tag derived from scene id — used by filter chips and card tags.
function robotTag(id: string): "GR1T2" | "G1" | "other" {
  if (id.includes("GR1T2")) return "GR1T2";
  if (id.includes("-G1-")) return "G1";
  return "other";
}

// ─── Recordings — formatting helpers ────────────────────────────────────
// The sidebar's Recordings tab pulls live data from
// `api.simxr.app/api/recordings.json` (see lib/recordings.ts). No
// localStorage layer, no synthetic episodes/quality/status — server JSON
// is the single source of truth. Formatting helpers below are shared
// between the catalog view (for the Live banner) and the recordings list.

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m < 60) return `${m}:${String(s).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtRecordedAt(iso: string): { primary: string; secondary: string } {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  let primary: string;
  if (sameDay) primary = `Today · ${time}`;
  else if (isYesterday) primary = `Yesterday · ${time}`;
  else {
    const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    primary = `${md} · ${time}`;
  }

  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  let secondary: string;
  if (diffSec < 60) secondary = `${Math.max(0, diffSec)}s ago`;
  else if (diffMin < 60) secondary = `${diffMin} min ago`;
  else if (diffHour < 24) secondary = `${diffHour} h ago`;
  else secondary = `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return { primary, secondary };
}

function fmtTotalSize(recordings: Recording[]): string {
  const total = recordings.reduce(
    (sum, r) => sum + (r.file_size_bytes ?? 0),
    0,
  );
  return fmtSize(total);
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
  const [, setLocation] = useLocation();
  // WebXR DOM Overlay container ref — declared first so the
  // `getDomOverlayRoot` callback below can capture it. The actual <div
  // ref={overlayRef}> is rendered at the end of the dashboard's JSX so
  // the ref is wired by the time the user taps Connect.
  const overlayRef = useRef<HTMLDivElement>(null);

  // After the CloudXR stream stops (Quest exit gesture, server-side stop, or
  // crash mid-recording), redirect the operator to /recordings with the
  // just-recorded scene highlighted. The hook ends the WebXR session and
  // cleans up before this fires, so navigation can proceed without racing.
  // taskId comes from the corresponding session.connect(scene.id) call.
  //
  // `getDomOverlayRoot` lets the hook fetch the live DOM ref at
  // requestSession time. We use a getter (not a static prop) because
  // refs don't trigger re-renders — by the time the operator taps
  // Connect, the <div ref={overlayRef}> has been mounted and ref is
  // populated. Hook reads this lazily when it needs to pass `domOverlay`
  // to xr.requestSession().
  const session = useCloudXRSession({
    onSessionEnded: (taskId) => {
      const target = taskId
        ? `/recordings?fresh=${encodeURIComponent(taskId)}`
        : "/recordings";
      setLocation(target);
    },
    getDomOverlayRoot: () => overlayRef.current,
  });
  const { latency, reachable, history: latencyHistory } = useLatencyPing(5000);
  const datetime = useLiveClock();
  const { theme, toggle } = useTheme();

  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [scenesError, setScenesError] = useState<string | null>(null);

  // Filter chips state — pure client-side, applied to the catalog only.
  const [robotFilter, setRobotFilter] = useState<"all" | "GR1T2" | "G1">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "broken">("all");

  // Sidebar view switcher. "tasks" = scene catalog + connect (live demo
  // entry point). "recordings" = session history fetched live from
  // api.simxr.app/api/recordings.json — same surface that VR exit's
  // onSessionEnded auto-redirect lands on. Other sidebar items remain
  // disabled until backend lands.
  //
  // Initial view is URL-driven so:
  //   - simxr.app/recordings (or /recordings/) → boots straight into
  //     the recordings tab; refreshing the page keeps you there.
  //   - simxr.app/?fresh=<task_id> + sessionEnded redirect → also
  //     lands on recordings with the badge highlighted.
  //   - Anything else → tasks view.
  // Sidebar nav clicks call setView() AND setLocation() so URL stays in
  // sync with the visible tab; back/forward in browser history works.
  const initialView: "tasks" | "recordings" = (() => {
    if (typeof window === "undefined") return "tasks";
    return window.location.pathname.replace(/\/$/, "") === "/recordings"
      ? "recordings"
      : "tasks";
  })();
  const [view, setView] = useState<"tasks" | "recordings">(initialView);

  // Pull `?fresh=<task_id>` from the URL — set by useCloudXRSession's
  // onSessionEnded auto-redirect after Quest exits VR. Used by
  // RecordingsView to highlight the matching row + start a targeted
  // poll until the .hdf5 surfaces in /api/recordings.json. Re-derived
  // when `view` flips so navigating away then back doesn't carry stale
  // ?fresh state from a previous session.
  const fresh = useMemo<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("fresh");
  }, [view]);

  // Sidebar tab clicks: update both `view` state and the browser URL so
  // the two stay coherent (refresh / share / back-button all work). When
  // switching INTO recordings, bump the refresh key so the list re-fetches
  // — gives the operator a fresh snapshot every time the tab is opened.
  const [recordingsRefreshKey, setRecordingsRefreshKey] = useState(0);
  const switchView = (next: "tasks" | "recordings") => {
    if (next === view) return;
    setView(next);
    setLocation(next === "recordings" ? "/recordings" : "/");
    if (next === "recordings") setRecordingsRefreshKey((k) => k + 1);
  };

  // Lifted recordings state — single fetch powers both the sidebar count
  // badge (`{count}`) and the recordings tab content. The actual poll-on-
  // ?fresh logic lives inside RecordingsView; this is just the baseline
  // snapshot. Re-fetched whenever `recordingsRefreshKey` bumps (sidebar
  // tab click into recordings, or the Refresh button inside the view).
  const [recordingsResp, setRecordingsResp] =
    useState<RecordingsResponse | null>(null);
  const [recordingsError, setRecordingsError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRecordings()
      .then((r) => {
        if (cancelled) return;
        setRecordingsResp(r);
        setRecordingsError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setRecordingsError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [recordingsRefreshKey]);
  const refreshRecordings = () =>
    setRecordingsRefreshKey((k) => k + 1);
  const recordingsCount = recordingsResp?.recordings.length ?? null;

  // (overlayRef declared above next to the useCloudXRSession call; it
  // backs the WebXR DOM Overlay layer that Quest 3 Browser composites
  // on top of the CloudXR-streamed scene during an active session.
  // Outer container always rendered; visible content is gated on
  // session.state so the operator only sees Start/Recenter/Stop while
  // a session is open.)

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
            <a
              className={`nav-item ${view === "tasks" ? "active" : ""}`}
              onClick={() => switchView("tasks")}
            >
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
            <a
              className={`nav-item ${view === "recordings" ? "active" : ""}`}
              onClick={() => switchView("recordings")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="M3 10h18"/>
              </svg>
              <span>Recordings</span>
              <span className="badge">
                {recordingsCount ?? "—"}
              </span>
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

              {view === "recordings" ? (
                <RecordingsView
                  resp={recordingsResp}
                  error={recordingsError}
                  fresh={fresh}
                  scenes={scenes}
                  onRefresh={refreshRecordings}
                />
              ) : (
              <>
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
                  onConnect={() => void session.connect(liveScene.id)}
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
                    onConnect={() => void session.connect(scene.id)}
                  />
                ))}
              </div>
              </>
              )}

              {/* FOOTER STRIP — NVIDIA brand marks (improvement #5, shared across views) */}
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

      {/* WebXR DOM Overlay — passed via xr.requestSession's `domOverlay`
          option (see useCloudXRSession.ts). Quest 3 Browser supports the
          dom-overlay feature: when granted, the compositor renders this
          element as a flat layer in 3D space on top of the CloudXR-
          streamed scene. Operator aims controller, ray hit-tests against
          the DOM, button clicks fire normal HTML click events.

          The `<div ref={overlayRef}>` MUST be present in DOM at
          requestSession time — keep it always rendered. Visible content
          is conditionally rendered based on session.state so the operator
          sees Start/Recenter/Stop buttons only during an active session.

          Outer container has `pointer-events: none` so it doesn't block
          mouse clicks in the dashboard's flat 2D mode; the inner card
          flips back to `pointer-events: auto`. In VR, pointer-events
          gating doesn't matter (the WebXR DOM Overlay raycaster always
          hits the layer), so this is purely a 2D-mode UX guard. */}
      <div
        ref={overlayRef}
        className={`xr-overlay ${
          session.state === "streaming" ||
          session.state === "connected" ||
          session.state === "connecting" ||
          session.state === "requesting-xr"
            ? "active"
            : "inactive"
        }`}
      >
        {/* Card is ALWAYS in DOM (not conditionally rendered). Quest 3
            Browser captures the domOverlay.root element's child layout
            at xr.requestSession() time; if empty at that moment, the
            compositor can register a null/empty layer and ignore late-
            mounted children. NVIDIA's IsaacTeleop bundle renders
            statically for the same reason. We toggle visibility via
            the .xr-overlay.inactive CSS class instead — DOM tree
            stable across the entire session lifecycle. Buttons are
            disabled when no session is active so taps before/after
            VR are no-ops. */}
        <div className="xr-overlay-card">
          <div className="xr-overlay-header">
            <span className="xr-overlay-title">
              SIM <span className="accent">XR.</span>
            </span>
            <span className="xr-overlay-scene">
              {liveScene?.name ?? "—"}
            </span>
          </div>
          <div className="xr-overlay-stats">
            <div className="stat">
              <span className="stat-label">Latency</span>
              <span
                className={`stat-value ${
                  !reachable || latency == null
                    ? ""
                    : latency > 500
                    ? "warn"
                    : latency > 200
                    ? "warn"
                    : "success"
                }`}
              >
                {reachable && latency != null ? `~${latency}ms` : "—"}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Session</span>
              <span className="stat-value">
                {session.health?.session_state ?? "—"}
              </span>
            </div>
          </div>
          <div className="xr-overlay-actions">
            <button
              type="button"
              className="xr-overlay-btn primary"
              onClick={() => session.sendTeleopCommand("start teleop")}
              disabled={
                session.state !== "streaming" &&
                session.state !== "connected"
              }
            >
              <span className="xr-overlay-btn-icon">▶</span>
              Start
            </button>
            <button
              type="button"
              className="xr-overlay-btn"
              onClick={() => session.sendTeleopCommand("reset teleop")}
              disabled={
                session.state !== "streaming" &&
                session.state !== "connected"
              }
            >
              <span className="xr-overlay-btn-icon">⟳</span>
              Recenter
            </button>
            <button
              type="button"
              className="xr-overlay-btn"
              onClick={() => session.sendTeleopCommand("stop teleop")}
              disabled={
                session.state !== "streaming" &&
                session.state !== "connected"
              }
            >
              <span className="xr-overlay-btn-icon">■</span>
              Stop
            </button>
          </div>
        </div>
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

// ─── RecordingsView — server-driven session history ─────────────────────
// Renders the Recordings tab inside the Dashboard chrome. Source: live
// `api.simxr.app/api/recordings.json` snapshot fetched at the Dashboard
// level (parent passes `resp` + `error` + `onRefresh` here). Targeted
// poll lives inside this component: when `?fresh=<task_id>` is set on the
// URL but the matching entry isn't yet in `resp`, we poll
// /api/recordings.json every POLL_INTERVAL_MS until the entry surfaces or
// MAX_POLLS attempts are exhausted. Driven by the post-VR redirect from
// useCloudXRSession's onSessionEnded callback.
//
// History note: this is the consolidated version. Pre-2026-05-08 there
// were two separate surfaces — a Dashboard sidebar tab (mock data +
// localStorage + synthetic episodes/quality/status) and a standalone
// /recordings page (real server data). The standalone page was deleted;
// /recordings now routes to Dashboard with view="recordings" preselected,
// and this component is the single source of truth.

interface RecordingsViewProps {
  /** Initial snapshot fetched at the Dashboard level. May be null on first paint. */
  resp: RecordingsResponse | null;
  /** Fetch error from Dashboard's loader, if any. */
  error: string | null;
  /** ?fresh=<task_id> param from URL — set by VR-exit auto-redirect. */
  fresh: string | null;
  /** Scene metadata for friendly names + robot family. */
  scenes: Scene[] | null;
  /** Bumps Dashboard's recordings refresh key — re-fetches the JSON. */
  onRefresh: () => void;
}

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 45;            // 45 × 4s = 3 min — covers Kit's hdf5 file
                                 // lock window (Kit holds the .hdf5 open while
                                 // record_demos.py is alive; h5py inspection
                                 // can't read demo groups until release, which
                                 // is after Kit shuts down OR uses SWMR mode)
type PollState = "idle" | "polling" | "finalizing" | "exhausted";

/**
 * "Finalized" = entry present in API response AND has the h5py-derived
 * demo metadata fields (num_demos + successful_demos). Both are populated
 * by the server-side recordings scanner's h5py inspect_hdf5() — but only
 * succeeds when Kit releases the .hdf5 file lock. While Kit holds the
 * file, the entry exists with file_size_bytes/recorded_at but the
 * demo-count fields are omitted (h5py.File raises OSError on the lock
 * and the scanner silently skips inspection for that file).
 */
function isEntryFinalized(rec: Recording): boolean {
  return rec.num_demos != null && rec.successful_demos != null;
}

function RecordingsView({
  resp,
  error,
  fresh,
  scenes,
  onRefresh,
}: RecordingsViewProps) {
  // Local snapshot mirror — starts from the parent's `resp` and updates
  // as the targeted poll receives newer responses (avoids racing parent
  // re-fetches against the targeted poll). Refreshes when parent's
  // baseline `resp` updates too.
  const [localResp, setLocalResp] = useState<RecordingsResponse | null>(resp);
  useEffect(() => {
    if (resp) setLocalResp(resp);
  }, [resp]);

  const [pollState, setPollState] = useState<PollState>("idle");
  const [pollAttempt, setPollAttempt] = useState(0);

  // Targeted poll for ?fresh — kicks off when parent's resp lands without
  // the entry, runs every POLL_INTERVAL_MS up to MAX_POLLS. Two phases:
  //
  //   1. "polling"     — entry not yet present. Banner: "Saving the
  //                       recording you just made…". Stops when entry
  //                       appears in /api/recordings.json (server's 30s
  //                       regen tick picks up the new .hdf5).
  //   2. "finalizing"  — entry IS present but missing num_demos /
  //                       successful_demos (h5py inspection couldn't
  //                       read the file because Kit still has the file
  //                       lock). Banner: "Finalizing demo count…".
  //                       Stops when either field appears OR maxAttempts.
  //
  // No manual Refresh tap needed across the whole flow — operator records
  // demo, exits via Meta button, lands on /recordings?fresh=, and watches
  // the card materialize then update with success-ratio without any
  // additional clicks. 3-min total polling window covers Kit's typical
  // file-lock duration (Kit holds the .hdf5 open until session next
  // disconnects OR record_demos.py exits).
  useEffect(() => {
    if (!fresh) {
      setPollState("idle");
      setPollAttempt(0);
      return;
    }
    if (!localResp) return;
    const matching = localResp.recordings.find((rec) =>
      shouldHighlightFresh(rec, fresh),
    );
    if (matching && isEntryFinalized(matching)) {
      // Entry present AND has demo metadata — fully done, stop polling.
      setPollState("idle");
      return;
    }

    // Either entry missing OR entry present-but-incomplete — start poll.
    setPollState(matching ? "finalizing" : "polling");
    setPollAttempt(0);
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (attempts >= MAX_POLLS) {
        setPollState("exhausted");
        return;
      }
      attempts += 1;
      setPollAttempt(attempts);
      try {
        const next = await fetchRecordings();
        if (cancelled) return;
        setLocalResp(next);
        const hit = next.recordings.find((rec) =>
          shouldHighlightFresh(rec, fresh),
        );
        if (hit) {
          if (isEntryFinalized(hit)) {
            // Got everything — stop.
            setPollState("idle");
            return;
          }
          // Entry visible but still being inspected server-side. Flip to
          // finalizing phase so the banner copy updates, but keep polling.
          setPollState("finalizing");
        }
      } catch {
        /* soft-fail; next tick may succeed */
      }
      timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };
    timer = window.setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
    // localResp intentionally read-but-not-tracked here — we re-evaluate
    // on parent baseline updates, not on every targeted-poll tick (that
    // would restart the poll on its own response).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, resp]);

  const recordings = localResp?.recordings ?? [];

  const sceneById = useMemo(() => {
    const m = new Map<string, Scene>();
    if (scenes) for (const s of scenes) m.set(s.id, s);
    return m;
  }, [scenes]);

  const lastUpdated = localResp?.ts
    ? new Date(localResp.ts).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : null;

  // Loading state — parent hasn't returned a resp yet AND no error. After
  // first response the list is sticky (we render last known data even if
  // the next refresh is in flight) for a calmer feel.
  const isLoading = localResp == null && !error;

  return (
    <>
      <div className="page-header">
        <div className="eyebrow">Demo · session history</div>
        <h1>Recordings.</h1>
      </div>

      {error && (
        <div className="error-banner">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FF4A5C"
            strokeWidth="1.8"
            style={{ flexShrink: 0, marginTop: 1 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <div className="label">Couldn't load recordings</div>
            <div className="text">
              {error}
              <br />
              <span style={{ opacity: 0.8 }}>
                Endpoint: api.simxr.app/api/recordings.json — the demo
                server may be offline. Tap Refresh in a moment.
              </span>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="recordings-loading">
          Fetching recordings<span className="dots" />
        </div>
      )}

      {!isLoading && (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="label">Recordings</div>
              <div className="value tabular">{recordings.length}</div>
              <div className="meta">
                newest first · server regen ~30s
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Total size</div>
              <div className="value small">
                {recordings.length ? fmtTotalSize(recordings) : "—"}
              </div>
              <div className="meta">across all .hdf5 files on disk</div>
            </div>
            <div className="stat-card">
              <div className="label">Latest</div>
              <div className="value small">
                {recordings[0]
                  ? fmtRecordedAt(recordings[0].recorded_at).primary
                  : "—"}
              </div>
              <div className="meta">
                {recordings[0]
                  ? fmtRecordedAt(recordings[0].recorded_at).secondary
                  : ""}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Last sync</div>
              <div className="value small">{lastUpdated ?? "—"}</div>
              <div className="meta">tap Refresh below to re-pull</div>
            </div>
          </div>

          <div className="catalog-header">
            <div>
              <h2>History</h2>
              <div className="count" style={{ marginTop: 4 }}>
                {recordings.length} recording
                {recordings.length === 1 ? "" : "s"} · sorted by{" "}
                <code>recorded_at</code> desc
              </div>
            </div>
            <button
              type="button"
              className="recordings-refresh-btn"
              onClick={onRefresh}
              title="Re-fetch /api/recordings.json"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh
            </button>
          </div>

          {pollState === "polling" && (
            <div className="recordings-poll-banner">
              <span className="dot" />
              Saving the recording you just made…
              <span className="poll-hint">
                .hdf5 lands within ~30s of teleop disconnect · attempt{" "}
                {pollAttempt}/{MAX_POLLS}
              </span>
            </div>
          )}
          {pollState === "finalizing" && (
            <div className="recordings-poll-banner">
              <span className="dot" />
              Finalizing demo count… (waiting for Kit to release file lock)
              <span className="poll-hint">
                card visible above · success ratio appears once h5py reads
                the .hdf5 · attempt {pollAttempt}/{MAX_POLLS}
              </span>
            </div>
          )}
          {pollState === "exhausted" && (
            <div className="recordings-poll-banner exhausted">
              <span className="dot warn" />
              Demo count didn't finalize within{" "}
              {Math.round((POLL_INTERVAL_MS * MAX_POLLS) / 1000)}s. Kit
              may still be holding the .hdf5 file lock — count will
              appear once Kit shuts down or the next demo lands.
              <span className="poll-hint">Try Refresh in a moment.</span>
            </div>
          )}

          {recordings.length === 0 && pollState === "idle" && (
            <div className="recordings-empty">
              <span className="title">No recordings yet.</span>
              Connect to a scene from Tasks and record a demo. The list
              updates within ~30 seconds of the .hdf5 landing on the
              server.
            </div>
          )}

          {/* Find the index of the FIRST entry matching the ?fresh= task_id.
              Recordings are sorted desc by recorded_at, so this is the newest
              one — the one the operator just made. Highlight that row only,
              and only while the polling state machine is still active
              (polling/finalizing). Once finalized (pollState=idle) the
              highlight drops cleanly. Avoids two failure modes: highlighting
              ALL old recordings of the same task, AND fading the highlight
              mid-finalization (Kit can hold .hdf5 lock past the old 60s
              hardcoded window). */}
          <div className="rec-list">
            {(() => {
              const freshIdx =
                pollState === "polling" || pollState === "finalizing"
                  ? recordings.findIndex((r) =>
                      shouldHighlightFresh(r, fresh),
                    )
                  : -1;
              return recordings.map((r, i) => {
              const isFresh = i === freshIdx;
              const scene = sceneById.get(r.task_id);
              const asset = SCENE_ASSETS[r.task_id];
              const date = fmtRecordedAt(r.recorded_at);
              return (
                <div
                  key={r.id}
                  className={`rec-row ${isFresh ? "fresh" : ""}`}
                >
                  <div className="rec-thumb">
                    {asset?.type === "video" ? (
                      <video
                        src={asset.src}
                        poster={asset.poster}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : asset?.type === "image" ? (
                      <img src={asset.src} alt="" />
                    ) : (
                      <div className="rec-thumb-fallback">.hdf5</div>
                    )}
                  </div>
                  <div className="rec-meta">
                    <h3 className="scene">{scene?.name ?? r.task_id}</h3>
                    <div className="sub">
                      <span>{robotLabel(r.task_id)}</span>
                      <span className="pipe">·</span>
                      <span>{skillTag(r.task_id)}</span>
                    </div>
                    <div className="when">
                      {date.primary}{" "}
                      <span style={{ opacity: 0.6 }}>
                        · {date.secondary}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 10,
                        color: "var(--text-dim)",
                        marginTop: 4,
                        wordBreak: "break-all",
                      }}
                      title={r.file_name}
                    >
                      {r.file_name}
                    </div>
                  </div>
                  <div className="rec-stats">
                    <div className="rec-stats-meta">
                      <div>
                        <span className="v">{fmtSize(r.file_size_bytes)}</span>
                        <span className="label">size</span>
                      </div>
                      {typeof r.duration_seconds === "number" && (
                        <div>
                          <span className="v">
                            {fmtDuration(r.duration_seconds)}
                          </span>
                          <span className="label">duration</span>
                        </div>
                      )}
                    </div>
                    {typeof r.num_demos === "number" && r.num_demos > 0 && (
                      <div
                        className={`rec-stats-hero ${
                          typeof r.successful_demos !== "number"
                            ? "count-only"
                            : r.successful_demos === r.num_demos
                            ? "all-success"
                            : r.successful_demos > 0
                            ? "partial-success"
                            : "no-success"
                        }`}
                        title={
                          typeof r.successful_demos === "number"
                            ? `${r.successful_demos} of ${r.num_demos} recorded demonstration${r.num_demos === 1 ? "" : "s"} reached the success state`
                            : `${r.num_demos} recorded demonstration${r.num_demos === 1 ? "" : "s"}`
                        }
                      >
                        <span className="hero-number">
                          {typeof r.successful_demos === "number"
                            ? `${r.successful_demos}/${r.num_demos}`
                            : r.num_demos}
                        </span>
                        <span className="hero-label">
                          {typeof r.successful_demos === "number"
                            ? r.num_demos === 1
                              ? "successful demo"
                              : "successful demos"
                            : `demo${r.num_demos === 1 ? "" : "s"} recorded`}
                        </span>
                      </div>
                    )}
                  </div>
                  {isFresh && (
                    <span className="badge-fresh">
                      <span className="dot" />
                      Just recorded
                    </span>
                  )}
                </div>
              );
            });
            })()}
          </div>
        </>
      )}
    </>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
