// SIM XR homepage — product-site rewrite 2026-05-02.
//
// Replaces the deck-shaped 13-section v1 (Problem / Solution / Market Timing /
// Gamification / Vision / Final CTA / etc.) with a 7-section product page:
//   Hero → Demo → What it is → How it works → Founder → Get in touch → Footer.
// The previous version is preserved verbatim at
// `client/_archive/Home-2026-05-02-deck-version.tsx` (outside src/, not bundled)
// for easy reference / restore.
//
// Notes:
//   - Hero CTA points at the early-access form, not simxr.app — Mike said the
//     simxr.app demo isn't ready to surface from the marketing site yet.
//   - Founder block (Gosha + photo + 3 credentials) is kept BIT-EXACTLY from
//     the deck version per his explicit ask. Don't restructure it.
//   - EarlyAccessForm + CollaboratorForm + useReveal + design tokens (C, T)
//     are unchanged from the deck version — they work, no reason to touch.

import { useEffect, useState } from "react";

// Local image assets — moved off Manus CloudFront 2026-04-27.
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
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#0B0F1A", marginBottom: "0.4rem" }}>Message received!</div>
        <p style={{ color: "#6B7280", fontSize: "0.88rem" }}>Thanks for reaching out — we'll be in touch.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
      <div>
        <label style={labelStyle}>Area of interest</label>
        <input style={inputStyle} placeholder="e.g. XR engineering, 3DGS pipelines, robot policy training" value={form.area}
          onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>Message</label>
        <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Tell us a bit about how you'd like to collaborate."
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
        {status === "sending" ? "Sending…" : "Get in Touch →"}
      </button>
      {status === "error" && <p style={{ color: "#EF4444", fontSize: "0.82rem", textAlign: "center" }}>Something went wrong. Please email gm@simxr.tech directly.</p>}
    </form>
  );
}

