// Demo — public-facing operator/demo page, redesigned 2026-07-19 ("Strands").
//
// Hosted at /demo on both simxr.app and simxr.tech. Replaces the 2026-05-12
// hero-card layout with the abstract "operator → scene → robot" composition
// picked by Mike from the design exploration in
// `web/internal/design_simxr_app_v8_strands_2026-07-19.html`:
//
//   · left   — oscillograph strands: wavy lines draw themselves from the left
//              edge of the screen and are pulled into the scene portal
//              (the operator's raw motion becoming data)
//   · center — circular PORTAL with the live scene's preview video (or a
//              live session snapshot when busy) + spinning conic ring;
//              scene name, compact telemetry, one Connect button
//   · right  — a slowly rotating 3D point lattice; nodes flash green as
//              clean "skill" particles arrive (the robot side)
//
// Real data wiring:
//   · fetchFleet() polls BOTH GPU servers (EU Frankfurt + US Oregon) every
//     10s — gives per-server health + measured browser→server RTT (latency)
//   · the hero portal shows whichever server currently has a live scene
//     (live-ready preferred over busy; click a live mini card to switch)
//   · scene catalog comes from fetchScenes() (api → static fallback), and
//     the "Also in the catalog" rail shows curated scenes with real
//     live / busy / offline / broken states
//
// What is deliberately preserved from the previous Demo.tsx:
//   · useCloudXRSession.ts is reused WITHOUT modification (per CC handoff
//     2026-05-12 — the AV1 + posePrediction + channel-probe patterns must
//     not regress). connect() is still called synchronously from onClick.
//   · The busy-state live snapshot (operator-snapshot.jpg, minute-keyed
//     cachebuster, visibility-aware refresh) — now per-server.
//   · noindex meta; no nav; no recordings redirect.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { fetchScenes, formatWaitTime, type Healthz, type Scene } from "@/lib/scenes";
import { fetchFleet, type ServerSnapshot, type SimxrServer } from "@/lib/servers";
import { useCloudXRSession } from "@/lib/useCloudXRSession";
import { SCENE_ASSETS, robotLabel, skillTag } from "@/lib/scene_assets";

