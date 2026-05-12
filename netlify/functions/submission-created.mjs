// SIM XR — Netlify form submission auto-handler.
//
// Netlify fires the special `submission-created` event for every form
// submission across the site. This function receives the payload, decides
// whether the form is one we want to auto-respond to, and sends a confirmation
// email to the submitter.
//
// Setup:
//   1. Sign up for Resend (resend.com — free 3000 emails/month, no card)
//   2. Create an API key in Resend dashboard
//   3. Add `RESEND_API_KEY` to Netlify env vars (Site settings → Environment)
//   4. Optionally verify simxr.tech domain in Resend for better deliverability.
//      Until verified, the function uses Resend's shared `onboarding@resend.dev`
//      address. Once verified, set `RESEND_FROM_EMAIL=welcome@simxr.tech`.
//
// Safety: if RESEND_API_KEY is not set, the function logs and returns success
// WITHOUT sending. This means deploying the function before key setup is safe
// — no half-broken state, no thrown errors that block other form submissions.
//
// Form gating: only `operator-waitlist` triggers an email. Any other form
// (early-access, collaboration, etc.) is logged but skipped. Add to the
// `AUTORESPOND_FORMS` set below to enable confirmations for additional forms.
//
// Copy source: `Sim XR/06_outreach/operator_waitlist_confirmation_email_2026-05-12.md`
// Email body must stay in sync with that file — any voice/messaging change
// goes there first, then mirrors here. Keep them at parity until we refactor
// to a shared templates module.

const AUTORESPOND_FORMS = new Set(["operator-waitlist"]);

// Address Resend should use as the From header. The fallback works on any
// Resend account without DNS verification; the simxr.tech-verified address
// is preferred once DNS records are in.
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "SIM XR <onboarding@resend.dev>";

// Sender label for the From header. Plain "SIM XR Team" reads more like a
// real person than the verified-address-only fallback.
const REPLY_TO = process.env.RESEND_REPLY_TO || undefined;

