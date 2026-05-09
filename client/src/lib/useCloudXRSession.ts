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

// UUID v5 of the string "teleop_command" with namespace DNS.
//
// CloudXR.js 6.1 Session exposes per-channel routing on
// `availableMessageChannels`; each channel is identified by a 16-byte
// UUID (Uint8Array). NVIDIA's bundle.js computes the channel uuid by
// calling `uuidV5("teleop_command", uuidV5.DNS, new Uint8Array(16))`
// (third arg = output buffer; the v5 function is deterministic).
//
// We pre-computed the bytes once (Node's standalone v5 implementation,
// cross-checked by spec'd UUID v5 algorithm: SHA-1 of namespace+name,
// version=5 nibble + variant=10 bits) and hardcode them here so the
// React bundle doesn't need to ship the `uuid` package just for this
// constant. Result hex: ab2380eb-80ee-53a3-9a3c-eaca71ed5444.
//
// If you ever need to add another channel (e.g. "diagnostics"), repeat
// the same computation — see `compute_uuid.mjs` in repo notes for the
// exact recipe, or use any uuid library `v5(name, v5.DNS, output)`.
const TELEOP_CHANNEL_UUID = new Uint8Array([
  171, 35, 128, 235, 128, 238, 83, 163,
  154, 60, 234, 202, 113, 237, 84, 68,
]);

/**
 * Locate a CloudXR Session message channel by its 16-byte UUID.
 *
 * Each entry in `session.availableMessageChannels` carries `uuid:
 * Uint8Array(16)`. We compare byte-by-byte rather than coerce to string
 * because (a) the SDK gives us bytes, not a string, and (b) byte
 * comparison sidesteps any JS-side ambiguity around UUID textual
 * formatting (case, dashes, byte order).
 */
function findChannelByUuid<T extends { uuid: Uint8Array }>(
  channels: ReadonlyArray<T> | null | undefined,
  targetUuid: Uint8Array,
): T | undefined {
  if (!channels) return undefined;
  return channels.find(
    (c) =>
      c.uuid?.length === targetUuid.length &&
      targetUuid.every((b, i) => c.uuid[i] === b),
  );
}

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
      // Per-frame methods called inside the WebXR rAF callback. NVIDIA's
      // documented pattern (developer.nvidia.com CloudXR.js sample):
      //   session.sendTrackingStateToServer(time, frame)  ← MUST call each
      //     frame so server knows we're an active client and where head/
      //     controllers are pointing. Without this, server-side runtime
      //     never registers us as a client, never starts encoding video.
      //   session.render(time, frame, baseLayer)  ← composites the decoded
      //     video frame into the XR layer's framebuffer. Without this, SDK
      //     never writes pixels and Quest sees black screen.
      sendTrackingStateToServer(time: number, frame: XRFrame): void;
      render(time: number, frame: XRFrame, baseLayer: XRWebGLLayer): void;
      // Server-bound message API — reverse-engineered (corrected) from
      // NVIDIA IsaacTeleop bundle.js 2026-05-08. Earlier session memory
      // had `sendCustomMessage(message)` documented; that method does not
      // exist on CloudXR.js 6.1 Session. The actual SDK shape is:
      //
      //   session.availableMessageChannels: Array<MessageChannel>
      //     where each MessageChannel = { uuid: Uint8Array;
      //                                   sendServerMessage(bytes: Uint8Array): boolean }
      //   session.sendServerMessage(payload: object): void   // legacy fallback
      //
      // NVIDIA's Start/Stop/Reset path (their `ue` function in bundle.js):
      //   1. Compute the channel UUID = uuidV5("teleop_command", DNS).
      //   2. Look up the matching channel by uuid bytes in availableMessageChannels.
      //   3. If found: encode payload as UTF-8 bytes, call channel.sendServerMessage(bytes).
      //   4. Else fall back to session.sendServerMessage(payload) (object, not bytes).
      //
      // Payload shape for IsaacLab teleop:
      //   {type: "teleop_command", message: {command: "start teleop"}} → RUN
      //   {type: "teleop_command", message: {command: "stop teleop"}}  → STOP
      //   {type: "teleop_command", message: {command: "reset teleop"}} → RESET ANCHOR
      // Server-side mapping:
      //   isaaclab_teleop/session_lifecycle.py:_execution_events_to_control()
      //   → ctrl.is_active=True → record_demos.py running_recording_instance=True
      //
      // Both fields are optional in the type because not every SDK build
      // exposes both surfaces; `sendTeleopCommand` below probes channels
      // first, falls back to legacy, console.errors if neither exists.
      availableMessageChannels?: Array<{
        uuid: Uint8Array;
        sendServerMessage(bytes: Uint8Array): boolean;
      }>;
      sendServerMessage?: (payload: unknown) => void;
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