// ─────────────────────────────────────────────────────────────────────────
// Styling. This page uses a scoped <style> block (class-based) instead of
// the inline-style-object pattern of the previous version — the design
// needs hover states, keyframes and media queries that inline styles
// can't express. All classes are prefixed `sxrd-` to avoid collisions.
// ─────────────────────────────────────────────────────────────────────────
const CSS = `
  .sxrd-root {
    --bg: #05060B; --ink: #EDEFF4; --dim: #737D8E; --faint: #3a4150;
    --line: rgba(255,255,255,0.08);
    --accent: #6f8dff; --live: #59FF9C; --busy: #FFB454; --off: #5a6272;
    background: var(--bg); color: var(--ink);
    font-family: 'DM Sans', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh; display: flex; flex-direction: column; overflow-x: hidden;
  }
  .sxrd-header { display: flex; justify-content: space-between; align-items: baseline;
    padding: 22px 4.5vw 0; position: relative; z-index: 10; }
  .sxrd-mark { font-family: 'Space Grotesk', sans-serif; font-weight: 700;
    font-size: 15px; letter-spacing: -0.02em; }
  .sxrd-mark span { color: var(--accent); }
  .sxrd-mark small { font-family: 'JetBrains Mono', monospace; font-weight: 400;
    font-size: 10px; letter-spacing: 0.22em; color: var(--faint); margin-left: 10px; }
  .sxrd-hstat { font-family: 'JetBrains Mono', monospace; font-size: 10px;
    letter-spacing: 0.24em; text-transform: uppercase; display: flex;
    align-items: center; gap: 8px; }
  .sxrd-hstat.live { color: var(--live); }
  .sxrd-hstat.idle { color: var(--dim); }
  .sxrd-hstat i { width: 6px; height: 6px; border-radius: 50%; background: currentColor;
    box-shadow: 0 0 10px currentColor; animation: sxrdBreathe 2.2s ease-in-out infinite; }
  @keyframes sxrdBreathe { 0%,100% { opacity: .5; } 50% { opacity: 1; } }

  .sxrd-stage { position: relative; flex: 1; min-height: 620px; }
  .sxrd-fx { position: absolute; inset: 0; width: 100%; height: 100%;
    display: block; z-index: 1; }

  .sxrd-portalcol { position: absolute; left: 50%; top: 44%;
    transform: translate(-50%, -50%); z-index: 5;
    display: flex; flex-direction: column; align-items: center; gap: 18px;
    width: min(92vw, 560px); }
  .sxrd-portal { position: relative; width: min(44vh, 34vw); aspect-ratio: 1; }
  .sxrd-portal .pv { position: absolute; inset: 5%; border-radius: 50%; overflow: hidden;
    background: #0a0d14;
    box-shadow: 0 0 130px rgba(70,120,255,0.28), inset 0 0 70px rgba(0,0,0,0.55); }
  .sxrd-portal .pv > video, .sxrd-portal .pv > img {
    width: 100%; height: 100%; object-fit: cover; display: block; }
  .sxrd-portal .pv .ph { width: 100%; height: 100%; display: flex; align-items: center;
    justify-content: center; text-align: center;
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.3em;
    text-transform: uppercase; color: var(--faint); }
  .sxrd-portal .b { position: absolute; top: 8%; left: 50%; transform: translateX(-50%); z-index: 6; }

  .sxrd-badge { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 500;
    letter-spacing: 0.22em; text-transform: uppercase; padding: 6px 11px;
    border-radius: 999px; display: inline-flex; align-items: center; gap: 7px;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); white-space: nowrap; }
  .sxrd-badge i { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
  .sxrd-badge.live { color: #052; background: var(--live); }
  .sxrd-badge.live i { background: #052; animation: sxrdBreathe 1.6s ease-in-out infinite; }
  .sxrd-badge.busy { color: var(--busy); background: rgba(255,180,84,0.13);
    border: 1px solid rgba(255,180,84,0.4); }
  .sxrd-badge.busy i { background: var(--busy); }
  .sxrd-badge.off { color: var(--off); background: rgba(90,98,114,0.16);
    border: 1px solid rgba(90,98,114,0.4); }
  .sxrd-badge.off i { background: var(--off); }

  .sxrd-tt { text-align: center; }
  .sxrd-tt h1 { font-family: 'Space Grotesk', sans-serif; font-weight: 500;
    font-size: clamp(20px, 2.3vw, 28px); letter-spacing: -0.01em; margin: 0; }
  .sxrd-tt .sub { font-family: 'JetBrains Mono', monospace; font-size: 10px;
    letter-spacing: 0.2em; text-transform: uppercase; color: var(--dim); margin-top: 8px; }

  .sxrd-telemetry { display: flex; gap: 0; border: 1px solid var(--line);
    border-radius: 10px; overflow: hidden; background: rgba(5,6,11,0.55);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  .sxrd-telemetry .cell { padding: 9px 16px 10px; border-left: 1px solid var(--line);
    text-align: left; min-width: 86px; }
  .sxrd-telemetry .cell:first-child { border-left: none; }
  .sxrd-telemetry .l { font-family: 'JetBrains Mono', monospace; font-size: 8px;
    letter-spacing: 0.26em; text-transform: uppercase; color: var(--faint);
    margin-bottom: 4px; }
  .sxrd-telemetry .v { font-family: 'JetBrains Mono', monospace; font-size: 11.5px;
    color: #aab1bc; white-space: nowrap; }

  .sxrd-connect { font-family: 'Space Grotesk', sans-serif; font-weight: 700;
    font-size: 15px; letter-spacing: 0.03em; color: #04140b; background: var(--live);
    border: none; cursor: pointer; padding: 15px 46px; border-radius: 12px;
    transition: box-shadow .18s, transform .12s, opacity .15s; }
  .sxrd-connect:hover:not(:disabled) { box-shadow: 0 10px 36px rgba(89,255,156,0.4);
    transform: translateY(-2px); }
  .sxrd-connect:disabled { opacity: .45; cursor: not-allowed; }
  .sxrd-connect.ghost { background: transparent; color: var(--accent);
    border: 1px solid rgba(111,141,255,0.45); }
  .sxrd-hint { font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint);
    text-align: center; }
  .sxrd-error { border: 1px solid #D97706; border-radius: 8px;
    background: rgba(217,119,6,0.1); padding: 10px 14px; max-width: 100%;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.5;
    color: #f0a94f; }

  .sxrd-others { position: absolute; left: 4.5vw; bottom: 3vh; z-index: 5; }
  .sxrd-others .k { font-family: 'JetBrains Mono', monospace; font-size: 9px;
    letter-spacing: 0.26em; text-transform: uppercase; color: var(--faint);
    margin-bottom: 8px; }
  .sxrd-minis { display: flex; gap: 12px; flex-wrap: wrap; }
  .sxrd-mini { width: 162px; border-radius: 10px; overflow: hidden;
    border: 1px solid var(--line); background: rgba(5,6,11,0.6); opacity: .5;
    transition: opacity .2s, transform .2s; }
  .sxrd-mini:hover { opacity: 1; transform: translateY(-2px); }
  .sxrd-mini.clickable { cursor: pointer; }
  .sxrd-mini.is-live { opacity: .85; border-color: rgba(89,255,156,0.35); }
  .sxrd-mini .thumb { position: relative; aspect-ratio: 16/9; background: #0a0d14; }
  .sxrd-mini .thumb video, .sxrd-mini .thumb img {
    width: 100%; height: 100%; object-fit: cover; display: block; }
  .sxrd-mini.off .thumb video, .sxrd-mini.off .thumb img {
    filter: grayscale(1) brightness(.55); }
  .sxrd-mini.busy .thumb video, .sxrd-mini.busy .thumb img { opacity: .6; }
  .sxrd-mini .b { position: absolute; top: 6px; left: 6px; transform: scale(.82);
    transform-origin: top left; }
  .sxrd-mini .nm { font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
    letter-spacing: 0.08em; color: var(--dim); padding: 8px 10px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .sxrd-footer { border-top: 1px solid var(--line); padding: 12px 4.5vw;
    position: relative; z-index: 10; display: flex; justify-content: space-between;
    flex-wrap: wrap; gap: 8px; font-family: 'JetBrains Mono', monospace;
    font-size: 9px; letter-spacing: 0.12em; color: var(--faint);
    text-transform: uppercase; }

  @media (max-width: 900px) {
    .sxrd-fx { display: none; }
    .sxrd-stage { min-height: 0; }
    .sxrd-portalcol { position: static; transform: none; margin: 26px auto 12px; }
    .sxrd-portal { width: min(64vw, 320px); }
    .sxrd-others { position: static; padding: 8px 4.5vw 22px; }
    .sxrd-telemetry { flex-wrap: wrap; }
  }
  /* Short-but-wide viewports (laptops with the browser not maximized):
     the absolutely-centered column would overlap the catalog rail, so let
     the page flow and scroll instead. Canvas keeps tracking the portal —
     its position is measured per-frame. */
  @media (min-width: 901px) and (max-height: 880px) {
    .sxrd-stage { min-height: 0; }
    .sxrd-portalcol { position: static; transform: none; margin: 20px auto 10px; }
    .sxrd-portal { width: min(38vh, 30vw); }
    .sxrd-others { position: static; padding: 16px 4.5vw 24px; }
  }
`;

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
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@300;400;500&display=swap"
      />
      {/* noindex — live title reflects the current scene; don't let crawlers cache it */}
      <meta name="robots" content="noindex, nofollow" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FxCanvas — the "operator → scene → robot" animation.
