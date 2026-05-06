// SIM XR — Recordings page.
//
// Mounted at /recordings on simxr.app. Shipped 2026-05-06 to close the
// "connect → record one demo → exit → see what I just recorded" loop on the
// patched 3DGS NuRec stack. Spec: Sim XR/03_ops_setup/cowork_brief_recordings_page_2026-05-06.md
//
// Renders newest-first list from GET https://api.simxr.app/api/recordings.json
// (CC's systemd-timer-driven .json regen on the server). Lightweight chrome —
// no sidebar; reuses Dashboard.css visual lexicon (ink / volt / mono).
//
// Highlight contract: ?fresh=<task_id> on the URL → render top match with
// "Just recorded" badge if recorded_at is within the last 60 seconds. Set
// by the auto-redirect from useCloudXRSession's onSessionEnded callback.
//
// Refresh strategy: manual button only. No auto-poll — visitor lands here
// from VR end, sees their demo within ~30s of CC's regen cycle. Auto-poll
// would just burn battery on the headset; manual refresh is a single tap.
//
// Download: download_path is declared by the server but apache doesn't
// serve /api/recordings/... yet. UI shows the path for now; CC will flip
// the apache alias when we want a clickable Download button.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  fetchRecordings,
  shouldHighlightFresh,
  type Recording,
  type RecordingsResponse,
} from "@/lib/recordings";
import { fetchScenes, type Scene } from "@/lib/scenes";
import {
  SCENE_ASSETS,
  robotLabel,
  skillTag,
} from "@/lib/scene_assets";
import "./Dashboard.css";
import "./Recordings.css";

// ─── Formatting helpers ─────────────────────────────────────────────────

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

  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
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
  const total = recordings.reduce((sum, r) => sum + (r.file_size_bytes ?? 0), 0);
  return fmtSize(total);
}

// ─── Page ───────────────────────────────────────────────────────────────

type LoadState = "loading" | "loaded" | "error" | "empty";
type PollState = "idle" | "polling" | "exhausted";

// How often we re-fetch /api/recordings.json while waiting for the just-recorded
// entry to surface, and how many tries before we stop. The server-side regen
// runs every ~30s, so 4s × 15 = 60s ceiling covers two regen ticks plus slack.
const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 15;

