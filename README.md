# SIM XR — simxr.tech

Public-facing landing page for SIM XR, deployed on Netlify.

**Live:** https://simxr.tech

## Stack

- **React 19 + TypeScript** with Vite 7 build
- **Tailwind CSS 4** + shadcn/ui components
- **wouter** for client-side routing
- Hosted on **Netlify**, forms handled by **Netlify Forms**

## Local development

```bash
pnpm install
pnpm vite      # dev server on http://localhost:5173
```

## Build

```bash
pnpm vite build      # outputs to dist/public/
```

Netlify runs the same `pnpm vite build` on push to `main` (see `netlify.toml`).

> **Do not use `pnpm build`** — that script also bundles the unused Express server
> and is left over from the original Manus scaffolding.

## Forms

Two forms are wired through Netlify Forms:

- `early-access` — Request Early Access modal
- `collaboration` — Contact / Collaborator modal

Both submit via `fetch("/", ...)` from React. The hidden static counterparts in
`client/index.html` (`<form name="..." netlify hidden>`) are what Netlify scans
at build time to register the forms. Submissions land in the Netlify dashboard
under **Forms** and email notifications can be configured there.

If you change a form field name in `Home.tsx`, also change it in the matching
hidden form in `client/index.html` — they have to stay in sync.

## Deploy

Push to `main` → Netlify auto-builds and deploys.

For preview deploys without merging to main, push to any other branch and
Netlify will give it a unique `*--<branch>--simxr-tech.netlify.app` URL.

## Editing for non-coders

- Text changes: edit `client/src/pages/Home.tsx`
- Image swaps: drop a new file in `client/public/images/` and update the
  `SIMULATION_SCENE` / `VR_USER` / `FOUNDER_PHOTO` constants at the top of
  `Home.tsx`
- Meta tags / page title: `client/index.html`

GitHub web editor (the pencil icon when viewing a file on github.com) is fine
for any of the above — commit on the branch, Netlify deploys automatically.

## History

Previously hosted on Manus. Migrated to Netlify on 2026-04-27.
The original static landing page (pre-Manus) lives at
`../web/_archive_simxr-tech-static_2026-04-25/` for reference.

The `server/`, `drizzle/`, and `shared/` folders are dead code from the original
Manus scaffolding — kept for now in case we want to add a real backend later.
The current site is fully static (no backend at runtime).