/**
 * Server-side IsaacLab teleop control commands. Sent over the SDK's
 * custom-message channel (WebRTC `control_channel`); server-side
 * `isaaclab_teleop/session_lifecycle.py:_execution_events_to_control()`
 * maps these to ExecutionState transitions which the record_demos.py
 * runtime polls each step:
 *   "start teleop" → ctrl.is_active=True → running_recording_instance=True
 *                     (env.reset() side-effect re-anchors HMD pose)
 *   "stop teleop"  → ctrl.is_active=False → operator can resume or disconnect
 *   "reset teleop" → teleop_interface.reset() → re-anchor HMD without restart
 *
 * Reverse-engineered from NVIDIA IsaacTeleop bundle.js 2026-05-08.
 */
export type TeleopCommand = "start teleop" | "stop teleop" | "reset teleop";

export interface UseCloudXRSessionResult {
  state: UiSessionState;
  health: Healthz | null;
  error: string | null;
  /**
   * Open the WebXR + CloudXR session for the given scene. Pass the gym
   * task_id (e.g. "Isaac-PickPlace-Locomanipulation-G1-3DGS-BrightLivingRoom-Abs-v0")
   * so the hook can pass it back through `onSessionEnded` for the
   * `/recordings?fresh=<task_id>` redirect after Quest exits VR.
   *
   * Backward-compatible: callers that don't yet pass a taskId still work;
   * the redirect just won't include a `?fresh=` param and the recordings
   * page won't highlight a specific entry.
   */
  connect: (taskId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  /**
   * Send a teleop control command to the server. Returns true if either
   * SDK path accepted (modern `availableMessageChannels[teleop].sendServerMessage(bytes)`
   * or legacy top-level `sendServerMessage(payload)`); false + console.error
   * if neither surface is exposed by the SDK build (caller should fall
   * back to the NVIDIA hosted client overlay).
   *
   * Wired both to the in-VR DOM Overlay buttons (Start / Recenter / Stop)
   * and to the auto-arm in onStreamStarted — same shared codepath for
   * both manual and automatic firing.
   */
  sendTeleopCommand: (command: TeleopCommand) => boolean;
}

export interface UseCloudXRSessionOptions {
  /** Cloudflare-tunneled WSS host. Defaults to api.simxr.app. */
  host?: string;
  /** Port for the WSS handshake. 443 when behind Cloudflare; 49100 for direct. */
  port?: number;
  /** Polling interval for /api/healthz, in ms. 0 disables polling. */
  healthPollMs?: number;
  /**
   * Fired when the CloudXR stream stops — both clean exits (Quest gesture,
   * server-side stop) and crash paths. Receives the taskId passed to the
   * matching `connect()` call (null if connect was called without one, e.g.
   * legacy callers). Dashboard wires this to wouter's setLocation so Quest
   * automatically lands on /recordings?fresh=... after exiting VR.
   *
   * Fires AFTER the hook has already cleaned up the WebXR session and set
   * state to "idle" / "error", so the callback can safely navigate without
   * racing with hook teardown.
   */
  onSessionEnded?: (taskId: string | null) => void;
  /**
   * Lazy getter for the DOM element passed as WebXR's `domOverlay.root`.
   * When Quest 3 Browser grants the `dom-overlay` feature, the headset
   * compositor renders the returned element as a flat layer in 3D space
   * on top of the CloudXR-streamed scene — operator can aim controllers
   * at it and click DOM buttons via WebXR raycast.
   *
   * Lazy getter (not a static prop) because refs don't trigger re-renders;
   * by the time `connect()` runs, the consumer's `<div ref={ref}>` has
   * mounted. Returning null gracefully degrades to a session WITHOUT
   * dom-overlay — no UI panel in VR, operator must use Quest exit
   * gestures and other client (NVIDIA hosted) for teleop control.
   */
  getDomOverlayRoot?: () => HTMLElement | null;
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
  // Tracked for cleanup on disconnect/unmount. Quest WebXR needs the WebGL2
  // canvas attached to DOM for XR-layer framebuffers to actually surface to
  // the headset; rAF handle keeps the XR compositor ticking so CloudXR
  // frames have somewhere to land.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafHandleRef = useRef<number>(0);