export default function Recordings() {
  const [resp, setResp] = useState<RecordingsResponse | null>(null);
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Tracks the targeted-poll lifecycle. Goes "idle" → "polling" once the
  // initial fetch lands without the fresh entry → "idle" when entry appears
  // OR "exhausted" if MAX_POLLS attempts pass without it. Drives the
  // "Waiting for your new recording…" / "Couldn't see it yet" banners.
  const [pollState, setPollState] = useState<PollState>("idle");
  // Mirrors the polling attempt count for the banner ("attempt N / 15"),
  // updated as polls fire. Kept as state (not ref) so the banner re-renders.
  const [pollAttempt, setPollAttempt] = useState(0);

  // Pull `fresh=<task_id>` from the URL — set by useCloudXRSession's
  // onSessionEnded auto-redirect. wouter doesn't expose useSearch in 2.x;
  // direct window.location.search is simpler and equivalent here.
  const fresh = useMemo<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("fresh");
  }, [refreshKey]);

  // Combined fetch + targeted-poll. The flow:
  //   1. Mark loading, fire initial fetch.
  //   2. On success, render the list.
  //   3. If `?fresh=<task_id>` is set AND the matching entry isn't yet in
  //      the response, start polling /api/recordings.json every
  //      POLL_INTERVAL_MS until either:
  //        a. the entry shows up — switch to "idle", surface naturally
  //           (CSS animation on `.rec-row.fresh` plays once on mount and
  //           the row slides in from above with a volt halo).
  //        b. MAX_POLLS attempts pass — switch to "exhausted", surface
  //           a softer banner pointing at Refresh / server-side teleop.
  //   The poll lives inside this effect so cancellation (unmount, refresh
  //   click, fresh-param change) cleans up via the single `cancelled` flag.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let attempts = 0;

    setState("loading");
    setError(null);
    setPollState("idle");
    setPollAttempt(0);

    const scheduleNext = () => {
      if (cancelled) return;
      if (attempts >= MAX_POLLS) {
        setPollState("exhausted");
        return;
      }
      pollTimer = window.setTimeout(async () => {
        if (cancelled) return;
        attempts += 1;
        setPollAttempt(attempts);
        try {
          const next = await fetchRecordings();
          if (cancelled) return;
          setResp(next);
          // Match arrived — done.
          if (
            fresh &&
            next.recordings.some((rec) => shouldHighlightFresh(rec, fresh))
          ) {
            setPollState("idle");
            return;
          }
        } catch {
          // Soft-fail — keep polling, the next tick may succeed.
        }
        scheduleNext();
      }, POLL_INTERVAL_MS);
    };

    Promise.all([fetchRecordings(), fetchScenes().catch(() => null)])
      .then(([r, s]) => {
        if (cancelled) return;
        setResp(r);
        setScenes(s);
        setState(r.recordings.length === 0 ? "empty" : "loaded");

        // Initial fetch already has the fresh entry → no poll needed.
        if (
          fresh &&
          !r.recordings.some((rec) => shouldHighlightFresh(rec, fresh))
        ) {
          setPollState("polling");
          scheduleNext();
        }
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setState("error");
      });

    return () => {
      cancelled = true;
      if (pollTimer != null) window.clearTimeout(pollTimer);
    };
  }, [refreshKey, fresh]);

  const recordings = resp?.recordings ?? [];

  const sceneById = useMemo(() => {
    const m = new Map<string, Scene>();
    if (scenes) for (const s of scenes) m.set(s.id, s);
    return m;
  }, [scenes]);

  const onRefresh = () => setRefreshKey((k) => k + 1);

  const lastUpdated = resp?.ts
    ? new Date(resp.ts).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <div className="dashboard-root">
      <Fonts />
      <main className="main" style={{ marginLeft: 0 }}>
        <div className="topbar">
          <div>
            <span
              className="wordmark-side"
              style={{ fontSize: "1.15rem" }}
            >
              SIM <span className="accent">XR.</span>
            </span>
            <span
              className="wordmark-section"
              style={{
                marginLeft: 12,
                paddingLeft: 12,
                borderLeft: "1px solid var(--stroke)",
              }}
            >
              Recordings
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastUpdated && (
              <span
                className="h-pill"
                title="Server-side regen cycle runs every ~30s"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 14" />
                </svg>
                Updated{" "}
                <span className="accent-volt">{lastUpdated}</span>
              </span>
            )}
            <button
              className="recordings-back-btn"
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
            <Link to="/connect" className="recordings-back-btn">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Dashboard
            </Link>
          </div>
        </div>

        <div
          className="grid-dark"
          style={{ minHeight: "calc(100vh - 60px)" }}
        >
          <div className="wrap">
            <div className="page-header">
              <div className="eyebrow">Demo · session history</div>
              <h1>Recordings.</h1>
            </div>

            {state === "loading" && (
              <div className="recordings-loading">
                Fetching recordings<span className="dots" />
              </div>
            )}

            {state === "error" && (
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
                      server may be offline. Try the Refresh button.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {state === "empty" && (
              <div className="recordings-empty">
                <span className="title">No recordings yet.</span>
                Connect to a scene from the{" "}
                <Link to="/connect" className="accent-volt">
                  Dashboard
                </Link>{" "}
                and record a demo. The list updates within ~30 seconds of the
                .hdf5 landing on the server.
              </div>
            )}

            {state === "loaded" && (
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
                      {fmtTotalSize(recordings)}
                    </div>
                    <div className="meta">
                      across all .hdf5 files on disk
                    </div>
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
                        ? fmtRecordedAt(recordings[0].recorded_at)
                            .secondary
                        : ""}
                    </div>
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
                </div>

                {pollState === "polling" && (
                  <div className="recordings-poll-banner">
                    <span className="dot" />
                    Waiting for the recording you just made…
                    <span className="poll-hint">
                      checks every {POLL_INTERVAL_MS / 1000}s · auto-stops at
                      ~{Math.round((POLL_INTERVAL_MS * MAX_POLLS) / 1000)}s
                      {pollAttempt > 0 ? ` · attempt ${pollAttempt}/${MAX_POLLS}` : ""}
                    </span>
                  </div>
                )}
                {pollState === "exhausted" && (
                  <div className="recordings-poll-banner exhausted">
                    <span className="dot warn" />
                    The recording hasn't surfaced yet. The server-side teleop
                    may still be running — once it's stopped the .hdf5
                    finalizes and the next regen tick (~30s) will pick it up.
                    <span className="poll-hint">Try Refresh in a moment.</span>
                  </div>
                )}

                <div className="rec-list">
                  {recordings.map((r) => {
                    const isFresh = shouldHighlightFresh(r, fresh);
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
                          <h3 className="scene">
                            {scene?.name ?? r.task_id}
                          </h3>
                          <div className="sub">
                            <span>{robotLabel(r.task_id)}</span>
                            <span className="pipe">·</span>
                            <span>{skillTag(r.task_id)}</span>
                          </div>
                          <div
                            className="when"
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                            }}
                          >
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
                          <div>
                            <span className="v">
                              {fmtSize(r.file_size_bytes)}
                            </span>
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
                          {typeof r.num_demos === "number" && (
                            <div>
                              <span className="v">{r.num_demos}</span>
                              <span className="label">
                                demo{r.num_demos === 1 ? "" : "s"}
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
                  })}
                </div>
              </>
            )}

            <div className="footer-strip">
              <span className="footer-mark">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#76B900"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="nv-wordmark">NVIDIA</span> Inception Member
              </span>
              <span className="pipe">·</span>
              <span className="footer-mark">
                Powered by{" "}
                <span className="nv-wordmark">NVIDIA</span> CloudXR
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Fonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"
      />
      <meta name="robots" content="noindex, nofollow" />
    </>
  );
}
