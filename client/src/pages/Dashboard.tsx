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
import "./Dashboard.css";

// SCENE_ASSETS + SceneAsset + robotLabel + skillTag now live in
// @/lib/scene_assets so /recordings (separate lazy chunk) can reuse the
// same id → media mapping without forcing the Dashboard chunk to load.

// Robot tag derived from scene id — used by filter chips and card tags.
function robotTag(id: string): "GR1T2" | "G1" | "other" {
  if (id.includes("GR1T2")) return "GR1T2";
  if (id.includes("-G1-")) return "G1";
  return "other";
}

// ─── Recordings (sidebar section #2) ─────────────────────────────────────
// Prototype with mock data — there's no real session-history backend yet.
// Schema below matches what a real backend would shape (id / startedAt /
// durationSec / sceneId / episodes / qualityScore / status). When backend
// lands we just swap MOCK_RECORDINGS for a fetch.
type RecordingStatus = "approved" | "pending" | "flagged";
interface Recording {
  id: string;
  startedAt: string; // ISO 8601
  durationSec: number;
  sceneId: string;
  episodes: number;
  qualityScore: number; // 0-100
  status: RecordingStatus;
}

// Real recordings are persisted to localStorage after every successful
// Quest connect. Schema below is shared with mock data — storage just adds
// a versioned wrapper so we can migrate cleanly later. Only shown if a
// real entry exists; otherwise the mock fallback below renders so the page
// isn't empty for first-time visitors.
const RECORDINGS_STORAGE_KEY = "sim-xr-recordings-v1";
const RECORDINGS_MAX = 100; // cap to prevent localStorage bloat

function loadRealRecordings(): Recording[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECORDINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive — ensure each entry has the required fields.
    return parsed.filter((r): r is Recording =>
      r && typeof r === "object" &&
      typeof r.id === "string" &&
      typeof r.startedAt === "string" &&
      typeof r.durationSec === "number" &&
      typeof r.sceneId === "string"
    );
  } catch {
    return [];
  }
}

function saveRealRecording(entry: Recording): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadRealRecordings();
    list.unshift(entry); // newest first
    if (list.length > RECORDINGS_MAX) list.length = RECORDINGS_MAX;
    window.localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* localStorage might be blocked / quota — silently skip */
  }
}

// Plausible synthesis for fields we don't actually track yet (episodes,
// quality, status). Real timestamps + scene + duration come from the live
// hook. Synthesis goes away as backend wires real values in — schema stays.

function synthesizeEpisodes(durationSec: number): number {
  // ~1 episode per 90 sec real-operator pace, with small jitter, capped.
  const base = Math.max(0, Math.floor(durationSec / 90));
  const jitter = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
  return Math.max(0, Math.min(15, base + jitter));
}

function synthesizeQuality(): number {
  // Plausible 85-97 range, leaning toward higher (operator-friendly).
  return Math.round((85 + Math.random() * 12) * 10) / 10;
}

function synthesizeStatus(
  durationSec: number,
  hadError: boolean,
): RecordingStatus {
  if (hadError) return "flagged";
  if (durationSec < 30) return "flagged"; // too-short sessions read as bad takes
  const r = Math.random();
  if (r < 0.8) return "approved";
  if (r < 0.95) return "pending";
  return "flagged";
}