// Failsafe wrapper — wraps the send so a missing key, a Resend 4xx, or a
// network blip never throws an uncaught error back to Netlify. Returns a
// {sent: boolean, reason?: string} status for the function's response body.
async function sendViaResend({ to, name }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      sent: false,
      reason: "RESEND_API_KEY not configured — confirmation email skipped",
    };
  }

  const friendly = (name || "").trim() || "friend";
  const subject = "You're on the SIM XR operator waitlist";

  // Plain-text body. Mirrors `06_outreach/operator_waitlist_confirmation_email_2026-05-12.md`.
  // Update both files together if voice/messaging changes.
  const text = `Hi ${friendly},

You're on the SIM XR operator waitlist. Thanks for signing up.

Here's what happens next:

— Soon we'll invite you to try a live demo so you can see what an operator session looks like and tune your headset setup.
— After that, we'll roll out operator access in small batches. When your slot opens, you'll get one email with a calibration link and a short walkthrough.
— You don't need to do anything in the meantime. Keep your Quest 3 / Vision Pro / Pico headset charged and ready.
— Sessions are paid, and you can pick when to run them.

A note on what SIM XR does: humanoid robots need millions of human-recorded demonstrations to learn manipulation tasks. Today those demonstrations are collected in lab studios at high cost. We move that work to consumer VR headsets — you teleoperate a simulated humanoid robot from your couch, and your recorded sessions become training data for the next generation of robot policies. Your work, robot's learning.

Reply to this email if you have questions.

— The SIM XR team
  simxr.tech
`;

  // HTML body — minimal brand-aligned styling, single column, mobile-readable.
  // Inline styles only (email clients strip <style> blocks). Matches operator
  // landing's brand palette (#0057FF volt, #FBF9F4 paper, #111217 charcoal).
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#FBF9F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#111217;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FBF9F4;">
    <tr><td align="center" style="padding:36px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background:#ffffff;border:1px solid rgba(17,18,23,0.06);border-radius:14px;overflow:hidden;">
        <tr><td style="padding:24px 28px 8px;">
          <div style="font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.02em;color:#111217;">
            SIM <span style="color:#0057FF;">XR.</span>
          </div>
        </td></tr>
        <tr><td style="padding:18px 28px 4px;">
          <div style="font-family:'IBM Plex Mono',Menlo,monospace;font-size:12px;letter-spacing:0.12em;color:#0057FF;text-transform:uppercase;">You're on the list</div>
        </td></tr>
        <tr><td style="padding:6px 28px 14px;">
          <h1 style="margin:0;font-size:24px;line-height:1.2;letter-spacing:-0.015em;color:#111217;font-weight:600;">Welcome to the SIM XR operator waitlist.</h1>
        </td></tr>
        <tr><td style="padding:0 28px;font-size:15px;line-height:1.6;color:rgba(17,18,23,0.78);">
          <p style="margin:0 0 14px;">Hi ${escapeHtml(friendly)} — thanks for signing up.</p>
          <p style="margin:0 0 14px;">Here's what happens next:</p>
          <ul style="margin:0 0 14px;padding:0 0 0 18px;">
            <li style="margin-bottom:8px;">Soon we'll invite you to try a live demo so you can see what an operator session looks like and tune your headset setup.</li>
            <li style="margin-bottom:8px;">After that, we'll roll out operator access in small batches. When your slot opens, you'll get one email with a calibration link and a short walkthrough.</li>
            <li style="margin-bottom:8px;">You don't need to do anything in the meantime. Keep your Quest 3 / Vision Pro / Pico headset charged and ready.</li>
            <li style="margin-bottom:8px;">Sessions are paid, and you can pick when to run them.</li>
          </ul>
          <p style="margin:0 0 14px;">A note on what SIM XR does: humanoid robots need millions of human-recorded demonstrations to learn manipulation tasks. Today those demonstrations are collected in lab studios at high cost. We move that work to consumer VR headsets &mdash; you teleoperate a simulated humanoid robot from your couch, and your recorded sessions become training data for the next generation of robot policies. Your work, robot's learning.</p>
          <p style="margin:0 0 22px;">Reply to this email if you have questions.</p>
          <p style="margin:0 0 8px;color:#111217;">&mdash; The SIM XR team</p>
          <p style="margin:0 0 28px;"><a href="https://simxr.tech" style="color:#0057FF;text-decoration:none;font-family:'IBM Plex Mono',Menlo,monospace;font-size:12px;letter-spacing:0.04em;">simxr.tech</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const payload = {
    from: FROM_EMAIL,
    to: [to],
    subject,
    text,
    html,
    ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
    // Tag for Resend's analytics — see opens/clicks by source form.
    tags: [{ name: "source", value: "operator-waitlist" }],
  };

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { sent: false, reason: `network error: ${e?.message ?? e}` };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "<no body>");
    return {
      sent: false,
      reason: `Resend HTTP ${response.status}: ${detail.slice(0, 240)}`,
    };
  }

  return { sent: true };
}

// Minimal HTML escaper for the {name} interpolation. Doesn't need to be
// XSS-grade because the value comes from a Netlify Form on our own site —
// but defense-in-depth keeps the email rendering predictable if anyone
// pastes <script> as their name.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Netlify Functions handler. The `submission-created` event payload shape is:
//   { payload: { form_name, data: { name, email, ... }, ... } }
// See https://docs.netlify.com/forms/notifications/#enable-form-notifications
export default async (req, _context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: "invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const submission = body?.payload ?? body;
  const formName =
    submission?.form_name ?? submission?.data?.["form-name"] ?? null;
  const data = submission?.data ?? {};

  if (!formName || !AUTORESPOND_FORMS.has(formName)) {
    return new Response(
      JSON.stringify({
        ok: true,
        sent: false,
        reason: `form "${formName}" is not in autorespond set`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const email = (data.email || "").trim().toLowerCase();
  const name = data.name || "";

  // Basic email shape check — Netlify already runs HTML5 type=email validation
  // client-side and on submission, but extra cheap check here in case the form
  // is hit programmatically.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(
      JSON.stringify({ ok: false, reason: "missing or invalid email field" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const result = await sendViaResend({ to: email, name });

  // Log line for Netlify Function logs — viewable in Netlify dashboard
  // (Site → Functions → submission-created → Logs). Useful for debugging
  // "form filed but I never got an email" complaints.
  console.log(
    JSON.stringify({
      event: "submission-created",
      form: formName,
      email_domain: email.split("@")[1] ?? null,
      sent: result.sent,
      reason: result.reason ?? null,
    }),
  );

  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
