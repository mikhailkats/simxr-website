// React hook wrapping the CloudXR.js Session lifecycle.
//
// CloudXR.createSession() is the SDK's single entry point. The hook returns:
//   - state: current SessionState (idle / connecting / connected / streaming / error / disconnected)
//   - connect(sceneId): user-gesture-bearing function that opens the WebXR session
//                       and starts the CloudXR stream
//   - disconnect(): cleanly tears down the active session
//   - error: most recent error (if any)
//
// IMPORTANT: connect() must be called from a synchronous event handler that
// already holds an active user gesture (e.g. onClick of a button). The WebXR
// `navigator.xr.requestSession` requires a user-gesture stack, and the SDK
// does NOT handle the gesture for you — the developer owns that call.

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMediaIp, fetchHealth, isMockMode, type Healthz } from "./scenes";

// CloudXR.js types — declared here as a minimal shape because the SDK ships
// its own .d.ts and we'll get full IDE completion once the vendored tarball
// is installed via package.json. These local interfaces let TypeScript
// compile cleanly even before the package is in place.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace CloudXR {
    type SessionState =
      | "idle"
      | "connecting"
      | "connected"
      | "streaming"
      | "disconnecting"
      | "error";

    interface SessionCreateOptions {
      server: { host: string; port: number; ssl: boolean };
      client: {
        deviceProfile: string;
        immersiveMode: "vr" | "ar";
        mediaAddress: string;
        mediaPort: number;
        perEyeWidth?: number;
        perEyeHeight?: number;
        maxStreamingBitrateKbps?: number;
        deviceFrameRate?: number;
      };
    }

    interface StreamingError {
      code: number;
      message: string;
    }

    interface Session {
      onStateChange?: (state: SessionState) => void;
      onError?: (error: StreamingError) => void;
      onStreamStopped?: (error?: StreamingError) => void;
      connect(): Promise<void>;
      disconnect(): Promise<void>;
      dispose(): void;
    }

    function createSession(options: SessionCreateOptions): Promise<Session>;
  }
}

// Loaded dynamically so the SDK doesn't bloat the homepage bundle.
// Package name is `@nvidia/cloudxr` (the library is *called* CloudXR.js but
// the npm package itself doesn't carry the `-js` suffix).
async function loadSdk(): Promise<typeof CloudXR> {
  const mod = (await import("@nvidia/cloudxr" as string)) as unknown as {
    default?: typeof CloudXR;
  } & typeof CloudXR;
  return mod.default ?? mod;
}

export type UiSessionState =
  | "idle"
  | "preflight"      // fetching IP / health before opening WebXR
  | "requesting-xr"  // navigator.xr.requestSession in flight
  | "connecting"     // CloudXR signaling
  | "connected"
  | "streaming"
  | "disconnecting"
  | "error";

