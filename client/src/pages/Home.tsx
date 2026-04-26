import { useEffect, useState } from "react";

// Local image assets — moved off Manus CloudFront 2026-04-27.
const SIMULATION_SCENE = "/images/simulation_scene.webp";
const VR_USER = "/images/vr_user.jpg";
const FOUNDER_PHOTO = "/images/founder_georgy.jpg";

// ─── Netlify Forms helper ───────────────────────────────────────
// SPA-friendly submission: serializes to application/x-www-form-urlencoded
// and POSTs to "/", which Netlify intercepts when a matching <form name>
// is present in the build-time HTML (see hidden forms in client/index.html).
function netlifySubmit(formName: string, fields: Record<string, string>) {
  const body = new URLSearchParams({ "form-name": formName, ...fields }).toString();
  return fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

// ─── Form input style ───────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.9rem",
  border: "1.5px solid #E5E7EB",
  borderRadius: "8px",
  fontSize: "0.88rem",
  fontFamily: "'DM Sans', sans-serif",
  color: "#0B0F1A",
  background: "#FAFAFA",
  outline: "none",
  boxSizing: "border-box" as const,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "0.35rem",
  letterSpacing: "0.02em",
};

function EarlyAccessForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [form, setForm] = useState({ name: "", company: "", email: "", task: "", demos: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await netlifySubmit("early-access", form);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#0B0F1A", marginBottom: "0.4rem" }}>Request received!</div>
        <p style={{ color: "#6B7280", fontSize: "0.88rem" }}>We'll reach out if your use case fits the platform.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Name <span style={{ color: "#EF4444" }}>*</span></label>
          <input required style={inputStyle} placeholder="Your name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Company <span style={{ color: "#EF4444" }}>*</span></label>
          <input required style={inputStyle} placeholder="Company name" value={form.company}
            onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Email <span style={{ color: "#EF4444" }}>*</span></label>
        <input required type="email" style={inputStyle} placeholder="you@company.com" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>What robot or task are you working on? <span style={{ color: "#EF4444" }}>*</span></label>
        <textarea required rows={3} style={{ ...inputStyle, resize: "vertical" }}
          placeholder="e.g. Franka Panda pick-and-place, humanoid manipulation, mobile robot navigation..."
          value={form.task} onChange={e => setForm(f => ({ ...f, task: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>How many demonstrations do you need per task?</label>
        <input style={inputStyle} placeholder="e.g. 100–500 demos per task" value={form.demos}
          onChange={e => setForm(f => ({ ...f, demos: e.target.value }))} />
      </div>
      <button type="submit" disabled={status === "sending"} style={{
        width: "100%", padding: "0.85rem",
        background: status === "sending" ? "#93C5FD" : "#0057FF",
        color: "#fff", border: "none", borderRadius: "8px",
        fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.9rem",
        cursor: status === "sending" ? "not-allowed" : "pointer",
        letterSpacing: "0.02em",
      }}>
        {status === "sending" ? "Sending…" : "Request Early Access →"}
      </button>
      {status === "error" && <p style={{ color: "#EF4444", fontSize: "0.82rem", textAlign: "center" }}>Something went wrong. Please email gm@simxr.tech directly.</p>}
      <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#9CA3AF" }}>We'll reach out if your use case fits the platform.</p>
    </form>
  );
}

function CollaboratorForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [form, setForm] = useState({ name: "", email: "", area: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await netlifySubmit("collaboration", form);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#0B0F1A", marginBottom: "0.4rem" }}>Message sent!</div>
        <p style={{ color: "#6B7280", fontSize: "0.88rem" }}>We'll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Name <span style={{ color: "#EF4444" }}>*</span></label>
          <input required style={inputStyle} placeholder="Your name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Email <span style={{ color: "#EF4444" }}>*</span></label>
          <input required type="email" style={inputStyle} placeholder="you@example.com" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Area of Interest <span style={{ color: "#EF4444" }}>*</span></label>
        <select required value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
          style={{ ...inputStyle, appearance: "auto" }}>
          <option value="">Select your area...</option>
          <option value="XR / VR">XR / VR</option>
          <option value="Robotics">Robotics</option>
          <option value="ML / Imitation Learning">ML / Imitation Learning</option>
          <option value="Simulation">Simulation</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>Tell us about yourself (optional)</label>
        <textarea rows={4} style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Background, project, or what you'd like to work on..."
          value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
      </div>
      <button type="submit" disabled={status === "sending"} style={{
        width: "100%", padding: "0.85rem",
        background: status === "sending" ? "#C4B5FD" : "#7C3AED",
        color: "#fff", border: "none", borderRadius: "8px",
        fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.9rem",
        cursor: status === "sending" ? "not-allowed" : "pointer",
        letterSpacing: "0.02em",
      }}>
        {status === "sending" ? "Sending…" : "Contact →"}
      </button>
      {status === "error" && <p style={{ color: "#EF4444", fontSize: "0.82rem", textAlign: "center" }}>Something went wrong. Please email gm@simxr.tech directly.</p>}
    </form>
  );
}

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ─── Design tokens ───────────────────────────────────────────────
const C = {
  blue: "#0057FF",
  blueLight: "#EBF1FF",
  navy: "#0B0F1A",
  gray: "#6B7280",
  grayLight: "#F5F6F8",
  border: "#E5E7EB",
  white: "#FFFFFF",
  green: "#16A34A",
  greenLight: "#F0FDF4",
};

const T = {
  display: "'DM Sans', sans-serif",
  label: "'Space Grotesk', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export default function Home() {
  useReveal();

  return (
    <div style={{ background: C.white, color: C.navy, fontFamily: T.display }}>

      {/* ── NAV ── */}
      <nav
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 2.5rem", height: "60px",
        }}
      >
        <span style={{ fontFamily: T.label, fontWeight: 700, fontSize: "1.15rem", color: C.navy, letterSpacing: "-0.02em" }}>
          SIM <span style={{ color: C.blue }}>XR.</span>
        </span>
        <div style={{ display: "flex", gap: "2rem" }} className="hidden md:flex">
          {["Problem", "Solution", "Market Timing", "How It Works", "Vision", "Founder"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              style={{ fontFamily: T.label, fontSize: "0.82rem", fontWeight: 500, color: C.gray, textDecoration: "none", letterSpacing: "0.01em" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.navy)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.gray)}
            >
              {item}
            </a>
          ))}
        </div>
        <a
          href="mailto:gm@simxr.tech"
          style={{
            fontFamily: T.label, fontWeight: 600, fontSize: "0.82rem",
            color: C.white, background: C.navy,
            padding: "0.45rem 1.1rem", borderRadius: "6px",
            textDecoration: "none", letterSpacing: "0.02em",
          }}
        >
          Contact
        </a>
      </nav>

      {/* ── HERO ── */}
      <section
        id="hero"
        style={{
          paddingTop: "120px",
          paddingBottom: "100px",
          background: C.white,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Subtle blue blob — top right */}
        <div
          style={{
            position: "absolute", top: "-80px", right: "-120px",
            width: "600px", height: "600px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,87,255,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
          <div>
            <div className="label-tag" style={{ marginBottom: "1.25rem" }}>Physical AI Infrastructure</div>
            <h1
              style={{
                fontFamily: T.display, fontWeight: 800,
                fontSize: "clamp(2.6rem, 5vw, 4.2rem)",
                lineHeight: 1.06, letterSpacing: "-0.04em",
                color: C.navy, marginBottom: "1.25rem",
              }}
            >
              The Training Layer<br />
              <span style={{ color: C.blue }}>for Physical AI.</span>
            </h1>
            <p
              style={{
                fontSize: "1.05rem", color: C.gray,
                lineHeight: 1.7, maxWidth: "480px",
                marginBottom: "2.25rem",
              }}
            >
              We turn millions of consumer XR headsets into a scalable, gamified training ground for robots
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <a
                href="#solution"
                style={{
                  fontFamily: T.label, fontWeight: 600, fontSize: "0.88rem",
                  color: C.white, background: C.navy,
                  padding: "0.7rem 1.6rem", borderRadius: "7px",
                  textDecoration: "none", letterSpacing: "0.01em",
                }}
              >
                See How It Works
              </a>
              <a
                href="mailto:gm@simxr.tech"
                style={{
                  fontFamily: T.label, fontWeight: 600, fontSize: "0.88rem",
                  color: C.navy, background: C.white,
                  border: `1.5px solid ${C.border}`,
                  padding: "0.7rem 1.6rem", borderRadius: "7px",
                  textDecoration: "none", letterSpacing: "0.01em",
                }}
              >
                Get in Touch
              </a>
            </div>
          </div>

          {/* Hero visual — stats card */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                background: C.grayLight,
                borderRadius: "16px",
                overflow: "hidden",
                border: `1px solid ${C.border}`,
              }}
            >
              <img
                src={VR_USER}
                alt="VR operator"
                style={{ width: "100%", height: "340px", objectFit: "contain", objectPosition: "center top" }}
              />
              <div style={{ padding: "1.5rem 1.75rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", borderTop: `1px solid ${C.border}` }}>
                {[
                  { num: "500K+", label: "Robots by 2030" },
                  { num: "100M+", label: "Episodes needed" },
                  { num: "1/10th", label: "Cost vs teleop" },
                ].map((s) => (
                  <div key={s.num}>
                    <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: "1.5rem", color: C.blue, lineHeight: 1 }}>{s.num}</div>
                    <div style={{ fontFamily: T.label, fontSize: "0.7rem", color: C.gray, marginTop: "0.3rem", letterSpacing: "0.02em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section id="problem" style={{ padding: "100px 0", background: C.grayLight, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ maxWidth: "600px", marginBottom: "3.5rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>The Challenge</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.navy, marginBottom: "0.75rem", lineHeight: 1.15 }}>
              The Data Bottleneck
            </h2>
            <p style={{ color: C.gray, fontSize: "1.125rem", lineHeight: 1.7, maxWidth: "700px" }}>
              Physical AI is exploding, but real-world teleoperation cannot keep up with the demand.<br />AI still requires human validation, but doing this in the physical world is incredibly slow.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5px", background: C.border, borderRadius: "12px", overflow: "hidden" }}>
            {[
              {
                num: "01",
                title: "Resource-Intensive & Costly",
                body: "Real-world teleoperation requires specialized hardware, lab setups, and trained operators.",
              },
              {
                num: "02",
                title: "A Throughput Bottleneck",
                body: "One operator teaches one skill — but that skill must be demonstrated hundreds or thousands of times before a model can generalize.",
              },
              {
                num: "03",
                title: "Video Data Lacks Physics",
                body: "Vast egocentric and internet-scale video cannot capture the physical logic of manipulation.",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="reveal"
                style={{
                  background: C.white,
                  padding: "2.5rem 2rem",
                  transitionDelay: `${i * 0.1}s`,
                }}
              >
                <div style={{ fontFamily: T.mono, fontSize: "0.7rem", color: C.blue, marginBottom: "1.25rem", letterSpacing: "0.1em" }}>{card.num}</div>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: "1rem", color: C.navy, marginBottom: "0.75rem", lineHeight: 1.35 }}>{card.title}</div>
                <p style={{ color: C.gray, fontSize: "0.88rem", lineHeight: 1.65 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT WE BUILD ── */}
      <section id="what-we-build" style={{ padding: "100px 0", background: C.navy, borderTop: `1px solid rgba(255,255,255,0.08)` }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem", background: "rgba(0,87,255,0.2)", color: "#6FA3FF", borderColor: "rgba(0,87,255,0.3)" }}>What We Build</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: "#FFFFFF", marginBottom: "1rem", lineHeight: 1.15 }}>
              The missing layer between<br />
              <span style={{ color: C.blue }}>VR gameplay and robot intelligence</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "1.05rem", maxWidth: "620px", margin: "0 auto", lineHeight: 1.7 }}>
              Today, robotics companies hire gig workers to record themselves doing chores with iPhones strapped to their heads — $15/hr, limited variety, privacy concerns, and no physics ground-truth. We replace that with something fundamentally better.
            </p>
          </div>

          {/* Three-column contrast */}
          <div className="reveal" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "2rem", alignItems: "stretch", marginBottom: "4rem" }}>
            {/* Left: old way */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "2rem" }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1.25rem" }}>Today's approach</div>
              {[
                { icon: "📱", text: "Gig workers with iPhones on their heads" },
                { icon: "🏠", text: "Limited home environments, repetitive tasks" },
                { icon: "⚠️", text: "No physics ground-truth, sim-to-real gap" },
                { icon: "🔒", text: "Privacy concerns, low worker engagement" },
                { icon: "📉", text: "Bottleneck: can't scale beyond home settings" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.9rem" }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "0.1rem" }}>{item.icon}</span>
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.88rem", lineHeight: 1.55 }}>{item.text}</span>
                </div>
              ))}
            </div>

            {/* Center divider */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0 0.5rem" }}>
              <div style={{ width: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }} />
              <div style={{ background: C.blue, color: "#fff", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", padding: "0.5rem 0.75rem", borderRadius: "999px", whiteSpace: "nowrap" }}>VS</div>
              <div style={{ width: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }} />
            </div>

            {/* Right: SIM XR */}
            <div style={{ background: "rgba(0,87,255,0.1)", border: "1px solid rgba(0,87,255,0.3)", borderRadius: "16px", padding: "2rem" }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: C.blue, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1.25rem" }}>SIM XR approach</div>
              {[
                { icon: "🎮", text: "Consumer VR headsets — workers play, not perform chores" },
                { icon: "🌍", text: "Infinite simulated environments, any task, any variation" },
                { icon: "⚙️", text: "Physics-grounded via NVIDIA Isaac Lab — zero sim gap" },
                { icon: "🏆", text: "Gamified engagement — workers want to come back" },
                { icon: "📈", text: "Scales to millions of episodes per day, globally" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.9rem" }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "0.1rem" }}>{item.icon}</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.88rem", lineHeight: 1.55 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: the three-step loop */}
          <div className="reveal" style={{ transitionDelay: "0.1s" }}>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Space Grotesk', sans-serif", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>How it compounds</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
              {[
                { step: "01", title: "Integrate", body: "Robotics teams define tasks in our simulation environment. SDK connects to ROS/ROS2 in days, not months." },
                { step: "02", title: "Play & Collect", body: "Workers worldwide complete tasks through VR gameplay. Every session generates validated, physics-grounded demonstrations." },
                { step: "03", title: "Evolve", body: "Each demonstration trains the policy. The robot learns, makes fewer mistakes, and requests harder tasks. Autonomy compounds." },
              ].map((s, i) => (
                <div key={i} style={{ borderTop: `2px solid ${i === 1 ? C.blue : "rgba(255,255,255,0.15)"}`, paddingTop: "1.5rem" }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: i === 1 ? C.blue : "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>{s.step}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.5rem" }}>{s.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", lineHeight: 1.65 }}>{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SOLUTION ── */}
      <section id="solution" style={{ padding: "100px 0", background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
            <div className="reveal">
              <div className="label-tag" style={{ marginBottom: "0.75rem" }}>The Sweet Spot</div>
              <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.navy, marginBottom: "1rem", lineHeight: 1.15 }}>
                Cheaper than Teleop.<br />
                <span style={{ color: C.blue }}>Better than Pure Sim.</span>
              </h2>
              <p style={{ color: C.gray, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem" }}>
                SIM XR captures real human intelligence — the way people naturally grasp, manipulate, and reason — inside a physics-accurate virtual environment. The result: high-quality training data at a fraction of the cost.
              </p>

              {/* Comparison table */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: C.grayLight, padding: "0.6rem 1rem", borderBottom: `1px solid ${C.border}` }}>
                  {["", "Real Teleop", "VR-SIM ✦", "Pure Sim"].map((h, i) => (
                    <div key={i} style={{ fontFamily: T.label, fontSize: "0.65rem", fontWeight: 600, color: i === 2 ? C.blue : C.gray, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i > 0 ? "center" : "left" }}>{h}</div>
                  ))}
                </div>
                {[
                  { label: "Cost", vals: ["$15+/hr", "$5/hr", "Compute"] },
                  { label: "Scale", vals: ["Bottleneck", "Infinite", "High"] },
                  { label: "Quality", vals: ["Real physics", "Validated", "Sim gap"] },
                ].map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "0.75rem 1rem", borderBottom: i < 2 ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
                    <div style={{ fontFamily: T.label, fontSize: "0.72rem", fontWeight: 600, color: C.gray, textTransform: "uppercase", letterSpacing: "0.06em" }}>{row.label}</div>
                    {row.vals.map((v, j) => (
                      <div key={j} style={{ textAlign: "center", fontSize: "0.82rem", fontWeight: j === 1 ? 700 : 400, color: j === 1 ? C.blue : C.gray, background: j === 1 ? C.blueLight : "transparent", padding: "0.25rem 0.5rem", borderRadius: "5px" }}>{v}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal" style={{ transitionDelay: "0.15s" }}>
              {/* Three advantage cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                {[
                  {
                    icon: "🌍",
                    title: "Scalable Workforce",
                    body: "Leveraging the global install base of 20M+ VR/XR headsets and full body suits. No need to fly operators to a lab.",
                  },
                  {
                    icon: "💰",
                    title: "Cheaper",
                    body: "Using $500 consumer hardware instead of $50,000 custom teleoperation rigs.",
                  },
                  {
                    icon: "⚡",
                    title: "High Fidelity",
                    body: "Physics-based simulation (Isaac Lab) and cloud delivery (CloudXR) ensures data transfers seamlessly to the real world.",
                  },
                ].map((adv, i) => (
                  <div key={i} className="reveal" style={{ display: "flex", gap: "1rem", alignItems: "flex-start", padding: "1.25rem 1.5rem", background: C.grayLight, borderRadius: "10px", border: `1px solid ${C.border}`, transitionDelay: `${i * 0.1}s` }}>
                    <div style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0 }}>{adv.icon}</div>
                    <div>
                      <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: "0.95rem", color: C.navy, marginBottom: "0.3rem" }}>{adv.title}</div>
                      <p style={{ color: C.gray, fontSize: "0.85rem", lineHeight: 1.6, margin: 0 }}>{adv.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: "relative", borderRadius: "14px", overflow: "hidden", border: `1px solid ${C.border}` }}>
                <img
                  src={SIMULATION_SCENE}
                  alt="Gamified VR task vs clean simulator"
                  style={{ width: "100%", display: "block", objectFit: "cover" }}
                />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(255,255,255,0.9)", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontFamily: T.mono, fontSize: "0.62rem", color: C.blue, letterSpacing: "0.08em" }}>PLAYER VIEW</span>
                  <span style={{ fontFamily: T.mono, fontSize: "0.62rem", color: C.gray, letterSpacing: "0.08em" }}>SIMULATOR OUTPUT →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKET TIMING ── */}
      <section id="market-timing" style={{ padding: "100px 0", background: C.navy, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center", marginBottom: "4.5rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>Market Timing</div>
            <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", color: C.white, lineHeight: 1.1, marginBottom: "1rem" }}>
              The Hardware is<br />
              <span style={{ color: C.blue }}>Already Here.</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "1.05rem", maxWidth: "520px", margin: "0 auto", lineHeight: 1.7 }}>
              Three forces converged to make this moment possible — and irreversible.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
            {[
              {
                num: "01",
                title: "20M+ Dormant Headsets",
                body: "Millions of consumer VR devices are gathering dust. This is a massive, distributed workforce waiting to be activated.",
                stat: "20M+",
                statLabel: "VR/XR headsets in the wild",
              },
              {
                num: "02",
                title: "The Missing Link Found",
                body: "Hardware existed, but physics didn't. Now, NVIDIA Isaac Lab + Cloud GPUs make real-time simulation possible at scale.",
                stat: "Isaac Lab",
                statLabel: "+ CloudXR = real-time sim",
              },
              {
                num: "03",
                title: "We Connect the Dots",
                body: "We bridge the gap between the XR community and Robotics labs. We turn \"gamers\" into \"trainers\".",
                stat: "1/10th",
                statLabel: "cost vs physical teleop",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="reveal"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "14px",
                  padding: "2.5rem 2rem",
                  transitionDelay: `${i * 0.12}s`,
                }}
              >
                <div style={{ fontFamily: T.mono, fontSize: "0.65rem", color: C.blue, marginBottom: "1.5rem", letterSpacing: "0.12em" }}>{item.num}</div>
                <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: "2rem", color: C.blue, lineHeight: 1, marginBottom: "0.3rem" }}>{item.stat}</div>
                <div style={{ fontFamily: T.label, fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1.5rem" }}>{item.statLabel}</div>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: "1rem", color: C.white, marginBottom: "0.6rem" }}>{item.title}</div>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.88rem", lineHeight: 1.65, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: "100px 0", background: C.grayLight, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center", marginBottom: "4rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>The Platform</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.navy, lineHeight: 1.15 }}>
              How SIM XR Works
            </h2>
            <p style={{ color: C.gray, fontSize: "1rem", maxWidth: "480px", margin: "0.75rem auto 0", lineHeight: 1.65 }}>
              A three-sided platform connecting robotics companies, VR developers, and a global crowd of operators.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
            {[
              {
                step: "=>",
                who: "Robotics Company",
                role: "The Client",
                desc: "Submits a task spec and budget. Receives a validated, benchmarked dataset ready for model training.",
                accent: C.blue,
              },
              {
                step: "",
                who: "SIM XR Platform",
                role: "The Orchestrator",
                desc: "Distributes tasks, validates data quality, and routes payments. We keep the margin — our flywheel grows with every episode.",
                accent: C.blue,
                highlight: true,
              },
              {
                step: "03",
                who: "VR Crowd",
                role: "The Operators",
                desc: "Global users play gamified tasks in VR. Their actions are recorded as clean physics trajectories — paid per validated episode.",
                accent: C.blue,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="reveal"
                style={{
                  background: item.highlight ? C.navy : C.white,
                  border: `1px solid ${item.highlight ? C.navy : C.border}`,
                  borderRadius: "12px",
                  padding: "2.25rem 2rem",
                  transitionDelay: `${i * 0.1}s`,
                }}
              >
                <div style={{ fontFamily: T.mono, fontSize: "0.68rem", color: item.highlight ? "rgba(255,255,255,0.4)" : C.blue, marginBottom: "1.25rem", letterSpacing: "0.1em" }}>{item.step}</div>
                <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: "1.1rem", color: item.highlight ? C.white : C.navy, marginBottom: "0.3rem" }}>{item.who}</div>
                <div style={{ fontFamily: T.label, fontSize: "0.65rem", fontWeight: 600, color: item.highlight ? "rgba(255,255,255,0.45)" : C.blue, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.85rem" }}>{item.role}</div>
                <p style={{ color: item.highlight ? "rgba(255,255,255,0.65)" : C.gray, fontSize: "0.88rem", lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIDEO PLACEHOLDER ── */}
      <section id="demo" style={{ padding: "100px 0", background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>See It In Action</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.navy, lineHeight: 1.15 }}>
              From VR Game to Robot Skill
            </h2>
            <p style={{ color: C.gray, fontSize: "1rem", maxWidth: "480px", margin: "0.75rem auto 0", lineHeight: 1.65 }}>
              Watch how a single VR session generates thousands of validated training episodes for physical AI models.
            </p>
          </div>
          <div
            className="reveal"
            style={{
              maxWidth: "860px",
              margin: "0 auto",
              borderRadius: "16px",
              overflow: "hidden",
              border: `1px solid ${C.border}`,
              aspectRatio: "16/9",
              position: "relative",
            }}
          >
            <iframe
              src="https://www.youtube.com/embed/deZ62spXqnk?rel=0&modestbranding=1"
              title="SIM XR Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: "absolute",
                top: 0, left: 0,
                width: "100%", height: "100%",
                border: "none",
              }}
            />
          </div>
        </div>
      </section>

      {/* ── GAMIFICATION ── */}
      <section id="gamification" style={{ padding: "100px 0", background: C.grayLight, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
            <div className="reveal">
              <div className="label-tag" style={{ marginBottom: "0.75rem" }}>The Unfair Advantage</div>
              <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.navy, marginBottom: "1rem", lineHeight: 1.15 }}>
                The Gamification<br />Layer.
              </h2>
              <p style={{ color: C.gray, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.25rem" }}>
                Our XR &amp; metaverse expertise lets us wrap any data collection task in a compelling game loop — immersive, rewarding, and genuinely fun. Users participate not just for pay, but because it's engaging.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {[
                  { title: "Intrinsic Motivation", desc: "Game loops keep users engaged beyond pay — more episodes, higher retention and data quality." },
                  { title: "Skin-Agnostic Data", desc: "We record actions, not frames. Any game skin maps to clean physics trajectories." },
                  { title: "Retargetable to Any Scene", desc: "One session replays in any environment — 3DGS or Isaac Lab. Infinite scene variations." },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.blue, marginTop: "0.45rem", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: "0.95rem", color: C.navy, marginBottom: "0.2rem" }}>{item.title}</div>
                      <div style={{ color: C.gray, fontSize: "0.88rem", lineHeight: 1.6 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="reveal" style={{ transitionDelay: "0.15s" }}>
              <div style={{ borderRadius: "14px", overflow: "hidden", border: `1px solid ${C.border}` }}>
                <img
                  src={SIMULATION_SCENE}
                  alt="Gamified VR vs simulator"
                  style={{ width: "100%", display: "block", objectFit: "cover" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VISION ── */}
      <section id="vision" style={{ padding: "100px 0", background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center", marginBottom: "4rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>The Vision</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.navy, lineHeight: 1.15, marginBottom: "0.75rem" }}>
              Beyond Trajectories.
            </h2>
            <p style={{ color: C.gray, fontSize: "1rem", maxWidth: "520px", margin: "0 auto", lineHeight: 1.65 }}>
              We are building the engine that generates infinite, photorealistic training worlds for Vision-Language-Action models.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem", marginBottom: "3rem" }}>
            {[
              {
                title: "Synthetic Sensor Data for VLA",
                desc: "We replay validated human trajectories inside simulation to generate perfect synthetic sensor data — RGB-D, LiDAR — for training Vision-Language-Action models.",
              },
              {
                title: "3D Gaussian Splatting + Physics",
                desc: "We combine 3DGS for absolute photorealism with rigid-body physics, creating digital twins indistinguishable from reality.",
              },
              {
                title: "Infinite Variations via Cosmos",
                desc: "Using NVIDIA Cosmos World Foundation Models, we generate millions of environment variations, exponentially scaling Imitation & Reinforcement Learning.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="reveal"
                style={{
                  background: C.grayLight,
                  border: `1px solid ${C.border}`,
                  borderRadius: "12px",
                  padding: "2.25rem 2rem",
                  transitionDelay: `${i * 0.1}s`,
                }}
              >
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: "1rem", color: C.navy, marginBottom: "0.75rem", lineHeight: 1.35 }}>{item.title}</div>
                <p style={{ color: C.gray, fontSize: "0.88rem", lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* NVIDIA badges */}
          <div className="reveal" style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {["NVIDIA Inception Program", "NVIDIA CloudXR Early Access"].map((badge) => (
              <div
                key={badge}
                style={{
                  fontFamily: T.label, fontSize: "0.75rem", fontWeight: 600,
                  color: "#16A34A",
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "6px",
                  padding: "0.4rem 0.9rem",
                  letterSpacing: "0.03em",
                }}
              >
                ✓ {badge}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOUNDER ── */}
      <section id="founder" style={{ padding: "100px 0", background: C.grayLight, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ marginBottom: "3.5rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>The Founder</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "5rem", alignItems: "start" }}>
            <div className="reveal">
              <div style={{ borderRadius: "14px", overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: "1.75rem", width: "320px", flexShrink: 0 }}>
                <img
                  src={FOUNDER_PHOTO}
                  alt="Georgy Molodtsov"
                  style={{ width: "320px", height: "426px", objectFit: "cover", objectPosition: "center top", display: "block" }}
                />
              </div>
              <h2 style={{ fontSize: "2.2rem", color: C.navy, lineHeight: 1.1, marginBottom: "0.35rem" }}>
                Georgy<br />Molodtsov
              </h2>
              <div style={{ fontFamily: T.label, fontWeight: 600, fontSize: "0.8rem", color: C.blue, letterSpacing: "0.05em", marginBottom: "1.25rem" }}>
                Founder &amp; CEO, SIM XR
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.5rem" }}>
                <a href="https://simxr.tech" target="_blank" rel="noopener noreferrer" style={{ fontFamily: T.mono, fontSize: "0.78rem", color: C.gray, textDecoration: "none" }}>simxr.tech</a>
                <a href="mailto:gm@simxr.tech" style={{ fontFamily: T.mono, fontSize: "0.78rem", color: C.gray, textDecoration: "none" }}>gm@simxr.tech</a>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {["Webby Award", "European XR Award", "Raindance Immersive"].map((a) => (
                  <div key={a} style={{ fontFamily: T.label, fontSize: "0.68rem", fontWeight: 600, color: C.gray, background: C.white, border: `1px solid ${C.border}`, borderRadius: "5px", padding: "0.3rem 0.65rem" }}>{a}</div>
                ))}
              </div>
            </div>

            <div className="reveal" style={{ display: "flex", flexDirection: "column", gap: "2.5rem", transitionDelay: "0.1s" }}>
              {[
                {
                  tag: "XR NATIVE — SCALE OPERATOR",
                  title: "10+ Years. 50+ Festivals. Tens of Thousands of VR Device Interactions.",
                  desc: "Produced and curated XR events across Europe and CIS. Managed synchronized multi-headset deployments (up to 65 devices) for audiences of 500,000+ people. Founder of Film XR (Estonia/France).",
                  color: C.blue,
                },
                {
                  tag: "3DGS & AI PIPELINE R&D",
                  title: "Active R&D in Gaussian Splatting, NeRFs & AI Video Pipelines since 2024.",
                  desc: "Hands-on research in 3D Gaussian Splatting and Volumetric Video for XR/Film/Animation. The core technology of SIM XR's long-term vision is already in active development.",
                  color: C.blue,
                },
                {
                  tag: "RECOGNITION",
                  title: "Academy of Television Arts & Sciences · Venice Biennale · Fulbright Fellow.",
                  desc: "Member of ATAS Emerging Media Peer Group. Mentor, Venice Biennale College Cinema – Immersive (2025). Fulbright Graduate Fellow.",
                  color: C.blue,
                },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "1.25rem" }}>
                  <div style={{ width: "2px", background: item.color, borderRadius: "2px", flexShrink: 0, minHeight: "50px" }} />
                  <div>
                    <div style={{ fontFamily: T.label, fontSize: "0.62rem", fontWeight: 600, color: item.color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.35rem" }}>{item.tag}</div>
                    <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: "0.95rem", color: C.navy, marginBottom: "0.4rem", lineHeight: 1.35 }}>{item.title}</div>
                    <p style={{ color: C.gray, fontSize: "0.85rem", lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── EARLY ACCESS FORM ── */}
      <section id="early-access" style={{ padding: "100px 0", background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ marginBottom: "3.5rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>🚀 Early Access</div>
            <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: C.navy, lineHeight: 1.1, marginBottom: "1rem" }}>
              Early Access for Robotics Teams
            </h2>
            <p style={{ color: C.gray, fontSize: "1rem", maxWidth: "560px" }}>
              We're building the training layer for physical AI. Join early to shape the platform.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "2.5rem", alignItems: "start" }}>

            {/* LEFT: Robotics Teams form */}
            <div className="reveal" style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: "14px",
              padding: "2.5rem",
            }}>
              <div style={{
                display: "inline-block",
                fontFamily: T.label, fontSize: "0.68rem", fontWeight: 700,
                color: C.blue, background: C.blueLight,
                borderRadius: "5px", padding: "0.3rem 0.75rem",
                letterSpacing: "0.08em", textTransform: "uppercase",
                marginBottom: "1.25rem",
              }}>Robotics Teams</div>
              <h3 style={{ fontFamily: T.display, fontWeight: 700, fontSize: "1.35rem", color: C.navy, marginBottom: "0.6rem" }}>
                Request Early Access
              </h3>
              <p style={{ color: C.gray, fontSize: "0.88rem", lineHeight: 1.65, marginBottom: "1.75rem" }}>
                We're working with robotics companies that need high-quality teleoperation datasets
                for training robot policies. If you're building robots and need demonstration data, join
                the early access list.
              </p>

              <EarlyAccessForm />
            </div>

            {/* RIGHT: Collaborators form */}
            <div className="reveal" style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: "14px",
              padding: "2.5rem",
              transitionDelay: "0.1s",
            }}>
              <div style={{
                display: "inline-block",
                fontFamily: T.label, fontSize: "0.68rem", fontWeight: 700,
                color: "#7C3AED", background: "#F5F3FF",
                borderRadius: "5px", padding: "0.3rem 0.75rem",
                letterSpacing: "0.08em", textTransform: "uppercase",
                marginBottom: "1.25rem",
              }}>Collaborators</div>
              <h3 style={{ fontFamily: T.display, fontWeight: 700, fontSize: "1.35rem", color: C.navy, marginBottom: "0.6rem" }}>
                Want to collaborate?
              </h3>
              <p style={{ color: C.gray, fontSize: "0.88rem", lineHeight: 1.65, marginBottom: "1.75rem" }}>
                If you're an engineer, researcher, or XR developer interested in
                the project, feel free to reach out.
              </p>

              <CollaboratorForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ padding: "80px 0", background: C.navy, borderTop: `1px solid ${C.border}` }}>
        <div className="container" style={{ textAlign: "center" }}>
          <div className="reveal">
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.white, lineHeight: 1.15, marginBottom: "1rem" }}>
              Ready to train your robots<br />at scale?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "1rem", marginBottom: "2rem" }}>
              We're working with early robotics partners. Let's talk.
            </p>
            <a
              href="mailto:gm@simxr.tech"
              style={{
                fontFamily: T.label, fontWeight: 600, fontSize: "0.9rem",
                color: C.navy, background: C.white,
                padding: "0.8rem 2rem", borderRadius: "8px",
                textDecoration: "none", letterSpacing: "0.02em",
                display: "inline-block",
              }}
            >
              Get in Touch →
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.grayLight, borderTop: `1px solid ${C.border}`, padding: "2rem 0" }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <span style={{ fontFamily: T.label, fontWeight: 700, fontSize: "1rem", color: C.navy }}>
            SIM <span style={{ color: C.blue }}>XR.</span>
          </span>
          <span style={{ fontFamily: T.label, fontSize: "0.75rem", color: C.gray }}>
            © 2026 SIM XR — The Training Layer for Physical AI
          </span>
          <a href="mailto:gm@simxr.tech" style={{ fontFamily: T.label, fontSize: "0.78rem", fontWeight: 600, color: C.blue, textDecoration: "none" }}>
            gm@simxr.tech
          </a>
        </div>
      </footer>
    </div>
  );
}
