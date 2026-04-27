# SIM XR — simxr.tech

Public landing page for SIM XR, deployed on Netlify.

**Live:** https://simxr.tech · **Operator side:** https://simxr.tech/operator/

---

## How edits get to the live site

Push to `main` → Netlify auto-builds → live in ~30 seconds. No manual deploy step. No approval gate (whatever lands on `main` is what visitors see).

**Access needed:** GitHub collaborator on this repo. Nothing else. Netlify access is optional. If you don't have access yet, ask Mike to add you on github.com → repo Settings → Collaborators.

## Edit cycle

```bash
# one-time
git clone git@github.com:mikhailkats/simxr-website.git
cd simxr-website
pnpm install     # only needed if running locally; not required just to commit

# normal cycle
git pull
# ...edit files...
git add -A
git commit -m "what changed"
git push
```

## Where things live

```
client/
  index.html                 ← page <head>, meta tags, hidden Netlify Forms
  src/pages/Home.tsx         ← MAIN PAGE: all sections, copy, forms
  public/
    images/                  ← Main page images (jpg/webp)
    operator/                ← OPERATOR PAGE (plain HTML)
      index.html             ←   operator landing page
      thanks.html            ←   form-success page
      images/                ←   operator-specific images
netlify.toml                 ← build config (do not edit unless you mean to)
```

Most edits land in `client/src/pages/Home.tsx` or `client/public/operator/index.html`. Don't touch `vite.config.ts`, `package.json`, `pnpm-lock.yaml`, or the `server/` / `drizzle/` folders without good reason.

## Forms

Three forms wire to Netlify Forms (no third-party services). All submissions auto-email `mk@simxr.tech` and appear at https://app.netlify.com/projects/simxr-tech/forms.

| Form name              | Where                       | Fields                              |
|------------------------|-----------------------------|-------------------------------------|
| `early-access`         | Home.tsx                    | name, company, email, task, demos   |
| `collaboration`        | Home.tsx                    | name, email, area, message          |
| `operator-application` | operator/index.html         | name, email, location               |

If you change a form's field names, also change the matching hidden form in `client/index.html` — they have to stay in sync or Netlify won't accept submissions.

## Verifying a deploy

1. After push, watch deploy at https://app.netlify.com/projects/simxr-tech/deploys. Green check ≈ live.
2. Hard refresh the live page (Cmd-Shift-R / Ctrl-Shift-F5).
3. If anything looks wrong — see Rollback below.

## Rollback (if a commit breaks the site)

**One-click in Netlify:** Deploys page → find the last green deploy → **Publish** on it. Site reverts immediately.

**Or via git:**

```bash
git revert HEAD       # creates a new commit that undoes the last one
git push
```

## House rules

- Push only to `main` for content edits. Branch pushes give preview URLs (good for testing big changes), not the live site.
- One change per commit when possible — easier to roll back precisely.
- For text edits in Home.tsx, stay inside string literals. Don't restructure JSX unless you know React.
- For image swaps: drop the file in `client/public/images/` (main) or `client/public/operator/images/` (operator), then reference it as `/images/yourfile.jpg` or `/operator/images/yourfile.png`.

## Local development (optional)

You don't need to run the site locally to edit it — push and the live URL shows the result. But if you want to:

```bash
pnpm install
pnpm vite        # dev server on http://localhost:5173, hot reload
```

For a production build locally:

```bash
pnpm vite build  # outputs to dist/public/
```

> **Do not use `pnpm build`** — that script also bundles the unused Express server and is left over from the original Manus scaffolding. Netlify uses `pnpm vite build` per `netlify.toml`.

## Quick links

- Repo: https://github.com/mikhailkats/simxr-website
- Deploys: https://app.netlify.com/projects/simxr-tech/deploys
- Forms inbox: https://app.netlify.com/projects/simxr-tech/forms
- Live: https://simxr.tech and https://simxr.tech/operator/
- Staging URL: https://simxr-tech.netlify.app

## History

Previously hosted on Manus. Migrated to Netlify on 2026-04-27. The pre-Manus static landing page is archived at `../web/_archive_simxr-tech-static_2026-04-25/`. The `server/`, `drizzle/`, and `shared/` folders are dead code from the original Manus scaffolding — kept in case we add a real backend later.
