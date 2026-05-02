// SceneCard — visual card matching the v1 dark theme.
//
// Card visual states (derived from Scene.status + Healthz via computeCardState):
//   - live-ready → accent border + LIVE badge + Connect button (visitor can join)
//   - live-busy  → accent border + IN-SESSION badge + wait time + disabled button
//                  (v2 will swap this for "Join queue"; v1.5 just signals)
//   - offline    → muted, "Currently offline" subtitle, no button
//   - broken     → warning border + struck-through name + note

import type { CardState, Healthz, Scene } from "@/lib/scenes";
import { formatWaitTime, isUncurated } from "@/lib/scenes";
import type { UiSessionState } from "@/lib/useCloudXRSession";

export interface SceneCardProps {
  scene: Scene;
  cardState: CardState;
  health: Healthz | null;
  sessionState: UiSessionState;
  onConnect: () => void;
}

const cardBase: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 20,
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minHeight: 200,
  position: "relative",
  transition: "all 0.15s ease",
};

const cardLiveReady: React.CSSProperties = {
  borderColor: "#0057FF",
  background: "rgba(0, 87, 255, 0.08)",
};

const cardLiveBusy: React.CSSProperties = {
  borderColor: "#4D80FF",
  background: "rgba(0, 87, 255, 0.04)",
};

const cardOffline: React.CSSProperties = { opacity: 0.6 };

const cardBroken: React.CSSProperties = {
  borderColor: "#D97706",
  background: "rgba(217, 119, 6, 0.06)",
  opacity: 0.85,
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.6rem",
  fontWeight: 500,
  letterSpacing: "0.15em",
  padding: "4px 8px",
  borderRadius: 4,
  textTransform: "uppercase",
  width: "fit-content",
};

const badgeLive: React.CSSProperties = {
  ...badgeBase,
  color: "#FFFFFF",
  background: "#0057FF",
};

const badgeBusy: React.CSSProperties = {
  ...badgeBase,
  color: "#0057FF",
  background: "rgba(0, 87, 255, 0.15)",
  border: "1px solid rgba(0, 87, 255, 0.4)",
};

const sceneName: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "1.1rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: 0,
  color: "#E6EAF0",
};

// Uncurated cards (name === id) get a monospace raw-id treatment. Visual cue
// to the team that this scene was auto-discovered from gym.register and
// hasn't been given a friendly display name in scenes.yaml yet.
const sceneNameRaw: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.9rem",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  margin: 0,
  color: "#E6EAF0",
  wordBreak: "break-all",
};

const sceneNameBroken: React.CSSProperties = {
  ...sceneName,
  textDecoration: "line-through",
  color: "#D97706",
};

const sceneDescription: React.CSSProperties = {
  fontSize: "0.92rem",
  lineHeight: 1.5,
  color: "#8B93A1",
  margin: 0,
  flex: 1,
};

const sceneStatus: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.75rem",
  color: "#8B93A1",
  margin: 0,
};

const sceneStatusBroken: React.CSSProperties = {
  ...sceneStatus,
  color: "#D97706",
  fontWeight: 500,
};

const sceneStatusBusy: React.CSSProperties = {
  ...sceneStatus,
  color: "#4D80FF",
  fontWeight: 500,
};

const sceneNote: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.8rem",
  lineHeight: 1.4,
  color: "#D97706",
  margin: 0,
  paddingTop: 8,
  borderTop: "1px solid rgba(217, 119, 6, 0.3)",
};

const ctaConnect: React.CSSProperties = {
  display: "inline-block",
  padding: "14px 28px",
  background: "#0057FF",
  color: "#FFFFFF",
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  borderRadius: 8,
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
  transition: "background 0.15s ease, transform 0.05s ease",
  alignSelf: "flex-start",
};

const ctaBusy: React.CSSProperties = {
  ...ctaConnect,
  background: "rgba(139, 147, 161, 0.3)",
  color: "#8B93A1",
  cursor: "not-allowed",
  border: "1px solid rgba(255, 255, 255, 0.08)",
};

const ctaInFlight: React.CSSProperties = {
  ...ctaConnect,
  background: "#8B93A1",
  cursor: "wait",
};

function ctaLabel(state: UiSessionState): string {
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
      return "Disconnecting…";
    default:
      return "Connect";
  }
}

function busyLabel(health: Healthz | null): string {
  const wait = formatWaitTime(health?.wait_time_seconds);
  if (wait) return `In use — try again in ${wait}`;
  return "In use right now";
}

export function SceneCard({ scene, cardState, health, sessionState, onConnect }: SceneCardProps) {
  const sessionInFlight =
    sessionState !== "idle" && sessionState !== "error";

  let cardStyle = { ...cardBase };
  if (cardState === "live-ready") cardStyle = { ...cardStyle, ...cardLiveReady };
  else if (cardState === "live-busy") cardStyle = { ...cardStyle, ...cardLiveBusy };
  else if (cardState === "offline") cardStyle = { ...cardStyle, ...cardOffline };
  else if (cardState === "broken") cardStyle = { ...cardStyle, ...cardBroken };

  return (
    <div style={cardStyle}>
      {cardState === "live-ready" && <div style={badgeLive}>Live</div>}
      {cardState === "live-busy" && <div style={badgeBusy}>In session</div>}

      <h2
        style={
          cardState === "broken"
            ? sceneNameBroken
            : isUncurated(scene)
              ? sceneNameRaw
              : sceneName
        }
      >
        {scene.name}
      </h2>
      {scene.description && (
        <p style={sceneDescription}>{scene.description}</p>
      )}
      {!scene.description && !isUncurated(scene) && (
        <p style={sceneDescription}>&nbsp;</p>
      )}
      {isUncurated(scene) && cardState !== "broken" && (
        <p style={{ ...sceneStatus, fontSize: "0.7rem", opacity: 0.7 }}>
          // not yet curated · add an override in scenes.yaml
        </p>
      )}

      {cardState === "live-ready" && (
        <button
          type="button"
          style={sessionInFlight ? ctaInFlight : ctaConnect}
          onClick={onConnect}
          disabled={sessionInFlight}
        >
          {ctaLabel(sessionState)}
        </button>
      )}

      {cardState === "live-busy" && (
        <>
          <p style={sceneStatusBusy}>{busyLabel(health)}</p>
          <button
            type="button"
            style={ctaBusy}
            disabled
            title="Queue coming in v2 — for now, refresh the page when the session ends"
          >
            Join queue · soon
          </button>
        </>
      )}

      {cardState === "offline" && (
        <p style={sceneStatus}>Currently offline</p>
      )}

      {cardState === "broken" && (
        <>
          <p style={sceneStatusBroken}>Unavailable</p>
          {scene.note && <p style={sceneNote}>{scene.note}</p>}
        </>
      )}
    </div>
  );
}