// ─── Reveal-on-scroll observer ───────────────────────────────────
function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
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
          {[
            { label: "Demo", href: "#demo" },
            { label: "How It Works", href: "#how-it-works" },
            { label: "Founder", href: "#founder" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              style={{ fontFamily: T.label, fontSize: "0.82rem", fontWeight: 500, color: C.gray, textDecoration: "none", letterSpacing: "0.01em" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.navy)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.gray)}
            >
              {item.label}
            </a>
          ))}
        </div>
        <a
          href="#contact"
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
              Operators play in VR. Robots learn from human intelligence — at scale, with real-world physics.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <a
                href="#contact"
                style={{
                  fontFamily: T.label, fontWeight: 600, fontSize: "0.88rem",
                  color: C.white, background: C.navy,
                  padding: "0.7rem 1.6rem", borderRadius: "7px",
                  textDecoration: "none", letterSpacing: "0.01em",
                }}
              >
                Talk to us
              </a>
            </div>
          </div>

          {/* Hero visual — VR operator + 3 stats card */}
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

      {/* ── DEMO (moved up — visual hook right after hero) ── */}
      <section id="demo" style={{ padding: "100px 0", background: C.grayLight, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>See It In Action</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.navy, lineHeight: 1.15 }}>
              From VR Game to Robot Skill
            </h2>
            <p style={{ color: C.gray, fontSize: "1rem", maxWidth: "480px", margin: "0.75rem auto 0", lineHeight: 1.65 }}>
              A single VR session generates thousands of validated training episodes for physical AI models.
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

      {/* ── WHAT IT IS — compressed from prior "What we build" + "Solution" ── */}
      <section id="what-it-is" style={{ padding: "100px 0", background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center", maxWidth: "640px", margin: "0 auto 3.5rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>What it is</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: C.navy, marginBottom: "1rem", lineHeight: 1.15 }}>
              Cheaper than teleop.<br />
              <span style={{ color: C.blue }}>Better than pure simulation.</span>
            </h2>
            <p style={{ color: C.gray, fontSize: "1rem", lineHeight: 1.7 }}>
              Robotics teams need millions of demonstrations. Real-world teleop costs $15+/hr per operator and doesn't scale. SIM XR captures real human intelligence inside a physics-accurate simulation — at consumer-VR price.
            </p>
          </div>

          <div className="reveal" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
            {[
              {
                title: "Consumer VR, not a lab",
                body: "Operators use Quest, Vision Pro or Pico headsets they already own. No specialized rigs, no on-site setup, no flying people in.",
              },
              {
                title: "Physics-grounded data",
                body: "Every session runs inside NVIDIA Isaac Lab. Trajectories transfer to real robots — no sim-to-real gap, no video-only ambiguity.",
              },
              {
                title: "Gamified at scale",
                body: "Workers play because the task is fun, not just for pay. Skin-agnostic recording: one session retargets to any environment, any robot.",
              },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: C.grayLight,
                  border: `1px solid ${C.border}`,
                  borderRadius: "12px",
                  padding: "2rem 1.75rem",
                }}
              >
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: "1.05rem", color: C.navy, marginBottom: "0.6rem", lineHeight: 1.3 }}>{card.title}</div>
                <p style={{ color: C.gray, fontSize: "0.9rem", lineHeight: 1.65, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>

          {/* NVIDIA badges — public per memory project_program_status_2026 */}
          <div className="reveal" style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "3rem" }}>
            {["NVIDIA Inception Program", "Built on NVIDIA CloudXR"].map((badge) => (
              <div
                key={badge}
                style={{
                  fontFamily: T.label, fontSize: "0.75rem", fontWeight: 600,
                  color: C.green,
                  background: C.greenLight,
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

      {/* ── HOW IT WORKS — three-sided platform diagram (kept verbatim) ── */}
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
                step: "01",
                who: "Robotics Company",
                role: "The Client",
                desc: "Submits a task spec and budget. Receives a validated, benchmarked dataset ready for model training.",
              },
              {
                step: "02",
                who: "SIM XR Platform",
                role: "The Orchestrator",
                desc: "Distributes tasks, validates data quality, and routes payments. We keep the margin — our flywheel grows with every episode.",
                highlight: true,
              },
              {
                step: "03",
                who: "VR Crowd",
                role: "The Operators",
                desc: "Global users play gamified tasks in VR. Their actions are recorded as clean physics trajectories — paid per validated episode.",
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

      {/* ── FOUNDER — kept BIT-EXACTLY from deck version per Gosha's ask ── */}
      <section id="founder" style={{ padding: "100px 0", background: C.white, borderTop: `1px solid ${C.border}` }}>
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

      {/* ── GET IN TOUCH — robotics teams + collaborators (forms unchanged) ── */}
      <section id="contact" style={{ padding: "100px 0", background: C.grayLight, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div className="reveal" style={{ marginBottom: "3.5rem" }}>
            <div className="label-tag" style={{ marginBottom: "0.75rem" }}>Get in Touch</div>
            <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: C.navy, lineHeight: 1.1, marginBottom: "1rem" }}>
              Building the training layer for physical AI — together.
            </h2>
            <p style={{ color: C.gray, fontSize: "1rem", maxWidth: "560px" }}>
              Two paths. If you're at a robotics team that needs demonstration data, request early access. If you want to collaborate as an engineer, researcher, or XR developer, reach out directly.
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

      {/* ── OPERATOR CROSS-LINK — small banner pointing at /operator/ ── */}
      <section style={{ padding: "64px 0", background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div className="container" style={{ textAlign: "center" }}>
          <div style={{ fontFamily: T.label, fontSize: "0.7rem", fontWeight: 700, color: C.blue, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.6rem" }}>
            For Operators
          </div>
          <h3 style={{ fontSize: "1.4rem", color: C.navy, margin: "0 0 0.5rem", fontWeight: 600, fontFamily: T.display }}>
            Want to train robots from your couch?
          </h3>
          <p style={{ color: C.gray, fontSize: "0.92rem", lineHeight: 1.6, maxWidth: "520px", margin: "0 auto 1.4rem" }}>
            We pay weekly to consumer-VR users who teleoperate humanoids inside our simulation. Quest 3 or Vision Pro, no prior robotics experience needed.
          </p>
          <a
            href="/operator/"
            style={{
              fontFamily: T.label, fontWeight: 600, fontSize: "0.85rem",
              color: C.white, background: C.blue,
              padding: "0.7rem 1.5rem", borderRadius: "8px",
              textDecoration: "none", letterSpacing: "0.02em",
              display: "inline-block",
            }}
          >
            Apply to operate →
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.navy, color: "rgba(255,255,255,0.6)", borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "2rem" }} className="footer-grid">
            {/* Brand block */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginBottom: "1rem" }}>
                <span style={{ fontFamily: T.label, fontWeight: 700, fontSize: "1.15rem", color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                  SIM <span style={{ color: "#4D80FF" }}>XR.</span>
                </span>
              </div>
              <p style={{ fontSize: "0.88rem", lineHeight: 1.6, maxWidth: "26rem", margin: "0 0 1rem" }}>
                The training layer for Physical AI. Operators play in VR. Robots learn from human intelligence — at scale, with real-world physics.
              </p>
              <p style={{ fontSize: "0.85rem", margin: 0 }}>
                <span style={{ fontFamily: T.mono, fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginRight: "0.6rem" }}>
                  FOR OPERATORS
                </span>
                <a href="/operator/" style={{ color: "#FFFFFF", textDecoration: "none", fontWeight: 500 }}>
                  /operator →
                </a>
              </p>
            </div>

            {/* PRODUCT column */}
            <div>
              <div style={{ fontFamily: T.mono, fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: "0.85rem" }}>
                PRODUCT
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.88rem", lineHeight: 1.9 }}>
                <li><a href="#demo" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>Demo</a></li>
                <li><a href="#what-it-is" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>What it is</a></li>
                <li><a href="#how-it-works" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>How it works</a></li>
              </ul>
            </div>

            {/* COMPANY column */}
            <div>
              <div style={{ fontFamily: T.mono, fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: "0.85rem" }}>
                COMPANY
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.88rem", lineHeight: 1.9 }}>
                <li><a href="#founder" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>Founder</a></li>
                <li><a href="#contact" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>Contact</a></li>
                <li><a href="mailto:gm@simxr.tech" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>gm@simxr.tech</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "1.1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: T.mono, fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", flexWrap: "wrap", gap: "0.5rem" }}>
            <span>© 2026 SIM XR — The Training Layer for Physical AI</span>
            <span>California · Paris · Tel Aviv</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