// Ported from web/internal/design_simxr_app_v8_strands_2026-07-19.html.
// Left: oscillograph strands drawing from the screen edge into the portal.
// Right: rotating 3D lattice whose nodes flash as clean particles arrive.
// Runs only ≥900px wide and only when prefers-reduced-motion is not set;
// rAF naturally pauses in background tabs.
// ─────────────────────────────────────────────────────────────────────────
function FxCanvas({ portalRef }: { portalRef: React.RefObject<HTMLDivElement> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // static page for reduced-motion users
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let raf = 0;
    let disposed = false;

    const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    function resize() {
      if (!cv || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#05060B";
      ctx.fillRect(0, 0, W, H);
    }
    resize();
    window.addEventListener("resize", resize);

    // ── strands (left) ──
    interface Strand {
      baseY: number;
      a1: number; k1: number; p1: number;
      a2: number; k2: number; p2: number;
      th: number;
      speed: number;
      slurp: number;
      alpha: number;
      buf: { x: number; y: number }[];
      headX: number;
      state: "draw" | "slurp";
      wait: number;
    }
    const NSTR = 5;
    const strands: Strand[] = [];
    function newStrand(st: Strand, stagger: boolean) {
      st.baseY = H * rnd(0.2, 0.62);
      st.a1 = H * rnd(0.035, 0.085); st.k1 = (Math.PI * 2) / rnd(110, 230); st.p1 = Math.random() * 10;
      st.a2 = st.a1 * rnd(0.25, 0.5); st.k2 = (Math.PI * 2) / rnd(40, 90); st.p2 = Math.random() * 10;
      st.th = rnd(-0.5, 0.5);
      st.speed = rnd(2.2, 3.4);
      st.slurp = Math.ceil(rnd(2, 4));
      st.alpha = rnd(0.2, 0.32);
      st.buf = [];
      st.headX = 0;
      st.state = "draw";
      st.wait = stagger ? Math.floor(rnd(0, 500)) : Math.floor(rnd(40, 220));
    }
    for (let i = 0; i < NSTR; i++) {
      const st = {} as Strand;
      newStrand(st, true);
      strands.push(st);
    }
    function strandY(st: Strand, x: number, cx: number, cy: number, R: number) {
      const tx = cx - R * Math.cos(st.th);
      const ty = cy - R * Math.sin(st.th) * 1.6;
      const wave =
        st.baseY +
        Math.sin(x * st.k1 + st.p1) * st.a1 +
        Math.sin(x * st.k2 + st.p2) * st.a2;
      const u = Math.min(x / tx, 1);
      const conv = ease((u - 0.55) / 0.45);
      return wave * (1 - conv) + ty * conv;
    }
    function stepStrand(st: Strand, cx: number, cy: number, R: number) {
      if (st.wait > 0) { st.wait--; return; }
      if (st.state === "draw") {
        for (let k = 0; k < 2; k++) {
          st.headX += st.speed / 2;
          const y = strandY(st, st.headX, cx, cy, R);
          st.buf.push({ x: st.headX, y });
          if (Math.hypot(st.headX - cx, y - cy) <= R * 1.004) { st.state = "slurp"; break; }
        }
      } else {
        for (let k = 0; k < st.slurp; k++) st.buf.shift();
        if (st.buf.length < 2) newStrand(st, false);
      }
    }

    // ── lattice (right) ──
    interface LatticeNode { x: number; y: number; z: number; pulse: number }
    const LV: LatticeNode[] = [];
    const NL = 4;
    for (let i = 0; i < NL; i++)
      for (let j = 0; j < NL; j++)
        for (let k = 0; k < NL; k++)
          LV.push({
            x: (i / (NL - 1)) * 2 - 1,
            y: (j / (NL - 1)) * 2 - 1,
            z: (k / (NL - 1)) * 2 - 1,
            pulse: 0,
          });
    const LE: [number, number][] = [];
    const nodeIdx = (i: number, j: number, k: number) => i * NL * NL + j * NL + k;
    for (let i = 0; i < NL; i++)
      for (let j = 0; j < NL; j++)
        for (let k = 0; k < NL; k++) {
          if (i + 1 < NL) LE.push([nodeIdx(i, j, k), nodeIdx(i + 1, j, k)]);
          if (j + 1 < NL) LE.push([nodeIdx(i, j, k), nodeIdx(i, j + 1, k)]);
          if (k + 1 < NL) LE.push([nodeIdx(i, j, k), nodeIdx(i, j, k + 1)]);
        }

    // ── clean out-stream (portal → lattice) ──
    interface OutP { t: number; speed: number; lane: number; seed: number; tgt: number }
    const N_OUT = 80;
    const out: OutP[] = [];
    function spawnOut(p: OutP, fresh: boolean) {
      p.t = fresh ? Math.random() : 0;
      p.speed = rnd(0.0026, 0.0046);
      p.lane = rnd(-1, 1);
      p.seed = Math.random() * 1000;
      p.tgt = Math.floor(Math.random() * LV.length);
    }
    for (let i = 0; i < N_OUT; i++) {
      const p = {} as OutP;
      spawnOut(p, true);
      out.push(p);
    }

    function frame(time: number) {
      if (disposed || !ctx || !cv) return;
      // Skip drawing entirely on narrow layouts (canvas is display:none,
      // but clientWidth can still be 0 — cheap guard).
      if (W < 40 || H < 40) { raf = requestAnimationFrame(frame); return; }

      ctx.fillStyle = "rgba(5,6,11,0.26)";
      ctx.fillRect(0, 0, W, H);

      const portalEl = portalRef.current;
      if (!portalEl) { raf = requestAnimationFrame(frame); return; }
      const b = portalEl.getBoundingClientRect();
      const s = cv.getBoundingClientRect();
      const cx = b.left - s.left + b.width / 2;
      const cy = b.top - s.top + b.height / 2;
      const R = b.width / 2;
      const lc = { x: W * 0.845, y: H * 0.44, S: Math.min(H * 0.15, W * 0.075) };

      // strands
      for (const st of strands) {
        stepStrand(st, cx, cy, R);
        if (st.buf.length < 2) continue;
        ctx.strokeStyle = `rgba(158,182,255,${st.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(st.buf[0].x, st.buf[0].y);
        for (let i = 1; i < st.buf.length; i++) ctx.lineTo(st.buf[i].x, st.buf[i].y);
        ctx.stroke();
      }

      // lattice
      const ry = time * 0.00028;
      const rx = 0.42 + Math.sin(time * 0.00013) * 0.1;
      const cosy = Math.cos(ry), siny = Math.sin(ry);
      const cosx = Math.cos(rx), sinx = Math.sin(rx);
      const proj = LV.map((v) => {
        const X1 = v.x * cosy - v.z * siny;
        const Z1 = v.x * siny + v.z * cosy;
        const Y1 = v.y * cosx - Z1 * sinx;
        const Z2 = v.y * sinx + Z1 * cosx;
        return { x: lc.x + X1 * lc.S, y: lc.y + Y1 * lc.S, depth: Z2, v };
      });
      ctx.lineWidth = 0.6;
      for (const [a, bi] of LE) {
        const P = proj[a], Q = proj[bi];
        const depth = (P.depth + Q.depth) / 4 + 0.5;
        ctx.strokeStyle = `rgba(111,141,255,${0.06 + depth * 0.1})`;
        ctx.beginPath();
        ctx.moveTo(P.x, P.y);
        ctx.lineTo(Q.x, Q.y);
        ctx.stroke();
      }
      for (const P of proj) {
        const depth = P.depth / 2 + 0.5;
        const base = 0.3 + depth * 0.45;
        P.v.pulse *= 0.94;
        const pu = P.v.pulse;
        const rr = 1.4 + depth * 0.8 + pu * 2.5;
        ctx.fillStyle =
          pu > 0.05
            ? `rgba(${(140 + pu * 100) | 0},235,190,${Math.min(base + pu, 1)})`
            : `rgba(150,185,235,${base})`;
        ctx.beginPath();
        ctx.arc(P.x, P.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }

      // captions
      ctx.font = '500 8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = "rgba(115,125,142,0.7)";
      const t1 = "OPERATOR · RAW MOTION";
      ctx.fillText(t1, W * 0.155 - ctx.measureText(t1).width / 2, H * 0.44 + Math.min(H * 0.2, W * 0.1) * 1.75);
      const t2 = "ROBOT · EXECUTED SKILL";
      ctx.fillText(t2, lc.x - ctx.measureText(t2).width / 2, lc.y + lc.S * 2.6);

      // spinning conic ring around the portal
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.0006);
      if (typeof ctx.createConicGradient === "function") {
        const g = ctx.createConicGradient(0, 0, 0);
        g.addColorStop(0, "rgba(111,141,255,0)");
        g.addColorStop(0.35, "rgba(111,141,255,0.9)");
        g.addColorStop(0.5, "rgba(200,214,255,1)");
        g.addColorStop(0.65, "rgba(111,141,255,0.9)");
        g.addColorStop(1, "rgba(111,141,255,0)");
        ctx.strokeStyle = g;
      } else {
        ctx.strokeStyle = "rgba(111,141,255,0.8)";
      }
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.99, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // faint filaments portal → lattice
      for (const k of [-1, 0, 1]) {
        const br = 1 + 0.12 * Math.sin(time * 0.0004 + k * 2);
        const p0 = { x: cx + R * 0.999, y: cy };
        const p1 = { x: lc.x, y: lc.y };
        const dx = p1.x - p0.x, dy = p1.y - p0.y;
        const L = Math.hypot(dx, dy) || 1;
        const px = -dy / L, py = dx / L;
        const lane = k * H * 0.045 * br;
        const c = { x: (p0.x + p1.x) / 2 + px * lane, y: (p0.y + p1.y) / 2 + py * lane };
        ctx.strokeStyle = "rgba(111,141,255,0.04)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(c.x, c.y, p1.x, p1.y);
        ctx.stroke();
      }

      // out stream — uniform particles, no bright heads
      for (const p of out) {
        p.t += p.speed;
        const tgt = proj[p.tgt];
        const p0 = { x: cx, y: cy };
        const p1 = { x: tgt.x, y: tgt.y };
        const dx = p1.x - p0.x, dy = p1.y - p0.y;
        const L = Math.hypot(dx, dy) || 1;
        const px = -dy / L, py = dx / L;
        const c = {
          x: (p0.x + p1.x) / 2 + px * p.lane * H * 0.07,
          y: (p0.y + p1.y) / 2 + py * p.lane * H * 0.07,
        };
        const t = Math.min(p.t, 1);
        const u = 1 - t;
        const ptx0 = u * u * p0.x + 2 * u * t * c.x + t * t * p1.x;
        const pty0 = u * u * p0.y + 2 * u * t * c.y + t * t * p1.y;
        const jam = 0.2 * (1 - p.t);
        const ptx = ptx0 + Math.sin(p.t * 26 + p.seed) * 1.4 * jam;
        const pty = pty0 + Math.cos(p.t * 33 + p.seed * 2) * 1.4 * jam;
        if (p.t >= 1) { LV[p.tgt].pulse = 1; spawnOut(p, false); continue; }
        if (Math.hypot(ptx - cx, pty - cy) < R) continue;
        ctx.fillStyle = "rgba(140,235,190,0.5)";
        ctx.beginPath();
        ctx.arc(ptx, pty, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [portalRef]);

  return <canvas ref={canvasRef} className="sxrd-fx" aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────────────────────
// Portal media — scene preview video/image; live-session snapshot when busy.
// ─────────────────────────────────────────────────────────────────────────
function currentMinute() {
  return Math.floor(Date.now() / 60000);
}

function PortalMedia({
  sceneId,
  busy,
  serverHost,
}: {
  sceneId: string | null;
  busy: boolean;
  serverHost: string | null;
}) {
  const [minute, setMinute] = useState(currentMinute);
  const [snapErrored, setSnapErrored] = useState(false);

  // Minute-keyed snapshot refresh, paused while the tab is hidden
  // (per feedback_page_visibility_for_polling).
  useEffect(() => {
    function maybeRefresh() {
      if (typeof document !== "undefined" && document.hidden) return;
      const m = currentMinute();
      setMinute((prev) => (prev === m ? prev : m));
    }
    const interval = setInterval(maybeRefresh, 15_000);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, []);

  // Reset the snapshot error when the busy target changes.
  useEffect(() => {
    setSnapErrored(false);
  }, [sceneId, serverHost, busy]);

  if (!sceneId) {
    return <div className="ph">Next session<br />soon</div>;
  }

  if (busy && serverHost && !snapErrored) {
    return (
      <img
        src={`https://${serverHost}/api/operator-snapshot.jpg?t=${minute}`}
        alt="Live frame from the SIM XR session in progress"
        onError={() => setSnapErrored(true)}
        loading="lazy"
      />
    );
  }

  const asset = SCENE_ASSETS[sceneId];
  if (!asset) {
    return <div className="ph">Live SIM XR<br />demo</div>;
  }
  if (asset.type === "video") {
    return (
      <video
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
  return <img src={asset.src} alt="" loading="lazy" />;
}

// ─────────────────────────────────────────────────────────────────────────
// Fleet helpers
// ─────────────────────────────────────────────────────────────────────────
type HeroPick = {
  snapshot: ServerSnapshot;
  sceneId: string;
  busy: boolean;
};

function isBusyHealth(h: Healthz): boolean {
  return h.session_state === "streaming" && h.active_clients > 0;
}

function pickHero(
  snapshots: ServerSnapshot[],
  preferredServerId: string | null,
): HeroPick | null {
  const live = snapshots.filter(
    (s): s is ServerSnapshot & { health: Healthz } =>
      !!s.health && !!s.health.live_scene,
  );
  if (live.length === 0) return null;
  const toPick = (s: ServerSnapshot & { health: Healthz }): HeroPick => ({
    snapshot: s,
    sceneId: s.health.live_scene as string,
    busy: isBusyHealth(s.health),
  });
  if (preferredServerId) {
    const pref = live.find((s) => s.server.id === preferredServerId);
    if (pref) return toPick(pref);
  }
  // live-ready first, then busy
  const ready = live.find((s) => !isBusyHealth(s.health));
  return toPick(ready ?? live[0]);
}

type MiniState = "live" | "busy" | "off" | "broken";

function miniStateOf(scene: Scene, snapshots: ServerSnapshot[]): {
  state: MiniState;
  serverId: string | null;
} {
  if (scene.status === "broken") return { state: "broken", serverId: null };
  for (const s of snapshots) {
    if (s.health?.live_scene === scene.id) {
      return {
        state: isBusyHealth(s.health) ? "busy" : "live",
        serverId: s.server.id,
      };
    }
  }
  return { state: "off", serverId: null };
}

function MiniThumb({ sceneId }: { sceneId: string }) {
  const asset = SCENE_ASSETS[sceneId];
  if (!asset) return null;
  if (asset.type === "video") {
    return (
      <video src={asset.src} poster={asset.poster} autoPlay muted loop playsInline preload="metadata" />
    );
  }
  return <img src={asset.src} alt="" loading="lazy" />;
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────
const FLEET_POLL_MS = 10_000;

export default function Demo() {
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [snapshots, setSnapshots] = useState<ServerSnapshot[]>([]);
  const [fleetLoaded, setFleetLoaded] = useState(false);
  const [preferredServerId, setPreferredServerId] = useState<string | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // Health/latency polling is done here via fetchFleet (both servers at
  // once); the hook's own poller is disabled to avoid double-polling.
  // connect() runs its own preflight against the specific server.
  const session = useCloudXRSession({ healthPollMs: 0 });

  useEffect(() => {
    let cancelled = false;
    fetchScenes()
      .then((s) => {
        if (!cancelled) setScenes(s);
      })
      .catch(() => {
        if (!cancelled) setScenes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // `force` — the very first fetch must run even in a hidden/background
    // tab (users open /demo links in background tabs; and without it the
    // page sits on "Checking…" until the tab is focused). Only the
    // periodic re-polls pause while hidden.
    async function tick(force = false) {
      if (!force && typeof document !== "undefined" && document.hidden) return;
      const snaps = await fetchFleet();
      if (!cancelled) {
        setSnapshots(snaps);
        setFleetLoaded(true);
      }
    }
    void tick(true);
    const interval = setInterval(() => void tick(), FLEET_POLL_MS);
    const onVis = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const hero = useMemo(
    () => pickHero(snapshots, preferredServerId),
    [snapshots, preferredServerId],
  );

  const heroScene = useMemo(() => {
    if (!hero || !scenes) return null;
    return scenes.find((s) => s.id === hero.sceneId) ?? null;
  }, [hero, scenes]);

  const heroTitle = hero
    ? heroScene?.name && heroScene.name !== heroScene.id
      ? heroScene.name
      : "Live SIM XR Demo"
    : null;

  const sessionInFlight = session.state !== "idle" && session.state !== "error";
  const isBusy = hero?.busy ?? false;

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
        if (!hero) return "Connect";
        if (isBusy) {
          const wait = formatWaitTime(hero.snapshot.health?.wait_time_seconds);
          return wait ? `In session · free in ${wait}` : "In session — try again soon";
        }
        return "Connect";
    }
  })();

  const connectDisabled =
    sessionInFlight || isBusy || !hero || heroScene?.status === "broken";

  // Secondary rail: curated scenes only (name !== id), excluding the hero.
  // live/busy first, then available, broken last; capped at 5 to keep the
  // page calm.
  const minis = useMemo(() => {
    if (!scenes) return [];
    const order: Record<MiniState, number> = { live: 0, busy: 1, off: 2, broken: 3 };
    return scenes
      .filter((s) => s.name !== s.id)
      .filter((s) => s.id !== hero?.sceneId)
      .map((s) => ({ scene: s, ...miniStateOf(s, snapshots) }))
      .sort((a, b) => order[a.state] - order[b.state])
      .slice(0, 5);
  }, [scenes, snapshots, hero]);

  const anyLive = snapshots.some((s) => s.health?.live_scene);

  // Fleet summary for the footer, e.g. "EU · Frankfurt idle 132ms".
  const fleetSummary = snapshots
    .map((s) => {
      const st = !s.health ? "offline" : s.health.live_scene ? "live" : "idle";
      const lat = s.latencyMs !== null ? ` ${s.latencyMs}ms` : "";
      return `${s.server.label} — ${st}${lat}`;
    })
    .join("  ·  ");

  const updatedTs = hero?.snapshot.health?.ts
    ? new Date(hero.snapshot.health.ts).toISOString().slice(11, 19) + "Z"
    : null;

  return (
    <Suspense fallback={null}>
      <Fonts />
      <style>{CSS}</style>
      <div className="sxrd-root">
        <header className="sxrd-header">
          <span className="sxrd-mark">
            SIM <span>XR.</span>
            <small>/ DEMO</small>
          </span>
          <span className={`sxrd-hstat ${anyLive ? "live" : "idle"}`}>
            <i />
            {anyLive ? "Scene live" : fleetLoaded ? "Between sessions" : "Checking…"}
          </span>
        </header>

        <div className="sxrd-stage">
          <FxCanvas portalRef={portalRef} />

          <div className="sxrd-portalcol">
            {session.error && <div className="sxrd-error">{session.error}</div>}

            <div className="sxrd-portal" ref={portalRef}>
              <div className="pv">
                <PortalMedia
                  sceneId={hero?.sceneId ?? null}
                  busy={isBusy}
                  serverHost={hero?.snapshot.server.host ?? null}
                />
              </div>
              <div className="b">
                {hero ? (
                  isBusy ? (
                    <span className="sxrd-badge busy">
                      <i />
                      In session · {hero.snapshot.health?.active_clients ?? 1} operator
                    </span>
                  ) : (
                    <span className="sxrd-badge live">
                      <i />
                      Live now
                    </span>
                  )
                ) : (
                  <span className="sxrd-badge off">
                    <i />
                    Between sessions
                  </span>
                )}
              </div>
            </div>

            <div className="sxrd-tt">
              {hero && heroTitle ? (
                <>
                  <h1>{heroTitle}</h1>
                  <div className="sub">
                    {robotLabel(hero.sceneId)} · {skillTag(hero.sceneId)}
                  </div>
                </>
              ) : (
                <>
                  <h1>Nothing live right now</h1>
                  <div className="sub">Sessions are scheduled with the team</div>
                </>
              )}
            </div>

            {hero && (
              <div className="sxrd-telemetry">
                <div className="cell">
                  <div className="l">Server</div>
                  <div className="v">{hero.snapshot.server.label}</div>
                </div>
                <div className="cell">
                  <div className="l">Latency</div>
                  <div className="v">
                    {hero.snapshot.latencyMs !== null
                      ? `${hero.snapshot.latencyMs} ms`
                      : "—"}
                  </div>
                </div>
                <div className="cell">
                  <div className="l">Operators</div>
                  <div className="v">{hero.snapshot.health?.active_clients ?? 0}</div>
                </div>
                {updatedTs && (
                  <div className="cell">
                    <div className="l">Updated</div>
                    <div className="v">{updatedTs}</div>
                  </div>
                )}
              </div>
            )}

            {hero ? (
              <>
                <button
                  type="button"
                  className="sxrd-connect"
                  disabled={connectDisabled}
                  onClick={() => {
                    // Must stay synchronous in the click handler — WebXR
                    // requestSession requires the user-gesture context.
                    if (!connectDisabled && hero) {
                      void session.connect(hero.sceneId, hero.snapshot.server);
                    }
                  }}
                >
                  {connectLabel}
                </button>
                <div className="sxrd-hint">
                  Quest 3 · open this page in Meta Browser · one tap
                </div>
              </>
            ) : (
              <a className="sxrd-connect ghost" href="https://simxr.tech" style={{ textDecoration: "none" }}>
                Learn more on simxr.tech
              </a>
            )}
          </div>

          {minis.length > 0 && (
            <div className="sxrd-others">
              <div className="k">Also in the catalog</div>
              <div className="sxrd-minis">
                {minis.map(({ scene, state, serverId }) => {
                  const clickable = (state === "live" || state === "busy") && serverId;
                  return (
                    <div
                      key={scene.id}
                      className={[
                        "sxrd-mini",
                        state === "off" || state === "broken" ? "off" : "",
                        state === "busy" ? "busy" : "",
                        state === "live" ? "is-live" : "",
                        clickable ? "clickable" : "",
                      ].join(" ")}
                      onClick={() => {
                        if (clickable) setPreferredServerId(serverId);
                      }}
                      title={clickable ? "Show this scene" : undefined}
                    >
                      <div className="thumb">
                        <MiniThumb sceneId={scene.id} />
                        <span className="b">
                          {state === "live" && (
                            <span className="sxrd-badge live"><i />Live</span>
                          )}
                          {state === "busy" && (
                            <span className="sxrd-badge busy"><i />In session</span>
                          )}
                          {state === "off" && (
                            <span className="sxrd-badge off"><i />Offline</span>
                          )}
                          {state === "broken" && (
                            <span className="sxrd-badge off"><i />Unavailable</span>
                          )}
                        </span>
                      </div>
                      <div className="nm">{scene.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="sxrd-footer">
          <span>SIM XR — teleop network</span>
          <span>{fleetSummary || "connecting to fleet…"}</span>
          <span>powered by NVIDIA CloudXR</span>
        </footer>
      </div>
    </Suspense>
  );
}
