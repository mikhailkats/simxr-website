// SIM XR operator MVP (2026-10-04) — the pieces of simxr.app an operator
// actually needs: one card per fleet server (ready / in use / starting /
// offline), the result of the session they just finished, and how to record
// a demo. Rendered by pages/Dashboard.tsx; styles in Dashboard.css
// ("Operator MVP" section).

import { useEffect, useMemo, useState } from "react";
import type { Scene } from "@/lib/scenes";
import type { ServerSnapshot, SimxrServer } from "@/lib/servers";
import { SERVERS } from "@/lib/servers";
import type { LiveStatus, UiSessionState } from "@/lib/useCloudXRSession";
import type { DeviceInfo } from "@/lib/device";
import { SCENE_ASSETS } from "@/lib/scene_assets";

// ─── Server slots ─────────────────────────────────────────────────────────

type SlotState = "ready" | "busy" | "starting" | "idle" | "offline";

function slotState(snap: ServerSnapshot | undefined): SlotState {
  const h = snap?.health;
  if (!h) return "offline";
  if (h.scene_state === "starting" || h.scene_state === "stalled") return "starting";
  if (!h.live_scene) return "idle";
  if (h.scene_state === "busy" || (h.session_state === "streaming" && h.active_clients > 0)) return "busy";
  return "ready";
}

function minutesSince(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 60_000));
}

function useNow(periodMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), periodMs);
    return () => window.clearInterval(id);
  }, [periodMs]);
  return now;
}

interface ServerSlotsProps {
  snapshots: ServerSnapshot[] | null;
  sceneFor: (server: SimxrServer, sceneId: string | null | undefined) => Scene | null;
  device: DeviceInfo;
  sessionState: UiSessionState;
  sessionInFlight: boolean;
  activeServerId: string | null;
  onConnect: (scene: Scene, server: SimxrServer) => void;
}

