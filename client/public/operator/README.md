# simxr-operator — public landing (deployed)

Live: https://simxr-operator.netlify.app

This is the **public** branch of the operator product. The full prototype (with working dashboard / task / session / earnings views) lives in `../operator-app/` and stays unpublished.

## What's here

- `index.html` — public landing. CTAs lead to the in-page application form, not into the cockpit. Quest 3 and Vision Pro mention is for context only.
- `app.html` — operator cockpit prototype, accessible at `/app.html` by direct URL only (no link from the landing). Used for internal demos and partner walk-throughs.
- `thanks.html` — post-application confirmation page.
- `images/` — drop hero / robot / scene illustrations here, reference as `images/<name>.<ext>` from `index.html`.

## Application form

The form on `/#apply` is a Netlify Form (`name="operator-application"`). On first deploy, Netlify auto-detects it. Submissions land in:

1. **Netlify dashboard** → Site → Forms → operator-application.
2. **Email notifications** to `mk@simxr.tech` (and any other addresses) — configured in Netlify dashboard → Site → Forms → Form notifications → Add notification → Email.

Adding the email notification is a one-time, one-minute step in the Netlify UI. Until it's added, submissions still record in the dashboard but no email goes out.

## Deploy

See `../DEPLOY.md`. Short version:

```bash
cd ~/Documents/Claude/Projects/Sim\ XR/web/operator
netlify deploy --prod --dir=.
```

## Why two folders

- `operator-app/` — design fidelity. Everything wired, dashboards working, task picker visible. Where we iterate on what the cockpit *should* look like.
- `web/operator/` — what we want public eyeballs on right now. Subset of the prototype, simpler, with a real apply form and no silent doorway into the cockpit.

When auth lands, the two collapse back into one product.