  // Track the task_id of the scene the user last clicked Connect on, so the
  // `onStreamStopped` callback (which is registered once at createSession
  // time, no closure access to the Dashboard's per-card scope) can pass it
  // back through `onSessionEnded` for the `/recordings?fresh=<taskId>`
  // redirect. null when caller didn't supply a taskId.
  const lastTaskIdRef = useRef<string | null>(null);

  // Tracks whether `onSessionEnded` has already fired for the current
  // connect() invocation. Reset to false at the top of connect(); flipped
  // to true after the first call (whichever path — WebXR 'end' event or
  // CloudXR onStreamStopped — wins the race).
  //
  // Why both paths: with record_demos.py --num_demos 0 the server keeps
  // pushing frames even after the operator does the Quest exit gesture,
  // so CloudXR's onStreamStopped doesn't fire reliably / on time. WebXR's
  // 'end' event is the guaranteed primary trigger (fires on Quest exit
  // gesture, browser tab close, programmatic .end()). onStreamStopped
  // remains as fallback for server-tears-down-first paths (network drop,
  // mid-recording crash). The guard prevents double-navigation when both
  // fire in close succession (e.g. xrSession.end() inside onStreamStopped
  // synchronously triggers the 'end' listener).
  const sessionEndedFiredRef = useRef<boolean>(false);

  // Whether the most-recent xr.requestSession() actually granted the
  // `dom-overlay` feature. Set in connect() right after the session
  // resolves. Used in the onStreamStarted callback to decide whether
  // to auto-send "start teleop" as a fallback (when overlay isn't
  // visible, operator has no way to tap Start manually) versus waiting
  // for an explicit user gesture in the in-VR overlay's Start button.
  // Honest, conditional: if overlay shows up, user controls the
  // session start; if it doesn't, the system unblocks itself silently
  // so cold-Kit-through-simxr.app produces a working teleop pipeline.
  const overlayGrantedRef = useRef<boolean>(false);

  // Mirror `opts` so the SDK callbacks (registered once at createSession
  // time) always see the current onSessionEnded handler, even if the
  // consumer re-creates it on re-render. Without this, a navigate handler
  // captured at first connect would stay stale across remounts.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

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
      // Cancel rAF first so the SDK doesn't try to draw into a dead XR layer.
      if (rafHandleRef.current && xrSessionRef.current) {
        try { xrSessionRef.current.cancelAnimationFrame(rafHandleRef.current); } catch { /* ignore */ }
      }
      rafHandleRef.current = 0;
      void sessionRef.current?.disconnect()?.catch(() => {});
      sessionRef.current?.dispose?.();
      sessionRef.current = null;
      void xrSessionRef.current?.end()?.catch(() => {});
      xrSessionRef.current = null;
      // Detach the WebGL2 canvas we attached to body in step 3a.
      if (canvasRef.current) {
        try { canvasRef.current.remove(); } catch { /* ignore */ }
        canvasRef.current = null;
      }
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

