# operator — public landing

Live: **https://simxr.tech/operator/**

Part of the main `simxr-website` repo. The site deploys from GitHub (`main`) to the
Netlify project **`simxr-tech`** (slug has a hyphen; `simxr.tech` is the domain). The old
standalone `simxr-operator.netlify.app` (project `simxr-operator`, form `operator-application`)
is **deprecated** — don't use it. The full cockpit prototype (dashboard / task / session /
earnings views) lives in `../operator-app/` and stays unpublished.

## What's here

- `index.html` — public landing. CTAs lead to the in-page waitlist form, not into the cockpit. Quest 3 / Vision Pro mention is for context only.
- `app.html` — operator cockpit prototype, accessible at `/app.html` by direct URL only (no link from the landing). Internal demos / partner walk-throughs.
- `thanks.html` — post-submission confirmation page. Reached via the form action `/operator/thanks` (rewritten to `thanks.html` in `netlify.toml`).
- `images/` — hero / robot / scene illustrations, referenced as `/operator/images/<name>.<ext>`.

## Waitlist form

The form is a Netlify Form **`name="operator-waitlist"`** (NOT `operator-application` — that was the old landing). Netlify auto-detects it from the published HTML. Fields: `name`, `email`, `headsets[]`, `location`, `vr_experience`, `acknowledged`. Submissions land in:

1. **Netlify dashboard** → project `simxr-tech` → Forms → `operator-waitlist`. Direct inbox: `https://app.netlify.com/projects/simxr-tech/forms/69f28688f28d7a0008d44088`.
2. **Email notification** to `mk@simxr.tech` (configured in Netlify → Forms → Form notifications). This is live and correct.
3. **Confirmation email to the applicant** — the Netlify Function `../../netlify/functions/submission-created.mjs` listens for `operator-waitlist` submissions and sends a confirmation via Resend (From `SIM XR <welcome@simxr.app>`, Reply-To `mk@simxr.tech`). Copy + setup notes: `06_outreach/operator_waitlist_confirmation_email_2026-05-12.md` in the project root.

## Deploy

Deploys automatically on push to `main` (GitHub → Netlify project `simxr-tech`). Build config: `netlify.toml` at repo root (`pnpm run build:scenes-fallback && pnpm vite build`, publish `dist/public`). No manual `netlify deploy` from this folder.

## Why two folders

- `operator-app/` — design fidelity. Everything wired, dashboards working, task picker visible. Where we iterate on what the cockpit *should* look like.
- `client/public/operator/` (this folder) — what we want public eyeballs on right now. Subset of the prototype, simpler, with a real waitlist form and no silent doorway into the cockpit.

When auth lands, the two collapse back into one product.
