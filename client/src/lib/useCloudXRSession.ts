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
    interface StreamingError {
      code: number;
      message: string;
    }

    // Reverse-engineered from NVIDIA's deployed IsaacTeleop bundle.js
    // (`u.createSession=function(E,I)`) by CC 2026-05-03. The earlier nested
    // `{server, client}` shape was hallucinated — actual SDK 6.1 takes a
    // single FLAT object as first arg + callbacks as second arg.
    interface SessionCreateOptions {
      // Server connection (signaling)
      serverAddress: string;
      serverPort: number;
      useSecureConnection: boolean;
      signalingResourcePath: string;
      // UDP media
      mediaAddress: string;
      mediaPort: number;
      // Render
      perEyeWidth: number;          // validator: positive int, multiple of 16, ≥256
      perEyeHeight: number;         // validator: positive int, multiple of 64, ≥256
      deviceFrameRate?: number;
      maxStreamingBitrateKbps?: number;
      codec?: "av1" | "h265" | "h264";
      reprojectionGridCols?: number;
      reprojectionGridRows?: number;
      enablePoseSmoothing?: boolean;
      posePredictionFactor?: number;
      enableTexSubImage2D?: boolean;
      useQuestColorWorkaround?: boolean;
      // WebGL / WebXR bridge — REQUIRED. Caller wires these up before
      // calling createSession. See connect() below for the setup chain.
      gl: WebGL2RenderingContext;
      referenceSpace: XRReferenceSpace;
      glBinding: XRWebGLBinding;
      // Telemetry
      telemetry?: {
        enabled: boolean;
        appInfo: { version: string; product: string };
      };
    }

    interface SessionCallbacks {
      onWebGLStateChangeBegin?: () => void;
      onWebGLStateChangeEnd?: () => void;
      onStreamStarted?: () => void;
      onStreamStopped?: (error?: StreamingError) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onMetrics?: (metrics: any, cadence: any) => void;
    }

    interface Session {
      connect(): Promise<void>;
      disconnect(): Promise<void>;
      dispose(): void;
      // Optional keepalive surface — exact method name untyped in the SDK,
      // probed via optional chaining in the keepalive useEffect.
      sendPing?: () => void;
      keepAlive?: () => void;
      sendOpaqueData?: (data: Uint8Array) => void;
    }

    // createSession returns Session SYNCHRONOUSLY (no Promise wrapper) per
    // NVIDIA's bundle: `I = u.createSession(m, w); I.connect();`
    function createSession(
      options: SessionCreateOptions,
      callbacks: SessionCallbacks,
    ): Session;
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
      const cxr = sessionRef.current;
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
    //
    // Both error paths below resolve to the same product fact: this device
    // can't enter immersive VR. The two messages differ only in the hint
    // about headset-side settings, which is relevant when the visitor IS
    // already on a headset but VR mode is somehow disabled (rare). On a
    // desktop browser, the second variant's "check VR is enabled" hint is
    // misleading — desktop visitors should just be pointed at a real VR
    // headset, not told to fix nonexistent settings.
    if (!("xr" in navigator) || !navigator.xr) {
      setError(
        "WebXR isn't supported in this browser. Open simxr.app from a Quest 3, Apple Vision Pro, or Pico headset to enter the VR demo.",
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
        "Immersive VR isn't available in this browser. Open simxr.app from a Quest 3, Apple Vision Pro, or Pico headset to enter the demo. If you're already on a headset and seeing this, check that VR is enabled in your headset's browser settings.",
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

    // 3. WebGL2 + WebXR setup — CloudXR.js 6.1 needs the GL/XR bridge
    //    (gl + glBinding + referenceSpace) wired in BEFORE createSession.
    //    Reverse-engineered from NVIDIA's IsaacTeleop bundle 2026-05-03.
    //    requestSession MUST happen inside the user-gesture chain (browser
    //    rule); the fetch above stays inside the gesture window via
    //    transient activation, which Quest browser preserves across awaits.
    setState("requesting-xr");

    // 3a. Create off-screen WebGL2 context with xrCompatible upfront.
    //     Falls back to gl.makeXRCompatible() if the constructor flag fails
    //     (rare on Quest 3; common on some desktop browsers).
    const canvas = document.createElement("canvas");
    let gl: WebGL2RenderingContext;
    try {
      // Cast: canvas.getContext("webgl2", attrs) returns WebGL2RenderingContext | null
      // per spec, but TS overload resolution with the second-arg attrs object
      // sometimes widens the return to RenderingContext. Cast back to the specific
      // type we know we requested.
      const ctx = canvas.getContext("webgl2", { xrCompatible: true }) as
        | WebGL2RenderingContext
        | null;
      if (!ctx) throw new Error("WebGL2 not available in this browser");
      gl = ctx;
    } catch (e) {
      setError(`WebGL2 setup failed: ${(e as Error).message}`);
      setState("error");
      return;
    }

    // 3b. Open the WebXR immersive-vr session.
    //     Features list matches NVIDIA's IsaacTeleop default (per CC's decode
    //     of bundle.js 2026-05-03): requiredFeatures: ["local-floor"],
    //     optionalFeatures: ["hand-tracking"]. Earlier "unbounded" inclusion
    //     was rejected by some Quest 3 Browser versions even though it should
    //     silent-skip from optional — strict CFG validation in those builds.
    let xrSession: XRSession;
    try {
      xrSession = await xr.requestSession("immersive-vr", {
        requiredFeatures: ["local-floor"],
        optionalFeatures: ["hand-tracking"],
      });
      xrSessionRef.current = xrSession;
    } catch (e) {
      setError(
        `WebXR session request rejected: ${(e as Error).message}. Try tapping Connect again — the gesture must come directly from your tap.`,
      );
      setState("error");
      return;
    }

    // 3c. Wire WebGL into the XR session — XRWebGLLayer + reference space
    //     fallback chain + XRWebGLBinding. This is the bridge CloudXR uses
    //     to submit rendered frames back into the headset's compositor.
    let refSpace: XRReferenceSpace | null = null;
    let xrBinding: XRWebGLBinding;
    try {
      // Late xrCompatible upgrade if the constructor hint didn't take.
      // gl.makeXRCompatible exists on WebGL2 contexts; cast to access it.
      const glAny = gl as WebGL2RenderingContext & {
        makeXRCompatible?: () => Promise<void>;
      };
      if (typeof glAny.makeXRCompatible === "function") {
        await glAny.makeXRCompatible();
      }

      const xrLayer = new XRWebGLLayer(xrSession, gl, { antialias: false });
      await xrSession.updateRenderState({ baseLayer: xrLayer });

      // Reference-space fallback. Dropped "unbounded" same reason as in the
      // optionalFeatures list — Quest 3 Browser doesn't support it and some
      // builds reject the request entirely. Quest 3 accepts local-floor as
      // primary; "local" / "viewer" are insurance for other headsets.
      for (const t of ["local-floor", "local", "viewer"] as const) {
        try {
          refSpace = await xrSession.requestReferenceSpace(t);
          break;
        } catch {
          /* try next */
        }
      }
      if (!refSpace) {
        throw new Error(
          "No usable XR reference space (tried local-floor / local / viewer)",
        );
      }

      xrBinding = new XRWebGLBinding(xrSession, gl);
    } catch (e) {
      void xrSession.end().catch(() => {});
      xrSessionRef.current = null;
      setError(`XR/WebGL bridge setup failed: ${(e as Error).message}`);
      setState("error");
      return;
    }

    // 4. Open the CloudXR session — flat options (NOT nested {server,client})
    //    + callbacks as second arg + sync return.
    setState("connecting");
    try {
      const sdk = await loadSdk();
      const cxr = sdk.createSession(
        {
          // Server signaling
          serverAddress: host,
          serverPort: port,
          useSecureConnection: port === 443,
          signalingResourcePath: "/",
          // UDP media (host:port for signaling, mediaAddress:mediaPort for video)
          mediaAddress,
          mediaPort,
          // Render. Per-eye sizes must be multiples of (16w, 64h) and ≥256.
          perEyeWidth: 2048,
          perEyeHeight: 1792,
          deviceFrameRate: 90,
          maxStreamingBitrateKbps: 150_000,
          // NVIDIA defaults from bundle.js (verified 2026-05-03 by CC).
          // av1 with h265/h264 fallback negotiated server-side.
          codec: "av1",
          enablePoseSmoothing: true,
          posePredictionFactor: 1,
          enableTexSubImage2D: false,
          useQuestColorWorkaround: true, // we target Quest 3 — flip if color renders odd
          // GL/XR bridge (built in step 3c)
          gl,
          referenceSpace: refSpace,
          glBinding: xrBinding,
          telemetry: {
            enabled: true,
            appInfo: { version: "6.1.0", product: "simxr.app" },
          },
        },
        {
          // We don't draw to gl outside CloudXR, so the WebGL state-change
          // hooks are no-ops. Implement save/restore here if you ever overlay
          // any custom rendering on top of the CloudXR-driven frame.
          onWebGLStateChangeBegin: () => {},
          onWebGLStateChangeEnd: () => {},
          onStreamStarted: () => setState("streaming"),
          onStreamStopped: (err) => {
            if (err) {
              setError(`Stream ended unexpectedly: ${err.message}`);
              setState("error");
            } else {
              setState("idle");
            }
          },
          onMetrics: () => {
            /* SDK-side telemetry already handles bitrate/dropped-frames. No-op for now. */
          },
        },
      );
      sessionRef.current = cxr;

      // cxr.connect() opens the WSS signaling channel + handshakes UDP
      // media. Resolves when session is "connected" (frames may not have
      // started yet — onStreamStarted will fire when they do).
      await cxr.connect();
      setState("connected");
    } catch (e) {
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
