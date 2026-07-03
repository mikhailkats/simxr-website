// SIM XR — multi-server fleet registry + live-state aggregation.
//
// Each GPU server exposes the same v1.5 endpoint contract
// (/api/healthz, /api/scenes.json, /api/ip.json) behind its OWN stable
// Cloudflare Tunnel hostname. IPs float across stop/start; hostnames don't.
// The frontend never needs a redeploy when a server is stopped or started —
// it polls every registry entry and shows whichever servers answer.
//
// Registry changes (adding a 3rd server) DO require a frontend commit —
// that's deliberate: the server set changes rarely, hostnames are the
// stable anchor, and a static list avoids a whole class of
// registration/heartbeat backend we don't need at N=2.
//
// Server-side runbook: kb repo docs/knowledge/runbooks/
// "{simxr} {guide} one-click multi-server catalog – 2026-07-03.md".

import {
  fetchHealthFrom,
  fetchScenesFrom,
  type Healthz,
  type Scene,
} from "./scenes";

export interface SimxrServer {
  /** Short stable id — also used as the `srv` URL param on /recordings. */
  id: string;
  /** Human label shown on cards/badges. */
  label: string;
  /** AWS region hint shown in UI copy. */
  region: string;
  /** Cloudflare-tunneled hostname for BOTH the /api/* JSON and WSS signaling. */
  host: string;
  /** WSS port — 443 behind Cloudflare. */
  port: number;
}

export const SERVERS: SimxrServer[] = [
  {
    id: "eu",
    label: "EU · Frankfurt",
    region: "eu-central-1",
    host: "api.simxr.app",
    port: 443,
  },
  {
    id: "us",
    label: "US · Oregon",
    region: "us-west-2",
    host: "api-us.simxr.app",
    port: 443,
  },
];

export function serverById(id: string | null | undefined): SimxrServer | null {
  if (!id) return null;
  return SERVERS.find((s) => s.id === id) ?? null;
}

export function apiBaseOf(server: SimxrServer): string {
  return `https://${server.host}/api`;
}

/** One polled snapshot of one server. `health === null` ⇒ unreachable/offline. */
export interface ServerSnapshot {
  server: SimxrServer;
  health: Healthz | null;
  /** Round-trip time of the healthz poll, ms. null when offline. */
  latencyMs: number | null;
}

// scenes.json is static-ish (human-edited yaml, regenerated on deploy) —
// fetch it once per server per page lifetime and cache. healthz is the
// hot path and is re-fetched on every poll tick.
const scenesCache = new Map<string, Scene[]>();

export async function fetchServerScenes(server: SimxrServer): Promise<Scene[]> {
  const hit = scenesCache.get(server.id);
  if (hit) return hit;
  const scenes = await fetchScenesFrom(apiBaseOf(server));
  scenesCache.set(server.id, scenes);
  return scenes;
}

/**
 * Poll every registered server's /api/healthz concurrently. A server that
 * doesn't answer within `timeoutMs` (or errors) comes back with
 * `health: null` — the UI treats that as "server offline, hide its live
 * scene". Never throws: per-server failures are contained.
 */
export async function fetchFleet(timeoutMs = 4500): Promise<ServerSnapshot[]> {
  return Promise.all(
    SERVERS.map(async (server): Promise<ServerSnapshot> => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      const t0 = performance.now();
      try {
        const health = await fetchHealthFrom(apiBaseOf(server), controller.signal);
        return {
          server,
          health,
          latencyMs: Math.round(performance.now() - t0),
        };
      } catch {
        return { server, health: null, latencyMs: null };
      } finally {
        window.clearTimeout(timer);
      }
    }),
  );
}
