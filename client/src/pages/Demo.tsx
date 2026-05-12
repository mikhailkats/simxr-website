// Demo — public-facing simplified operator page.
//
// Hosted at /demo on both simxr.app and simxr.tech. Built 2026-05-12 as the
// investor / partner / demo-visitor surface — strips Connect.tsx down to a
// single hero showing whatever scene is currently live on the server, one
// large Connect button, and a friendly empty state when nothing is live.
//
// What this page deliberately does NOT do:
//   - Show the full 9+ scene catalog (Connect.tsx does that)
//   - Surface /recordings linkage (no redirect on session end)
//   - Expose dashboard / scene-controls / component-showcase
//   - Add nav, header links, or multi-tab UI
//
// Reuses useCloudXRSession.ts WITHOUT modification per CC handoff
// 2026-05-12 — the AV1 50Mbps + posePredictionFactor 1.5 + 4 defensive
// ?.catch() patterns + channel.status="Ready" probe are all reverse-
// engineered and must not regress. Only differences: healthPollMs=10000
// (slower than operator dashboard, public visitor doesn't need realtime),
// no onSessionEnded redirect.

import { Suspense, useEffect, useMemo, useState } from "react";
import { fetchScenes, type Scene } from "@/lib/scenes";
import { useCloudXRSession } from "@/lib/useCloudXRSession";
import { SCENE_ASSETS, skillTag, robotLabel } from "@/lib/scene_assets";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0B0F1A",
  color: "#E6EAF0",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  WebkitFontSmoothing: "antialiased",
  display: "flex",
  flexDirection: "column",
  padding: "24px 16px 20px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.6rem",
  marginBottom: 28,
};

const wordmark: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 700,
  fontSize: "1.15rem",
  letterSpacing: "-0.02em",
  color: "#E6EAF0",
};

const subtitle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.7rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  color: "#8B93A1",
};

const main: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 28,
  maxWidth: 720,
  margin: "0 auto",
  width: "100%",
};

const errorBanner: React.CSSProperties = {
  border: "1px solid #D97706",
  borderRadius: 8,
  background: "rgba(217,119,6,0.08)",
  padding: "12px 14px",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.78rem",
  lineHeight: 1.5,
  color: "#D97706",
};

const heroCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  background: "rgba(255,255,255,0.02)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const heroMedia: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  background: "#06080F",
  objectFit: "cover",
  display: "block",
};

const heroBody: React.CSSProperties = {
  padding: "24px 24px 28px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const liveTag: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  alignSelf: "flex-start",
  padding: "4px 10px 4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(77,128,255,0.4)",
  background: "rgba(77,128,255,0.08)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.65rem",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "#7BA1FF",
};

const livePulse: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#4D80FF",
  display: "inline-block",
  boxShadow: "0 0 0 0 rgba(77,128,255,0.7)",
  animation: "simxrDemoPulse 1.6s ease-out infinite",
};

const heroTitle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "1.85rem",
  fontWeight: 700,
  letterSpacing: "-0.015em",
  margin: 0,
  color: "#E6EAF0",
  lineHeight: 1.15,
};

const heroDescription: React.CSSProperties = {
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "#B7BEC9",
  margin: 0,
};

const tagsRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const tagChip: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.65rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#8B93A1",
  padding: "4px 10px",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 999,
  background: "rgba(255,255,255,0.02)",
};

const connectButton: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "16px 20px",
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "1.05rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "#0B0F1A",
  background: "#4D80FF",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  textAlign: "center",
  transition: "background 120ms ease, opacity 120ms ease",
};

const connectButtonDisabled: React.CSSProperties = {
  ...connectButton,
  background: "rgba(77,128,255,0.4)",
  color: "rgba(11,15,26,0.7)",
  cursor: "not-allowed",
};

const instructions: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.015)",
  padding: "18px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const instructionsTitle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.7rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#8B93A1",
  margin: 0,
};

const instructionsList: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: "0.9rem",
  lineHeight: 1.55,
  color: "#B7BEC9",
};

const idleCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: "36px 28px",
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const idleStatus: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.7rem",
  fontWeight: 500,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "#8B93A1",
};

const idleDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#8B93A1",
  opacity: 0.7,
  display: "inline-block",
};

const idleTitle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "1.55rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: 0,
  color: "#E6EAF0",
};

const idleBody: React.CSSProperties = {
  fontSize: "0.98rem",
  lineHeight: 1.6,
  color: "#8B93A1",
  margin: 0,
};

const idleLink: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.78rem",
  color: "#4D80FF",
  textDecoration: "none",
  marginTop: 6,
};

const footer: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 14,
  marginTop: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.65rem",
  color: "#8B93A1",
  letterSpacing: "0.05em",
  opacity: 0.75,
};

// Inline CSS for the pulse keyframes — keeps the page entirely self-contained
// without touching the global Tailwind / typography setup. Same trick Connect.tsx
// uses for Fonts(). Animation is decorative; degrades cleanly if disabled.
function PulseKeyframes() {
  return (
    <style>{`
      @keyframes simxrDemoPulse {
        0%   { box-shadow: 0 0 0 0 rgba(77,128,255,0.55); }
        70%  { box-shadow: 0 0 0 8px rgba(77,128,255,0); }
        100% { box-shadow: 0 0 0 0 rgba(77,128,255,0); }
      }
    `}</style>
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
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap"
      />
      {/* noindex on the demo page itself — when a session is live the title
          reflects the live scene id, which we don't want crawlers caching. */}
      <meta name="robots" content="noindex, nofollow" />
    </>
  );
}