  // ─── sendTeleopCommand ──────────────────────────────────────────────
  // Wired to Start / Recenter / Stop buttons in the in-VR DOM Overlay
  // AND to the auto-arm in connect()'s onStreamStarted callback. Sends
  // `{type:"teleop_command", message:{command}}` to the server.
  //
  // CloudXR.js 6.1 exposes two paths to reach the runtime:
  //   1. PREFERRED: session.availableMessageChannels[ch].sendServerMessage(bytes)
  //      where `ch` is the channel whose 16-byte uuid matches
  //      uuidV5("teleop_command", DNS) (= TELEOP_CHANNEL_UUID above).
  //      Bytes are UTF-8 JSON of the payload.
  //   2. LEGACY: session.sendServerMessage(payloadObject)
  //      Object form, no encoding. Used by older SDK builds that don't
  //      expose `availableMessageChannels` at all.
  //
  // Reverse-engineered from NVIDIA IsaacTeleop bundle.js 2026-05-08
  // (their `ue` function — Start/Stop/Reset call site). Earlier session
  // memory had `sendCustomMessage(message)` documented; that was wrong —
  // the method doesn't exist on this SDK build, calls silently no-op'd
  // and the optional-chain check returned false → robot never moved.
  //
  // Returns true if either path accepted; false + console.error
  // otherwise. console.info on success so chrome://inspect logs show
  // exactly which path won (channel vs legacy) — actionable diagnostic
  // when the next build bump changes SDK surface.
  //
  // Declared BEFORE connect() so the onStreamStarted closure inside
  // createSession's callbacks can reference it without a TDZ headache.
  const sendTeleopCommand = useCallback(
    (command: TeleopCommand): boolean => {
      const session = sessionRef.current;
      if (!session) {
        // eslint-disable-next-line no-console
        console.error(
          `[simxr] sendTeleopCommand("${command}"): no active CloudXR session`,
        );
        return false;
      }

      const payload = {
        type: "teleop_command" as const,
        message: { command },
      };

      // Path 1 — modern: dedicated message channel.
      const channels = session.availableMessageChannels;
      if (channels && Array.isArray(channels)) {
        const channel = findChannelByUuid(channels, TELEOP_CHANNEL_UUID);
        if (channel) {
          try {
            const bytes = new TextEncoder().encode(JSON.stringify(payload));
            const ok = channel.sendServerMessage(bytes);
            // eslint-disable-next-line no-console
            console.info(
              `[simxr] teleop_command sent via MessageChannel: "${command}" → ok=${ok}`,
            );
            return !!ok;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(
              `[simxr] channel.sendServerMessage("${command}") threw:`,
              e,
            );
            // fall through to legacy path
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            `[simxr] teleop_command channel not found in availableMessageChannels (${channels.length} channels), trying legacy`,
          );
        }
      }

      // Path 2 — legacy: top-level sendServerMessage(payload).
      if (typeof session.sendServerMessage === "function") {
        try {
          session.sendServerMessage(payload);
          // eslint-disable-next-line no-console
          console.info(
            `[simxr] teleop_command sent via legacy sendServerMessage: "${command}"`,
          );
          return true;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(
            `[simxr] legacy sendServerMessage("${command}") threw:`,
            e,
          );
          return false;
        }
      }

      // eslint-disable-next-line no-console
      console.error(
        `[simxr] no usable send method on Session for "${command}" — neither availableMessageChannels nor sendServerMessage available. Robot won't respond. SDK build may have shifted; check chrome://inspect Session object shape.`,
      );
      return false;
    },
    [],
  );