// Mock data is generated relative to "now" so the "Today / Yesterday / N days
// ago" formatting always feels fresh in the prototype. Spread covers the
// last ~10 days, varied scenes, mostly approved with a few pending/flagged.
// Shown only when no real recordings exist yet (replaced as Mike connects).
function buildMockRecordings(): Recording[] {
  const now = Date.now();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  return [
    { id: "r-12", startedAt: new Date(now - 35 * min).toISOString(), durationSec: 754, sceneId: "Isaac-PickPlace-Locomanipulation-G1-Abs-v0", episodes: 5, qualityScore: 96.2, status: "approved" },
    { id: "r-11", startedAt: new Date(now - 3.2 * hour).toISOString(), durationSec: 542, sceneId: "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0", episodes: 4, qualityScore: 94.8, status: "approved" },
    { id: "r-10", startedAt: new Date(now - 6 * hour).toISOString(), durationSec: 218, sceneId: "Isaac-ExhaustPipe-GR1T2-Pink-IK-Abs-v0", episodes: 1, qualityScore: 71.3, status: "flagged" },
    { id: "r-9", startedAt: new Date(now - 1 * day - 2 * hour).toISOString(), durationSec: 1102, sceneId: "Isaac-PickPlace-GR1T2-Abs-v0", episodes: 8, qualityScore: 98.1, status: "approved" },
    { id: "r-8", startedAt: new Date(now - 1 * day - 5 * hour).toISOString(), durationSec: 487, sceneId: "Isaac-PickPlace-G1-InspireFTP-Abs-v0", episodes: 3, qualityScore: 89.4, status: "pending" },
    { id: "r-7", startedAt: new Date(now - 2 * day).toISOString(), durationSec: 920, sceneId: "Isaac-PickPlace-Locomanipulation-G1-Abs-v0", episodes: 6, qualityScore: 95.5, status: "approved" },
    { id: "r-6", startedAt: new Date(now - 3 * day - 1 * hour).toISOString(), durationSec: 670, sceneId: "Isaac-PickPlace-GR1T2-WaistEnabled-Abs-v0", episodes: 4, qualityScore: 92.0, status: "approved" },
    { id: "r-5", startedAt: new Date(now - 4 * day).toISOString(), durationSec: 312, sceneId: "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0", episodes: 2, qualityScore: 88.7, status: "pending" },
    { id: "r-4", startedAt: new Date(now - 5 * day - 4 * hour).toISOString(), durationSec: 845, sceneId: "Isaac-ExhaustPipe-GR1T2-Pink-IK-Abs-v0", episodes: 5, qualityScore: 93.6, status: "approved" },
    { id: "r-3", startedAt: new Date(now - 6 * day).toISOString(), durationSec: 1240, sceneId: "Isaac-PickPlace-GR1T2-Abs-v0", episodes: 9, qualityScore: 97.0, status: "approved" },
    { id: "r-2", startedAt: new Date(now - 8 * day).toISOString(), durationSec: 401, sceneId: "Isaac-PickPlace-FixedBaseUpperBodyIK-G1-Abs-v0", episodes: 2, qualityScore: 84.1, status: "approved" },
    { id: "r-1", startedAt: new Date(now - 11 * day).toISOString(), durationSec: 1480, sceneId: "Isaac-NutPour-GR1T2-Pink-IK-Abs-v0", episodes: 11, qualityScore: 95.9, status: "approved" },
  ];
}

// Format helpers for recording rows.
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtRecordingDate(iso: string): { primary: string; secondary: string } {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  let primary: string;
  if (sameDay) primary = `Today · ${time}`;
  else if (isYesterday) primary = `Yesterday · ${time}`;
  else {
    const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    primary = `${md} · ${time}`;
  }
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  let secondary: string;
  if (diffMin < 60) secondary = `${diffMin} min ago`;
  else if (diffMin < 1440) secondary = `${Math.floor(diffMin / 60)} h ago`;
  else secondary = `${Math.floor(diffMin / 1440)} days ago`;
  return { primary, secondary };
}

function fmtTotalTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
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
  // After the CloudXR stream stops (Quest exit gesture, server-side stop, or
  // crash mid-recording), redirect the operator to /recordings with the
  // just-recorded scene highlighted. The hook ends the WebXR session and
  // cleans up before this fires, so navigation can proceed without racing.
  // taskId comes from the corresponding session.connect(scene.id) call.
  const session = useCloudXRSession({
    onSessionEnded: (taskId) => {
      const target = taskId
        ? `/recordings?fresh=${encodeURIComponent(taskId)}`
        : "/recordings";
      setLocation(target);
    },
  });
  const { latency, reachable, history: latencyHistory } = useLatencyPing(5000);
  const datetime = useLiveClock();
  const { theme, toggle } = useTheme();

  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [scenesError, setScenesError] = useState<string | null>(null);

  // Filter chips state — pure client-side, applied to the catalog only.
  const [robotFilter, setRobotFilter] = useState<"all" | "GR1T2" | "G1">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "broken">("all");

  // Sidebar view switcher. Tasks (catalog + connect) is the live page;
  // Recordings is the prototype session-history view (real entries from
  // localStorage + mock fallback for first-time visitors). Other sidebar
  // items remain disabled until backend lands.
  const [view, setView] = useState<"tasks" | "recordings">("tasks");

  // Real recordings persist in localStorage; refreshed whenever a session
  // ends. Mock entries stay below as "previous demo data" — real connections
  // append on top, mocks remain as historical context.
  const [realRecordings, setRealRecordings] = useState<Recording[]>(() =>
    loadRealRecordings(),
  );
  const mockRecordings = useMemo(() => buildMockRecordings(), []);
  // Real entries (newest first via unshift in saveRealRecording) → mocks
  // (already sorted newest first in buildMockRecordings). No re-sort —
  // we WANT mocks always at the bottom regardless of relative timestamps.
  const recordings = useMemo(
    () => [...realRecordings, ...mockRecordings],
    [realRecordings, mockRecordings],
  );

  // Capture-on-disconnect: when the live session transitions out of an
  // active state (connected or streaming) into idle/error, save a Recording
  // with REAL startedAt + sceneId + duration + plausible synth for
  // episodes / quality / status. The synth goes away as the backend wires
  // real values in — schema stays the same.
  const sessionStartRef = useRef<{ startedAt: number; sceneId: string | null } | null>(null);
  useEffect(() => {
    const isActive = session.state === "connected" || session.state === "streaming";
    const isEnded = session.state === "idle" || session.state === "error";

    if (isActive && !sessionStartRef.current) {
      // Capture start at the moment we first reach connected/streaming.
      sessionStartRef.current = {
        startedAt: Date.now(),
        sceneId: session.health?.live_scene ?? null,
      };
      return;
    }

    if (isEnded && sessionStartRef.current) {
      const ref = sessionStartRef.current;
      sessionStartRef.current = null;
      const endedAt = Date.now();
      const durationSec = Math.max(1, Math.round((endedAt - ref.startedAt) / 1000));
      const hadError = session.state === "error";
      const entry: Recording = {
        id: `r-${endedAt}`,
        startedAt: new Date(ref.startedAt).toISOString(),
        durationSec,
        sceneId: ref.sceneId ?? "unknown",
        episodes: synthesizeEpisodes(durationSec),
        qualityScore: synthesizeQuality(),
        status: synthesizeStatus(durationSec, hadError),
      };
      saveRealRecording(entry);
      setRealRecordings((prev) => [entry, ...prev].slice(0, RECORDINGS_MAX));
    }
  }, [session.state, session.health]);

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
              onClick={() => setView("tasks")}
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
              onClick={() => setView("recordings")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="M3 10h18"/>
              </svg>
              <span>Recordings</span>
              <span className="badge">{recordings.length}</span>
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
                <RecordingsView recordings={recordings} scenes={scenes} />
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

// ─── RecordingsView — sidebar section #2 ────────────────────────────────
// Prototype with mock data: dense list of past sessions with thumbnail
// (reusing SCENE_ASSETS), date+relative ago, scene name + robot, duration,
// episodes recorded, quality score, status badge. Stats summary + filter
// chips on top mirror the Tasks-view chrome so the two pages feel coherent.
interface RecordingsViewProps {
  recordings: Recording[];
  scenes: Scene[] | null;
}

function RecordingsView({ recordings, scenes }: RecordingsViewProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | RecordingStatus>("all");
  const [rangeFilter, setRangeFilter] = useState<"7d" | "30d" | "all">("30d");

  // Lookup map: scene id → Scene (for friendly name + robot family).
  const sceneById = useMemo(() => {
    const m = new Map<string, Scene>();
    if (scenes) for (const s of scenes) m.set(s.id, s);
    return m;
  }, [scenes]);

  // Apply filters.
  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      rangeFilter === "7d" ? 7 * 24 * 3600 * 1000 :
      rangeFilter === "30d" ? 30 * 24 * 3600 * 1000 :
      Number.POSITIVE_INFINITY;
    return recordings.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (now - new Date(r.startedAt).getTime() > cutoffMs) return false;
      return true;
    });
  }, [recordings, statusFilter, rangeFilter]);

  // Aggregate stats over filtered set.
  const stats = useMemo(() => {
    const total = filtered.length;
    const totalEpisodes = filtered.reduce((sum, r) => sum + r.episodes, 0);
    const totalSec = filtered.reduce((sum, r) => sum + r.durationSec, 0);
    const approved = filtered.filter((r) => r.status === "approved");
    const avgQuality = approved.length
      ? approved.reduce((sum, r) => sum + r.qualityScore, 0) / approved.length
      : 0;
    const pending = filtered.filter((r) => r.status === "pending").length;
    const flagged = filtered.filter((r) => r.status === "flagged").length;
    return { total, totalEpisodes, totalSec, avgQuality, approved: approved.length, pending, flagged };
  }, [filtered]);

  return (
    <>
      <div className="page-header">
        <div className="eyebrow">Demo · session history</div>
        <h1>Sessions you've recorded.</h1>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="label">Sessions</div>
          <div className="value tabular">{stats.total}</div>
          <div className="meta">
            <span style={{ color: "var(--success)" }}>{stats.approved} approved</span>
            {stats.pending > 0 && <> · <span style={{ color: "var(--warn)" }}>{stats.pending} pending</span></>}
            {stats.flagged > 0 && <> · <span style={{ color: "var(--danger)" }}>{stats.flagged} flagged</span></>}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Episodes recorded</div>
          <div className="value tabular">{stats.totalEpisodes}</div>
          <div className="meta">avg {stats.total ? (stats.totalEpisodes / stats.total).toFixed(1) : "—"} per session</div>
        </div>
        <div className="stat-card">
          <div className="label">Time recorded</div>
          <div className="value small">{stats.totalSec ? fmtTotalTime(stats.totalSec) : "—"}</div>
          <div className="meta">avg {stats.total ? fmtDuration(Math.round(stats.totalSec / stats.total)) : "—"} per session</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg quality</div>
          <div className="value tabular">{stats.avgQuality ? stats.avgQuality.toFixed(1) : "—"}</div>
          <div className="meta">over approved sessions only</div>
        </div>
      </div>

      <div className="catalog-header">
        <div>
          <h2>History</h2>
          <div className="count" style={{ marginTop: 4 }}>
            {filtered.length} session{filtered.length === 1 ? "" : "s"} · most recent first
          </div>
        </div>
      </div>

      <div className="chips">
        <span className="label">Range</span>
        {(["7d", "30d", "all"] as const).map((r) => (
          <button
            key={r}
            className={`chip ${rangeFilter === r ? "active" : ""}`}
            onClick={() => setRangeFilter(r)}
          >
            {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "All time"}
          </button>
        ))}
        <span className="sep" />
        <span className="label">Status</span>
        {(["all", "approved", "pending", "flagged"] as const).map((s) => (
          <button
            key={s}
            className={`chip ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "All" : s === "approved" ? "Approved" : s === "pending" ? "Pending" : "Flagged"}
          </button>
        ))}
      </div>

      <div className="rec-list">
        {filtered.map((r) => {
          const scene = sceneById.get(r.sceneId);
          const asset = SCENE_ASSETS[r.sceneId];
          const date = fmtRecordingDate(r.startedAt);
          return (
            <div key={r.id} className="rec-row">
              <div className="rec-thumb">
                {asset?.type === "video" ? (
                  <video src={asset.src} muted playsInline preload="metadata" />
                ) : asset?.type === "image" ? (
                  <img src={asset.src} alt="" />
                ) : null}
              </div>
              <div className="rec-meta">
                <h3 className="scene">{scene?.name ?? r.sceneId}</h3>
                <div className="sub">
                  <span>{robotLabel(r.sceneId)}</span>
                  <span className="pipe">·</span>
                  <span>{skillTag(r.sceneId)}</span>
                </div>
                <div className="when">
                  {date.primary} <span style={{ opacity: 0.6 }}>· {date.secondary}</span>
                </div>
              </div>
              <div className="rec-stats">
                <div>
                  <span className="v">{fmtDuration(r.durationSec)}</span>
                  <span className="label">duration</span>
                </div>
                <div>
                  <span className="v">{r.episodes}</span>
                  <span className="label">episodes</span>
                </div>
                <div>
                  <span className="v">{r.qualityScore.toFixed(1)}</span>
                  <span className="label">quality</span>
                </div>
              </div>
              <span className={`rec-status ${r.status}`}>
                <span className="dot" />
                {r.status.toUpperCase()}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-dim)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
            No sessions match the current filters.
          </div>
        )}
      </div>
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