export function ServerSlots({
  snapshots,
  sceneFor,
  device,
  sessionState,
  sessionInFlight,
  activeServerId,
  onConnect,
}: ServerSlotsProps) {
  const now = useNow(30_000);
  const snapsById = useMemo(() => {
    const m = new Map<string, ServerSnapshot>();
    for (const s of snapshots ?? []) m.set(s.server.id, s);
    return m;
  }, [snapshots]);

  // "Recommended" = the reachable server with the lowest round-trip from this
  // browser. A rough proxy for the stream latency (media goes to the same box).
  const recommendedId = useMemo(() => {
    let best: { id: string; ms: number } | null = null;
    for (const s of snapshots ?? []) {
      const st = slotState(s);
      if (st === "offline" || s.latencyMs == null) continue;
      if (!best || s.latencyMs < best.ms) best = { id: s.server.id, ms: s.latencyMs };
    }
    return best?.id ?? null;
  }, [snapshots]);

  const canJoin = device.supported !== false;

  return (
    <div className="op-slots">
      {SERVERS.map((server) => {
        const snap = snapsById.get(server.id);
        const st = snapshots == null ? null : slotState(snap);
        const h = snap?.health ?? null;
        const sceneId = h?.live_scene ?? h?.starting_scene ?? null;
        const scene = sceneFor(server, sceneId);
        const asset = sceneId ? SCENE_ASSETS[sceneId] : undefined;
        const busyMin = minutesSince(h?.session_started_at, now);
        const mine = activeServerId === server.id && sessionInFlight;

        let statusText = "Checking…";
        let statusCls = "checking";
        if (st === "ready") {
          statusText = "Ready — free to join";
          statusCls = "ready";
        } else if (st === "busy") {
          statusText = mine
            ? "You are connected"
            : `In use by another operator${busyMin != null ? ` · ${busyMin} min` : ""}`;
          statusCls = "busy";
        } else if (st === "starting") {
          statusText = "Starting up — about 1–3 minutes";
          statusCls = "starting";
        } else if (st === "idle") {
          statusText = "Online, no scene running";
          statusCls = "idle";
        } else if (st === "offline") {
          statusText = "Offline";
          statusCls = "offline";
        }

        const button = (() => {
          if (st !== "ready" && !mine) {
            return (
              <button className="btn-disabled" disabled>
                {st === "busy" ? "In use" : st === "starting" ? "Starting…" : "Unavailable"}
              </button>
            );
          }
          return (
            <button
              className="btn-primary"
              disabled={sessionInFlight || !canJoin || !scene}
              onClick={() => scene && onConnect(scene, server)}
            >
              {ctaLabel(sessionState, mine)}
            </button>
          );
        })();

        return (
          <div key={server.id} className={`op-slot ${statusCls}`}>
            <div className="op-slot-media">
              {asset?.type === "video" ? (
                <video src={asset.src} poster={asset.poster} muted playsInline preload="metadata" loop autoPlay />
              ) : asset?.type === "image" ? (
                <img src={asset.src} alt="" />
              ) : (
                <div className="op-slot-media-empty">{st === "offline" ? "Server offline" : "No scene"}</div>
              )}
              <span className="op-slot-server">{h?.server_label ?? server.label}</span>
              {recommendedId === server.id && st !== "offline" && (
                <span className="op-slot-reco">Recommended for you</span>
              )}
            </div>
            <div className="op-slot-body">
              <div className="op-slot-status">
                <span className={`op-dot ${statusCls}`} />
                {statusText}
                {snap?.latencyMs != null && <span className="op-slot-ping">~{snap.latencyMs} ms</span>}
              </div>
              <h3>{scene?.name ?? (st === "offline" ? "—" : "No scene loaded")}</h3>
              {scene?.description && <p>{scene.description}</p>}
              <div className="op-slot-footer">{button}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ctaLabel(state: UiSessionState, mine: boolean): string {
  if (!mine) return "Connect";
  switch (state) {
    case "preflight":
      return "Checking server…";
    case "requesting-xr":
      return "Opening VR…";
    case "connecting":
      return "Connecting…";
    case "connected":
    case "streaming":
      return "In session";
    case "disconnecting":
      return "Leaving…";
    default:
      return "Connect";
  }
}

// ─── Result of the session that just ended ───────────────────────────────

export interface LastSession {
  token: string | null;
  serverId: string | null;
  serverLabel: string;
  host: string | null;
  endedAt: number;
  lastStatus: LiveStatus | null;
}

interface SessionResult {
  state: "active" | "finalized";
  demos: number;
  resets: number;
  duration_s: number;
  backed_up: boolean;
  server_label?: string;
  scene_name?: string;
}

const LAST_KEY = "simxr-last-session";

export function saveLastSession(s: LastSession | null): void {
  try {
    if (s) localStorage.setItem(LAST_KEY, JSON.stringify(s));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* storage blocked: the card still shows for this page view */
  }
}

export function loadLastSession(): LastSession | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LastSession;
    // older than 6 h: not "the session you just finished" any more
    return Date.now() - s.endedAt < 6 * 3600_000 ? s : null;
  } catch {
    return null;
  }
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

export function ResultCard({ last, onDismiss }: { last: LastSession; onDismiss: () => void }) {
  const [res, setRes] = useState<SessionResult | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!last.token || !last.host) return;
    let cancelled = false;
    let timer: number | null = null;
    let misses = 0;
    let finalizedSeen = false;
    const started = Date.now();
    const tick = async () => {
      try {
        const r = await fetch(`https://${last.host}/api/sessions/${encodeURIComponent(last.token!)}.json`, {
          cache: "no-store",
        });
        if (r.ok) {
          const d = (await r.json()) as SessionResult;
          if (cancelled) return;
          setRes(d);
          setMissing(false);
          finalizedSeen = d.state === "finalized";
          // finalized + backed up (or nothing to back up): done
          if (d.state === "finalized" && (d.backed_up || d.demos === 0)) return;
        } else if (r.status === 404) {
          misses += 1;
          if (misses >= 15) setMissing(true);
        }
      } catch {
        /* network blip: keep trying */
      }
      if (cancelled || Date.now() - started > 15 * 60_000) return;
      timer = window.setTimeout(tick, finalizedSeen ? 10_000 : 2_000);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last.token, last.host]);

  const demos = res?.demos ?? last.lastStatus?.demos ?? null;
  const finalized = res?.state === "finalized";
  let line: string;
  let lineCls = "pending";
  if (!last.token) {
    line = "This server does not report session results yet.";
  } else if (missing && !res) {
    line = "Couldn't confirm the result from the server. Demos are written to disk the moment each one succeeds.";
    lineCls = "warn";
  } else if (!finalized) {
    line = "Closing your session on the server…";
  } else if (demos === 0) {
    line = "Nothing to save this time — no attempt reached the goal.";
    lineCls = "warn";
  } else if (res?.backed_up) {
    line = "Saved on the server and backed up to cloud storage.";
    lineCls = "ok";
  } else {
    line = "Saved on the server. Uploading the backup…";
    lineCls = "ok";
  }

  return (
    <div className="op-result">
      <div className="op-result-main">
        <div className="eyebrow">Session finished · {res?.server_label ?? last.serverLabel}</div>
        <div className="op-result-number">
          <span className="n">{demos ?? "…"}</span>
          <span className="l">{demos === 1 ? "demo saved" : "demos saved"}</span>
        </div>
        <div className={`op-result-line ${lineCls}`}>{line}</div>
        {res && (
          <div className="op-result-meta">
            {fmtDur(res.duration_s)} in VR · {res.resets} reset{res.resets === 1 ? "" : "s"}
            {res.scene_name ? ` · ${res.scene_name}` : ""}
          </div>
        )}
      </div>
      <div className="op-result-side">
        <p>Thank you! You can connect again right away to record more.</p>
        <button className="btn-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── How to record a demo ────────────────────────────────────────────────

export function HowItWorks({ device }: { device: DeviceInfo }) {
  return (
    <div className="op-how">
      <div className="op-how-col">
        <h2>How to record a demo</h2>
        <ol>
          <li>
            <b>Quest 3 or 3S, standing.</b> Clear about a metre around you and open <b>simxr.app</b> in the
            Quest Browser.
          </li>
          <li>
            <b>Pick a server that says Ready</b> — the one marked <i>Recommended</i> is closest to you. Tap{" "}
            <b>Connect</b> and allow VR.
          </li>
          <li>
            <b>You are the robot.</b> Your hands move its hands. Squeeze the <b>trigger and grip</b> to close
            the hand, release to open.
          </li>
          <li>
            <b>Bring the jam jar to the tray.</b> Hold it around the middle, stand it on the tray, open the hand
            and pull it back. That counts as one demo: it is saved automatically, the counter in front of you
            goes up and the table resets.
          </li>
          <li>
            <b>Went wrong?</b> Hold <b>B</b> on the right controller for one second — the table resets, the
            attempt is discarded.
          </li>
          <li>
            <b>Done?</b> Press the Meta button and quit (or close the tab). Your result shows up on this page.
          </li>
        </ol>
      </div>
      <div className="op-how-col side">
        <h3>Good to know</h3>
        <ul>
          <li>One operator per server. If a server is in use, try the other one or wait — this page updates by itself.</li>
          <li>Only successful attempts are saved. Slow and steady beats fast: a tilted jar slips out of the hand.</li>
          <li>Picture froze or went black? Quit and connect again — demos you already saved are kept.</li>
          <li>Use 5 GHz Wi-Fi close to the router; the video needs roughly 50 Mbit/s.</li>
        </ul>
        <div className={`op-device ${device.supported === false ? "bad" : device.supported ? "ok" : "unknown"}`}>
          <span className="op-dot" />
          <span>
            This device: <b>{device.label}</b>
            {device.note ? ` — ${device.note}` : device.supported ? " — ready to stream" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