  const connect = useCallback(async (taskId?: string) => {
    if (state !== "idle" && state !== "error") return;
    setError(null);
    // Capture the scene the user clicked Connect on; consumed by
    // onStreamStopped → onSessionEnded for the post-VR redirect.
    lastTaskIdRef.current = taskId ?? null;
    // Lexical capture for the WebXR 'end' listener installed below — the
    // listener is attached once per connect() invocation, so closing over
    // a const here is the cleanest way to associate that specific session
    // with the taskId that opened it (without depending on lastTaskIdRef
    // which mutates on every connect()).
    const connectTaskId: string | null = taskId ?? null;
    // Reset the session-ended guard for this fresh invocation. Both the
    // WebXR 'end' listener (primary) and onStreamStopped (fallback) call
    // onSessionEnded; without this flag they'd double-fire and Dashboard
    // would navigate to /recordings twice.
    sessionEndedFiredRef.current = false;

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

    // 3a. Create WebGL2 context with xrCompatible upfront. Canvas MUST be
    //     attached to DOM (1px invisible) for Quest 3 — pure off-screen
    //     canvas accepts xrCompatible:true but the resulting XRWebGLLayer
    //     framebuffers don't actually display, you get black screen on the
    //     headset. CC verified this 2026-05-03 via tcpdump (UDP frames
    //     reaching Quest, just not rendering).
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; left:0; top:0";
    document.body.appendChild(canvas);
    canvasRef.current = canvas;
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
      // WebXR DOM Overlay — when the consumer provides `getDomOverlayRoot`
      // and the returned element is non-null, request the `dom-overlay`
      // feature and pass the element as `domOverlay.root`. Quest 3 Browser
      // supports this; the headset compositor then renders the DOM as a
      // flat layer in VR (Start/Recenter/Stop buttons usable via controller
      // raycast). On any device that doesn't grant the feature, the session
      // still opens — operator just won't have an in-VR control panel.
      const domOverlayRoot = optsRef.current.getDomOverlayRoot?.() ?? null;
      // Diagnostic — visible in Quest browser console via chrome://inspect.
      // Confirms overlay element exists and has rendered children at the
      // moment we hand it to xr.requestSession(). If `childrenCount=0`
      // here, Quest 3 Browser will register an empty layer and not
      // composite late-mounted children (NVIDIA bundle dodges this by
      // always-rendering its UI; we mirror that pattern via
      // .xr-overlay.inactive CSS hiding instead of conditional render).
      // eslint-disable-next-line no-console
      console.log(
        "[simxr] requestSession with domOverlay root:",
        domOverlayRoot,
        "childrenCount:",
        domOverlayRoot?.childElementCount,
        "innerHTMLpreview:",
        domOverlayRoot?.innerHTML?.slice(0, 200),
      );
      // Structural type, NOT `XRSessionInit & { ... }` — `XRSessionInit`
      // isn't in this codebase's TS lib config (same family as XRSession,
      // XRWebGLBinding, etc. that the rest of this file references via
      // ambient WebXR types from runtime). Inline shape avoids adding
      // another to the pre-existing 13 baseline tsc-errors that vite/
      // esbuild already strips cleanly.
      type SessionInitOpts = {
        requiredFeatures?: string[];
        optionalFeatures?: string[];
        domOverlay?: { root: HTMLElement };
      };
      const sessionInit: SessionInitOpts = {
        requiredFeatures: ["local-floor"],
        optionalFeatures: domOverlayRoot
          ? ["hand-tracking", "dom-overlay"]
          : ["hand-tracking"],
      };
      if (domOverlayRoot) {
        sessionInit.domOverlay = { root: domOverlayRoot };
      }
      xrSession = await xr.requestSession("immersive-vr", sessionInit);
      xrSessionRef.current = xrSession;

      // PRIMARY session-end trigger. WebXR's XRSession spec guarantees the
      // 'end' event fires exactly once when the session terminates — Quest
      // exit gesture, browser tab close, or programmatic xrSession.end().
      // This is independent of whether the server-side CloudXR stream
      // actually stopped: with record_demos.py --num_demos 0 the server
      // keeps pushing frames after the operator leaves VR, so the SDK's
      // onStreamStopped callback (registered below in createSession's
      // callbacks block) doesn't fire reliably / on time. Wiring the
      // 'end' event ensures Dashboard navigates to /recordings?fresh=...
      // immediately on Quest exit. onStreamStopped remains as fallback
      // for paths where the server tears down first (network drop,
      // mid-recording crash).
      //
      // Both paths converge on `optsRef.current.onSessionEnded?.()`,
      // guarded by `sessionEndedFiredRef` so only the first one fires
      // navigation. Cleanup is done in both — defensive duplication, all
      // teardown calls below are idempotent (try/catch + null-checks).
      //
      // Closure note: this listener uses `connectTaskId` (captured at
      // top of connect()) rather than `lastTaskIdRef.current` because
      // by the time 'end' fires the user may have started another
      // connect() that mutated the ref; the listener is attached once
      // per session and the taskId it should report is the one THIS
      // session was opened with.
      xrSession.addEventListener("end", () => {
        // eslint-disable-next-line no-console
        console.log("[simxr] WebXR session 'end' event fired", {
          taskId: connectTaskId,
        });

        // 1. Cancel rAF — without this, a final requestAnimationFrame
        //    callback would try to draw into a torn-down XR layer.
        if (rafHandleRef.current) {
          try { xrSession.cancelAnimationFrame(rafHandleRef.current); } catch { /* ignore */ }
          rafHandleRef.current = 0;
        }
        // 2. Tear down the CloudXR session if it's still around. SDK
        //    no-ops a second teardown so this is safe even when
        //    onStreamStopped already ran.
        if (sessionRef.current) {
          void sessionRef.current.disconnect().catch(() => {});
          sessionRef.current.dispose?.();
          sessionRef.current = null;
        }
        // 3. Detach the off-screen WebGL2 canvas from step 3a so it
        //    doesn't leak across re-connects.
        if (canvasRef.current) {
          try { canvasRef.current.remove(); } catch { /* ignore */ }
          canvasRef.current = null;
        }
        xrSessionRef.current = null;

        // 4. Land in idle, but don't clobber a server-error state set by
        //    onStreamStopped — that's more informative than the followup
        //    'end' event that fires when we tear the WebXR session down
        //    in response to the error.
        setState((s) => (s === "error" ? "error" : "idle"));

        // 5. Fire the consumer's session-end callback exactly once.
        if (!sessionEndedFiredRef.current) {
          sessionEndedFiredRef.current = true;
          optsRef.current.onSessionEnded?.(connectTaskId);
        }
      });

      // Post-grant diagnostic — what features did Quest actually accept?
      // `enabledFeatures` is a WebXR proposal exposed by Quest 3 Browser
      // but not always typed in DOM lib; `domOverlayState` is part of
      // the dom-overlay module (https://immersive-web.github.io/dom-overlays).
      // Cast through `unknown` to a structural shape — avoids referencing
      // `XRSession` (already missing from lib config; same family as the
      // pre-existing 13 baseline tsc-errors that vite/esbuild strips).
      type SessionStateExtras = {
        enabledFeatures?: ReadonlyArray<string>;
        domOverlayState?: {
          type?: "screen" | "floating" | "head-locked" | "none";
        };
      };
      const sessionExtras = xrSession as unknown as SessionStateExtras;
      const enabledFeatures = sessionExtras.enabledFeatures ?? null;
      const domOverlayType = sessionExtras.domOverlayState?.type ?? null;
      const overlayGranted =
        domOverlayType === "screen" ||
        domOverlayType === "floating" ||
        domOverlayType === "head-locked";
      overlayGrantedRef.current = overlayGranted;
      // eslint-disable-next-line no-console
      console.log("[simxr] xrSession ready", {
        enabledFeatures,
        domOverlayType,
        overlayGranted,
        domOverlayRoot,
      });
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
          // 30 Mbps (was 150 — runtime / CF tunnel may reject too-greedy
          // sessions; NVIDIA's UI defaults are in this range).
          // 30 Mbps — reverted from 100 Mbps 2026-05-08 PT after CC's
          // cxr_server log analysis on simxr.app apex showed disconnect
          // loop: 216 cycles of NVST_R_BUSY + NVST_R_INVALID_OPERATION
          // + "Video stream disconnected: packed" + RTSP teardown when
          // running 100 Mbps + h265 together. The combination overwhelms
          // the server-side NVENC encoder pipeline — NVIDIA hosted
          // bundle's 100-150 Mbps default works because they pair it
          // with h264 (lower per-frame encode cost). Step-up plan: keep
          // 30 Mbps + h264 baseline, verify stability, then iterate
          // ONE axis at a time: h264 → h265 at 30 Mbps (isolate codec
          // cost), then if stable bump bitrate 30 → 50 → 100.
          maxStreamingBitrateKbps: 30_000,
          // h264 — reverted from h265 alongside the bitrate revert
          // above; same disconnect-loop root cause. Quest 3 supports
          // both decoders fine at the headset side; the issue is
          // server-side NVENC encoder budget. Per CC's plan we'll
          // re-attempt h265 at 30 Mbps as a SEPARATE iteration once
          // the baseline is verified stable.
          codec: "h264",
          // Reprojection grid — SDK validator allows undefined but the
          // server-side runtime appears to require these for session accept
          // (isaac log silence with undefined; CC's bundle.js shows :64).
          reprojectionGridCols: 64,
          reprojectionGridRows: 64,
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
          onStreamStarted: () => {
            setState("streaming");
            // ──────────────────────────────────────────────────────────
            // Auto-arm 'start teleop' with retry loop (added 2026-05-08).
            // ──────────────────────────────────────────────────────────
            //
            // Why retry: SDK populates `Session.availableMessageChannels`
            // ASYNCHRONOUSLY after the stream starts. The cxr_server log
            // emits `Client message channel is ready (code: 226)` ms-to-
            // seconds AFTER `onStreamStarted` fires. A single send call
            // here loses the race — channels array is still empty, no
            // legacy fallback exists, command silently goes nowhere,
            // server stays at running_recording_instance=False.
            //
            // Strategy: peek at session shape every 200ms; only invoke
            // the actual send (sendTeleopCommand) once either path is
            // detectably ready (channel found by UUID, or legacy method
            // exists). Prevents 30 consecutive "channel not found" warns
            // in chrome://inspect during the polling window. Bail on
            // session teardown or after maxAttempts (~6s ceiling).
            //
            // Operator-facing fallback (overlay Start button) remains
            // wired through the same sendTeleopCommand — works either
            // way the device supports overlays, retry handles the
            // headset-only path where overlay isn't usable.
            let attempts = 0;
            const maxAttempts = 30;       // 30 × 200ms = 6 s ceiling
            const intervalMs = 200;

            const tryStart = () => {
              attempts += 1;
              const sess = sessionRef.current;

              // Bail if the session was torn down between retries
              // (Quest exit gesture, server-side stop, error path).
              if (!sess) {
                // eslint-disable-next-line no-console
                console.info(
                  `[simxr] auto-arm aborted on attempt ${attempts} — session torn down during retry`,
                );
                return;
              }

              // First-attempt diagnostic — see what the SDK actually
              // exposes at the moment onStreamStarted fires. If channels
              // is undefined here AND legacy is undefined, it usually
              // means we're in the async-population window; subsequent
              // attempts should observe the channel appearing.
              if (attempts === 1) {
                // eslint-disable-next-line no-console
                console.info(
                  "[simxr] auto-arm attempt 1 — availableMessageChannels:",
                  sess.availableMessageChannels?.length ?? "undefined",
                  "· legacy sendServerMessage:",
                  typeof sess.sendServerMessage,
                );
              }

              // Peek: is anything send-capable yet? Probing here lets
              // us retry SILENTLY (no log spam) until SDK plumbing is
              // ready, then call sendTeleopCommand exactly once and
              // get its full diagnostic info-log.
              const channels = sess.availableMessageChannels;
              const channelReady =
                Array.isArray(channels) &&
                !!findChannelByUuid(channels, TELEOP_CHANNEL_UUID);
              const legacyReady =
                typeof sess.sendServerMessage === "function";

              if (channelReady || legacyReady) {
                const ok = sendTeleopCommand("start teleop");
                if (ok) {
                  // eslint-disable-next-line no-console
                  console.info(
                    `[simxr] auto-arm 'start teleop' delivered on attempt ${attempts} ` +
                      `(${(attempts - 1) * intervalMs}ms after onStreamStarted)`,
                  );
                  return;
                }
                // Send returned false despite the channel being present in
                // availableMessageChannels — the channel exists but is still
                // in MessageChannelStatus.NotInitialized state. cloudxr-js's
                // sendServerMessage in that state calls open() (sends a
                // CONTROL_MESSAGE_OPEN to the server) and returns false if
                // open() fails — typically because the underlying transport
                // hasn't completed the channel-open handshake yet (~100-500ms
                // after onStreamStarted). Reverse-engineered from NVIDIA
                // bundle.js MessageChannel.sendServerMessage state machine.
                // The previous version of this branch returned here on first
                // false, leaving cold-Kit + simxr.app sessions with the
                // robot frozen because attempt 1 raced the channel-open
                // handshake. Fall through to retry until either the open()
                // succeeds or maxAttempts elapses. Only logs a one-time warn
                // per false attempt — sendTeleopCommand itself produces the
                // detailed per-call diagnostic.
                // eslint-disable-next-line no-console
                console.warn(
                  `[simxr] auto-arm attempt ${attempts}: send returned false (channel may be NotInitialized), retrying`,
                );
                // fall through to the maxAttempts / setTimeout block below
              }

              if (attempts >= maxAttempts) {
                // eslint-disable-next-line no-console
                console.error(
                  `[simxr] auto-arm failed after ${attempts} attempts (${attempts * intervalMs}ms). ` +
                    `availableMessageChannels never populated AND no legacy sendServerMessage. ` +
                    `Operator may need to use NVIDIA hosted client to bootstrap, then return to simxr.app.`,
                );
                return;
              }
              window.setTimeout(tryStart, intervalMs);
            };
            tryStart();
          },
          onStreamStopped: (err) => {
            // 1. End the WebXR session so Quest exits immersive mode and
            //    lands the user back on the browser tab. Without this, the
            //    headset stays in VR after the server-side stream stops —
            //    user has to manually exit. Safe to call multiple times;
            //    the explicit disconnect() path also calls .end() and the
            //    SDK no-ops a second teardown.
            void xrSessionRef.current?.end()?.catch(() => {});
            xrSessionRef.current = null;
            // 2. Cancel rAF — same reason as in disconnect(). The next
            //    requestAnimationFrame inside the frame() closure would
            //    try to draw into a torn-down XR layer.
            rafHandleRef.current = 0;
            // 3. Detach the off-screen WebGL2 canvas attached in step 3a
            //    of connect(). Otherwise it leaks across re-connects.
            if (canvasRef.current) {
              try { canvasRef.current.remove(); } catch { /* ignore */ }
              canvasRef.current = null;
            }
            // 4. Surface the SDK's stop reason in state.
            if (err) {
              setError(`Stream ended unexpectedly: ${err.message}`);
              setState("error");
            } else {
              setState("idle");
            }
            // 5. Fire the user-provided callback last — Dashboard wires
            //    this to setLocation("/recordings?fresh=" + taskId) so
            //    the post-VR redirect kicks in for both clean and dirty
            //    stops (server crash mid-recording still navigates per
            //    the recordings-page brief). Guarded against double-fire
            //    when WebXR 'end' event also runs (xrSession.end() inside
            //    this same callback synchronously triggers the 'end'
            //    listener installed in connect(), which calls the same
            //    onSessionEnded path).
            if (!sessionEndedFiredRef.current) {
              sessionEndedFiredRef.current = true;
              optsRef.current.onSessionEnded?.(lastTaskIdRef.current);
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

      // Start the WebXR render loop — NVIDIA's CloudXR.js documented pattern.
      // Two method-calls per frame are MANDATORY:
      //   1. session.sendTrackingStateToServer(time, frame)
      //      Tells the server-side runtime where head/controllers are. Without
      //      this, server doesn't know it has a client and never starts
      //      encoding video. Diagnosed 2026-05-03 — earlier "empty rAF that
      //      just keeps the cycle alive" pattern (CC's first spec) caused
      //      isaac log silence + zero 1180b video frames in tcpdump.
      //   2. session.render(time, frame, baseLayer)
      //      SDK composites the decoded video into the XR layer's framebuffer.
      //      Without this, the SDK never draws pixels, headset stays black.
      //      The earlier purple-flag diagnostic confirmed our framebuffer/rAF
      //      chain was correct — SDK just wasn't being asked to draw.
      const frame = (time: number, xrFrame: XRFrame) => {
        const session = xrFrame.session;
        const layer = session.renderState.baseLayer;
        const cxr = sessionRef.current;
        if (cxr && layer) {
          try {
            // CRITICAL — bind the XR layer's framebuffer FIRST. SDK doesn't
            // do this itself; without the bind, render() draws into whatever
            // framebuffer was last bound (default = canvas backbuffer, not
            // the XR layer the headset reads from). Diagnosed 2026-05-03 —
            // server was streaming video, sendTracking was working, but
            // Quest stayed dark because composited frames went to nowhere
            // visible to the XR compositor. Bind pattern documented in
            // standard WebXR rendering loop + NVIDIA's CloudXR.js samples.
            gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
            cxr.sendTrackingStateToServer(time, xrFrame);
            cxr.render(time, xrFrame, layer);
          } catch {
            // SDK throws happen if session torn down mid-frame. Don't kill rAF.
          }
        }
        rafHandleRef.current = session.requestAnimationFrame(frame);
      };
      rafHandleRef.current = xrSession.requestAnimationFrame(frame);
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
    // Cancel rAF first so the SDK doesn't redraw into a tearing-down layer.
    if (rafHandleRef.current && xrSessionRef.current) {
      try { xrSessionRef.current.cancelAnimationFrame(rafHandleRef.current); } catch { /* ignore */ }
    }
    rafHandleRef.current = 0;
    try {
      await sessionRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sessionRef.current?.dispose?.();
    sessionRef.current = null;
    try {
      await xrSessionRef.current?.end();
    } catch {
      /* ignore */
    }
    xrSessionRef.current = null;
    // Detach the WebGL2 canvas we attached to body in step 3a.
    if (canvasRef.current) {
      try { canvasRef.current.remove(); } catch { /* ignore */ }
      canvasRef.current = null;
    }
    setState("idle");
  }, []);

  return { state, health, error, connect, disconnect, sendTeleopCommand };
}