// Hero media: prefer the SCENE_ASSETS entry; fall back to a generic poster
// so an uncatalogued live_scene still renders cleanly. Videos play looped
// + muted + inline (mobile-safe), with the poster as the still while loading.
function HeroMedia({ sceneId }: { sceneId: string }) {
  const asset = SCENE_ASSETS[sceneId];
  if (!asset) {
    return (
      <div
        style={{
          ...heroMedia,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#3A4252",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.85rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Live SIM XR Demo
      </div>
    );
  }
  if (asset.type === "video") {
    return (
      <video
        style={heroMedia}
        src={asset.src}
        poster={asset.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
    );
  }
  return <img style={heroMedia} src={asset.src} alt="" loading="lazy" />;
}

export default function Demo() {
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [scenesError, setScenesError] = useState<string | null>(null);

  // Public visitor — polling slower (10s) than the operator dashboard.
  // No onSessionEnded callback: when WebXR ends we just close cleanly,
  // we do NOT redirect to /recordings (per CC handoff 2026-05-12).
  const session = useCloudXRSession({ healthPollMs: 10000 });

  useEffect(() => {
    let cancelled = false;
    fetchScenes()
      .then((s) => {
        if (!cancelled) setScenes(s);
      })
      .catch((e) => {
        if (!cancelled) setScenesError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const liveSceneId = session.health?.live_scene ?? null;
  const liveScene = useMemo(() => {
    if (!liveSceneId || !scenes) return null;
    return scenes.find((s) => s.id === liveSceneId) ?? null;
  }, [liveSceneId, scenes]);

  // Compute display title + description. When live_scene exists but the
  // scene catalog hasn't loaded yet (or the id isn't in scenes.yaml), we
  // still show the live card with a generic title so the visitor isn't
  // staring at a blank page during the brief fetch window.
  const displayTitle =
    liveScene?.name && liveScene.name !== liveScene.id
      ? liveScene.name
      : liveSceneId
        ? "Live SIM XR Demo"
        : null;

  const displayDescription =
    liveScene?.description ??
    (liveSceneId
      ? "A humanoid robot is loaded in an immersive 3D scene. Connect your Quest 3 to step in and teleoperate it directly."
      : null);

  // Card state for the live scene — most public visitors will see one of
  // these three:
  //   live-ready: server reachable, scene loaded, no operator currently connected
  //   live-busy:  another operator is in the session right now
  //   broken:     the scene catalog marked this scene as broken (rare)
  //   idle:       nothing live, show the friendly "not active" card
  const sessionInFlight =
    session.state !== "idle" && session.state !== "error";

  const showIdle =
    !sessionInFlight &&
    (scenesError !== null || (scenes !== null && !liveSceneId));

  const isBusy =
    !!liveSceneId &&
    session.health?.session_state === "streaming" &&
    (session.health?.active_clients ?? 0) > 0;

  // Connect button label tracks the session lifecycle so the visitor sees
  // useful state during the multi-second connecting -> streaming chain.
  const connectLabel = (() => {
    switch (session.state) {
      case "preflight":
        return "Reaching server…";
      case "requesting-xr":
        return "Opening VR…";
      case "connecting":
        return "Connecting…";
      case "connected":
      case "streaming":
        return "In VR";
      case "disconnecting":
        return "Disconnecting…";
      default:
        return isBusy ? "In session — try again in a moment" : "Connect Your Quest";
    }
  })();

  const connectDisabled =
    sessionInFlight ||
    isBusy ||
    !liveSceneId ||
    (liveScene?.status === "broken");

  return (
    <Suspense fallback={null}>
      <Fonts />
      <PulseKeyframes />
      <div style={pageStyle}>
        <header style={headerStyle}>
          <span style={wordmark}>
            SIM <span style={{ color: "#4D80FF" }}>XR.</span>
          </span>
          <span style={subtitle}>/&nbsp;DEMO</span>
        </header>

        <main style={main}>
          {session.error && <div style={errorBanner}>{session.error}</div>}

          {liveSceneId && displayTitle ? (
            <section style={heroCard}>
              <HeroMedia sceneId={liveSceneId} />
              <div style={heroBody}>
                <span style={liveTag}>
                  <span style={livePulse} aria-hidden="true" />
                  {isBusy ? "In session" : "Live now"}
                </span>
                <h1 style={heroTitle}>{displayTitle}</h1>
                {displayDescription && (
                  <p style={heroDescription}>{displayDescription}</p>
                )}
                <div style={tagsRow}>
                  <span style={tagChip}>{robotLabel(liveSceneId)}</span>
                  <span style={tagChip}>{skillTag(liveSceneId)}</span>
                </div>
                <button
                  type="button"
                  style={connectDisabled ? connectButtonDisabled : connectButton}
                  disabled={connectDisabled}
                  onClick={() => {
                    if (!connectDisabled) void session.connect(liveSceneId);
                  }}
                >
                  {connectLabel}
                </button>
              </div>
            </section>
          ) : null}

          {liveSceneId && displayTitle && (
            <section style={instructions}>
              <h2 style={instructionsTitle}>What you'll need</h2>
              <ul style={instructionsList}>
                <li>· Meta Quest 3 (or Quest 3S / Quest Pro)</li>
                <li>· The Meta Browser app open on the headset</li>
                <li>· Navigate to <strong>simxr.app/demo</strong>, tap Connect</li>
                <li>· Pop into VR and you're teleoperating the robot</li>
              </ul>
            </section>
          )}

          {showIdle && (
            <section style={idleCard}>
              <div style={idleStatus}>
                <span style={idleDot} aria-hidden="true" />
                Demo not active right now
              </div>
              <h1 style={idleTitle}>
                Nothing is live in the simulation right now.
              </h1>
              <p style={idleBody}>
                SIM XR turns consumer VR headsets into a teleoperation workforce
                for humanoid robots. Live demos run by appointment — get in
                touch with the team to schedule a session.
              </p>
              <a href="https://simxr.tech" style={idleLink}>
                Learn more on simxr.tech →
              </a>
            </section>
          )}
        </main>

        <footer style={footer}>
          <span>
            UPDATED{" "}
            {session.health?.ts
              ? new Date(session.health.ts).toISOString().slice(0, 19) + "Z"
              : "—"}
          </span>
          <span style={{ color: "#E6EAF0" }}>
            {session.health?.live_scene ? "live" : "idle"}
            {session.health ? ` · ${session.health.active_clients} client(s)` : ""}
          </span>
          <span style={{ flex: 1, textAlign: "right" }}>
            powered by NVIDIA CloudXR
          </span>
        </footer>
      </div>
    </Suspense>
  );
}
