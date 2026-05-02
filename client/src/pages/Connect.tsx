// Connect — simxr.app apex (and simxr.tech/connect direct-link backup), inline @nvidia/cloudxr.
//
// Visitor flow:
//   1. Page loads → fetches /api/scenes.json + polls /api/healthz every 5s (api.simxr.app)
//   2. Visitor taps Connect on the live scene card
//   3. Page calls navigator.xr.requestSession (user gesture) → CloudXR.createSession → connect
//   4. Visitor walks into VR — single tap.
//
// Fallback: /connect-classic still serves the v1 multi-scene picker that
// uses the NVIDIA-hosted IsaacTeleop client via Netlify proxy. If v1.5 has
// issues during initial rollout, route Quest visitors to /connect-classic.

import { Suspense, useEffect, useMemo, useState } from "react";
import { computeCardState, fetchScenes, type Scene } from "@/lib/scenes";
import { useCloudXRSession } from "@/lib/useCloudXRSession";
import { SceneCard } from "@/components/SceneCard";

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
  marginBottom: 32,
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
  gap: 24,
  maxWidth: 600,
  margin: "0 auto",
  width: "100%",
};

const eyebrow: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.7rem",
  fontWeight: 500,
  letterSpacing: "0.18em",
  color: "#8B93A1",
  textTransform: "uppercase",
  margin: 0,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
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

// Friendly "between sessions" card — shown when no scene is currently live.
// Replaces the old terse "All Scenes Offline" notice with something that
// orients first-time visitors who don't yet know what SIM XR is.
const betweenSessionsCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: "28px 24px",
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const betweenStatus: React.CSSProperties = {
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

const pulseDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#4D80FF",
  opacity: 0.7,
  display: "inline-block",
};

const betweenTitle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "1.4rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: 0,
  color: "#E6EAF0",
};

const betweenBody: React.CSSProperties = {
  fontSize: "0.95rem",
  lineHeight: 1.6,
  color: "#8B93A1",
  margin: 0,
};

const betweenLink: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.78rem",
  color: "#4D80FF",
  textDecoration: "none",
  marginTop: 4,
};

const footer: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 14,
  marginTop: 32,
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

function Fonts() {
  // Inject the same Google Fonts the static template used so the page
  // matches v1's brand exactly without depending on the rest of simxr.tech's
  // Tailwind/typography setup.
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
      <meta name="robots" content="noindex, nofollow" />
    </>
  );
}

export default function Connect() {
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [scenesError, setScenesError] = useState<string | null>(null);
  const session = useCloudXRSession();

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

  // Pre-compute card state per scene so sort + render share the same source of truth.
  const decorated = useMemo(() => {
    if (!scenes) return [];
    return scenes.map((s) => ({
      scene: s,
      state: computeCardState(s, session.health),
    }));
  }, [scenes, session.health]);

  const sortedScenes = useMemo(() => {
    // Order: live-ready (visitor's tappable card) → live-busy → offline → broken.
    const order: Record<string, number> = {
      "live-ready": 0,
      "live-busy": 1,
      offline: 2,
      broken: 3,
    };
    return [...decorated].sort(
      (a, b) => (order[a.state] ?? 99) - (order[b.state] ?? 99),
    );
  }, [decorated]);

  // Show the friendly "between sessions" card when:
  //  - server is unreachable (scenesError) — likely offline / starting up
  //  - server is reachable but no scene is currently live (liveSceneId === null)
  //  - the visitor isn't already in a session (session.state === "idle" / "error")
  // Treats both "server offline" and "no live scene" as the same product state
  // ("between sessions") because that's what a visitor experiences either way.
  const sessionInFlight = session.state !== "idle" && session.state !== "error";
  const showBetweenSessions =
    !sessionInFlight && (scenesError !== null || (scenes !== null && liveSceneId === null));

  return (
    <Suspense fallback={null}>
      <Fonts />
      <div style={pageStyle}>
        <header style={headerStyle}>
          <span style={wordmark}>
            SIM <span style={{ color: "#4D80FF" }}>XR.</span>
          </span>
          <span style={subtitle}>/&nbsp;CONNECT</span>
        </header>

        <main style={main}>
          {/* Real session error (e.g. WebXR rejected, CloudXR connect failed) — keep as banner */}
          {session.error && <div style={errorBanner}>{session.error}</div>}

          {showBetweenSessions && (
            <section style={betweenSessionsCard}>
              <div style={betweenStatus}>
                <span style={pulseDot} aria-hidden="true" />
                Currently between sessions
              </div>
              <h1 style={betweenTitle}>
                The VR demo isn't live right now.
              </h1>
              <p style={betweenBody}>
                SIM XR turns consumer VR headsets into a training ground for humanoid robots.
                When a scene is loaded, you'll see a Connect button below — put on your headset,
                tap once, and step into the simulation. Sessions are scheduled with the team.
              </p>
              <a href="https://simxr.tech" style={betweenLink}>
                Learn more on simxr.tech →
              </a>
            </section>
          )}

          <div style={eyebrow}>
            {liveSceneId ? "Live session" : "Scene catalog"}
          </div>

          {scenes && (
            <div style={grid}>
              {sortedScenes.map(({ scene, state }) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  cardState={state}
                  health={session.health}
                  sessionState={session.state}
                  onConnect={() => void session.connect()}
                />
              ))}
            </div>
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