export interface UseCloudXRSessionResult {
  state: UiSessionState;
  health: Healthz | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export interface UseCloudXRSessionOptions {
  /** Cloudflare-tunneled WSS host. Defaults to api.simxr.app. */
  host?: string;
  /** Port for the WSS handshake. 443 when behind Cloudflare; 49100 for direct. */
  port?: number;
  /** Polling interval for /api/healthz, in ms. 0 disables polling. */
  healthPollMs?: number;
}

export function useCloudXRSession(
  opts: UseCloudXRSessionOptions = {},
): UseCloudXRSessionResult {
  const { host = "api.simxr.app", port = 443, healthPollMs = 5000 } = opts;

  const [state, setState] = useState<UiSessionState>("idle");
  const [health, setHealth] = useState<Healthz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<CloudXR.Session | null>(null);
  const xrSessionRef = useRef<XRSession | null>(null);

  // Poll /healthz for live-scene + server-state.
  useEffect(() => {
    if (healthPollMs <= 0) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const h = await fetchHealth();
        if (!cancelled) setHealth(h);
      } catch {
        if (!cancelled) setHealth(null);
      }
    };
    tick();
    const id = window.setInterval(tick, healthPollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [healthPollMs]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      void sessionRef.current?.disconnect().catch(() => {});
      sessionRef.current?.dispose();
      sessionRef.current = null;
      void xrSessionRef.current?.end().catch(() => {});
      xrSessionRef.current = null;
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // KEEPALIVE — DROP-IN FIX FOR CLOUDFLARE 100s WS IDLE TIMEOUT
  // ──────────────────────────────────────────────────────────────────────────
  // Cloudflare Free + Pro tier closes WebSocket connections after 100 seconds
  // of no traffic in either direction. CloudXR sessions can run 10+ minutes;
  // long idle periods (operator standing still, scene paused, etc.) would
  // silently kill the signaling channel without this. Enabled proactively
  // (cost in success-case is one no-op call per 30s; cost in failure-case
  // is a debugging cycle on Phase 6 with Mike on Quest 3 — pay it now).
  //
  // Method probing: cloudxr-js 6.1 GA's exact keepalive API isn't documented
  // (the SDK's typings don't ship a public `sendPing` / `sendOpaqueData`).
  // We try the most likely shapes via optional chaining; if the SDK has none
  // of them, the calls no-op and we'll see a 100s drop in Phase 6 — at which
  // point we patch the right identifier (look at session._signalingChannel
  // or similar internals; opaque-data-channel API is documented at
  // https://docs.nvidia.com/cloudxr-sdk/latest/usr_guide/cloudxr_runtime/opaque_data_channel.html).
  useEffect(() => {
    if (state !== "streaming" && state !== "connected") return;
    const id = window.setInterval(() => {
      const cxr = sessionRef.current as
        | (CloudXR.Session & {
            sendPing?: () => void;
            sendOpaqueData?: (data: Uint8Array) => void;
            keepAlive?: () => void;
          })
        | null;
      if (!cxr) return;
      try {
        // Try documented shapes first (method names guessed from common SDK
        // conventions and similar NVIDIA SDKs); SDK ships none of these as
        // of 6.1, so all three optional-chain to no-op until proven otherwise.
        cxr.sendPing?.();
        cxr.keepAlive?.();
        cxr.sendOpaqueData?.(new Uint8Array([0]));
      } catch {
        // Don't let a keepalive blip take down the session.
      }
    }, 30_000); // 30s — well below CF's 100s idle timeout
    return () => window.clearInterval(id);
  }, [state]);

  const connect = useCallback(async () => {
    if (state !== "idle" && state !== "error") return;
    setError(null);

    // Mock mode — simulate the lifecycle without touching WebXR or the SDK.
    // Set ?mock=1 in the URL to enable. ?mock=1&error=connect simulates a
    // connect-stage failure for testing error UI.
    if (isMockMode()) {
      setState("preflight");
      await new Promise((r) => setTimeout(r, 400));
      setState("requesting-xr");
      await new Promise((r) => setTimeout(r, 600));
      setState("connecting");
      await new Promise((r) => setTimeout(r, 1200));
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "connect") {
        setError("(mock) Simulated CloudXR connect failure for UI testing.");
        setState("error");
        return;
      }
      setState("streaming");
      return;
    }

    // 1. Pre-flight — confirm WebXR is supported in this browser.
    if (!("xr" in navigator) || !navigator.xr) {
      setError(
        "WebXR not available in this browser. Open simxr.app from a WebXR-capable VR headset's browser to access the demo.",
      );
      setState("error");
      return;
    }
    const xr = navigator.xr as XRSystem;
    let supported = false;
    try {
      supported = await xr.isSessionSupported("immersive-vr");
    } catch {
      supported = false;
    }
    if (!supported) {
      setError(
        "Your browser reports WebXR but not immersive-vr. Make sure VR is enabled in headset settings.",
      );
      setState("error");
      return;
    }

    // 2. Pre-flight — fetch the bare server IP for UDP media + the live
    //    healthz so we read the current media port from the server (decouples
    //    React from any future port reshuffle on the runtime side; default
    //    is 47998 but that's a server config, not a contract). Done in
    //    parallel because the two endpoints are independent.
    setState("preflight");
    let mediaAddress: string;
    let mediaPort: number;
    try {
      const [ip, healthz] = await Promise.all([fetchMediaIp(), fetchHealth()]);
      mediaAddress = ip;
      // healthz.media_port is required per the locked schema — but defend
      // against an older server that hasn't shipped the field yet.
      mediaPort = healthz.media_port ?? 47998;
    } catch (e) {
      setError(
        `Server didn't respond on pre-flight. The demo runtime may be offline. (${(e as Error).message})`,
      );
      setState("error");
      return;
    }

    // 3. Request the WebXR session — this MUST happen synchronously inside the
    //    user-gesture handler. The fetch above happens before the gesture ends
    //    only because async work in a click handler still keeps the gesture
    //    active in modern browsers; if this turns out to be flaky we'll move
    //    fetchMediaIp() to a polling phase before the click and cache the IP.
    setState("requesting-xr");
    let xrSession: XRSession;
    try {
      xrSession = await xr.requestSession("immersive-vr", {
        optionalFeatures: ["hand-tracking", "local-floor"],
      });
      xrSessionRef.current = xrSession;
    } catch (e) {
      setError(
        `WebXR session request rejected: ${(e as Error).message}. Try tapping Connect again — the gesture must come directly from your tap.`,
      );
      setState("error");
      return;
    }

    // 4. Open the CloudXR session.
    setState("connecting");
    try {
      const sdk = await loadSdk();
      const cxr = await sdk.createSession({
        server: { host, port, ssl: port === 443 },
        client: {
          deviceProfile: "auto-webrtc",
          immersiveMode: "vr",
          mediaAddress,
          mediaPort,  // from healthz.media_port (default 47998); WSS signaling lives on host:port (49100/443)
          perEyeWidth: 2048,
          perEyeHeight: 1792,
          maxStreamingBitrateKbps: 150_000,
          deviceFrameRate: 90,
        },
      });
      sessionRef.current = cxr;

      cxr.onStateChange = (s) => {
        // Map SDK state to our UI state.
        if (s === "connected") setState("connected");
        else if (s === "streaming") setState("streaming");
        else if (s === "disconnecting") setState("disconnecting");
        else if (s === "error") setState("error");
        else if (s === "idle") setState("idle");
      };
      cxr.onError = (err) => {
        setError(`CloudXR error 0x${err.code.toString(16)}: ${err.message}`);
        setState("error");
      };
      cxr.onStreamStopped = (err) => {
        if (err) {
          setError(`Stream ended unexpectedly: ${err.message}`);
          setState("error");
        } else {
          setState("idle");
        }
      };

      await cxr.connect();
    } catch (e) {
      // CloudXR failed; tear down the WebXR session we already opened so
      // the headset doesn't sit on a black screen.
      void xrSession.end().catch(() => {});
      xrSessionRef.current = null;
      setError(`CloudXR connect failed: ${(e as Error).message}`);
      setState("error");
    }
  }, [state, host, port]);

  const disconnect = useCallback(async () => {
    setState("disconnecting");
    if (isMockMode()) {
      await new Promise((r) => setTimeout(r, 400));
      setState("idle");
      return;
    }
    try {
      await sessionRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sessionRef.current?.dispose();
    sessionRef.current = null;
    try {
      await xrSessionRef.current?.end();
    } catch {
      /* ignore */
    }
    xrSessionRef.current = null;
    setState("idle");
  }, []);

  return { state, health, error, connect, disconnect };
}
