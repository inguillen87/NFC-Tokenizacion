export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";

function env(name: string) {
  return String(process.env[name] || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function normalizePhone(input: unknown) {
  const raw = String(input || "").trim();
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return raw.startsWith("+") ? `+${digits}` : `+${digits}`;
}

function maskPhone(phone: string) {
  return `${phone.slice(0, 5)}***${phone.slice(-3)}`;
}

function clampBody(input: unknown) {
  return String(input || "").trim().slice(0, 1024);
}

function normalizeQuickReplies(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const title = String(raw.title || "").trim().slice(0, 20);
      const id = String(raw.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "_")).trim().slice(0, 200);
      return title && id ? { title, id } : null;
    })
    .filter(Boolean)
    .slice(0, 3) as Array<{ title: string; id: string }>;
}

async function createInteractiveContent(input: {
  accountSid: string;
  authToken: string;
  body: string;
  actions: Array<{ title: string; id: string }>;
}) {
  const basic = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64");
  const actionItems = input.actions.map((item) => ({
    type: "QUICK_REPLY",
    title: item.title,
    id: item.id,
  }));
  const types: Record<string, unknown> = {
    "twilio/text": {
      body: `${input.body}\nResponde ${input.actions.map((item) => item.title.toUpperCase()).join(" o ")}.`,
    },
  };
  types["twilio/quick-reply"] = {
    body: input.body,
    actions: input.actions,
  };

  const response = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: `nexid_sandbox_quick_reply_${Date.now()}`,
      language: "es",
      types,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`twilio_content_failed:${response.status}:${result?.message || result?.code || "unknown"}`);
  }
  return String(result?.sid || "");
}

async function sendTwilioMessage(input: {
  accountSid: string;
  authToken: string;
  form: URLSearchParams;
}) {
  const basic = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: input.form,
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const payload = await req.json().catch(() => ({}));
  const toPhone = normalizePhone(payload?.to);
  const body = clampBody(payload?.body);
  const confirmRecipientOptIn = payload?.confirmRecipientOptIn === true;
  const sandbox = payload?.sandbox !== false;
  const quickReplies = normalizeQuickReplies(payload?.quickReplies);

  if (!confirmRecipientOptIn) {
    return json({ ok: false, reason: "recipient_opt_in_required" }, 400);
  }
  if (!toPhone) {
    return json({ ok: false, reason: "recipient_phone_required" }, 400);
  }
  if (!body || body.length < 20) {
    return json({ ok: false, reason: "message_body_too_short" }, 400);
  }
  if (!sandbox) {
    return json({ ok: false, reason: "sandbox_only_endpoint" }, 400);
  }

  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  const configuredFrom = env("TWILIO_WHATSAPP_FROM") || env("TWILIO_FROM_WHATSAPP");
  const from = configuredFrom ? `whatsapp:${configuredFrom.replace(/^whatsapp:/, "")}` : "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    return json({ ok: false, reason: "twilio_credentials_missing" }, 503);
  }

  const form = new URLSearchParams();
  form.set("To", `whatsapp:${toPhone}`);
  form.set("From", from);
  let contentSid: string | null = null;
  if (quickReplies.length) {
    contentSid = await createInteractiveContent({ accountSid, authToken, body, actions: quickReplies });
    form.set("ContentSid", contentSid);
  } else {
    form.set("Body", body);
  }

  const { response, result } = await sendTwilioMessage({ accountSid, authToken, form });
  if (!response.ok) {
    return json({
      ok: false,
      reason: "twilio_delivery_failed",
      status: response.status,
      to: maskPhone(toPhone),
      from,
      twilio: {
        code: result?.code || null,
        message: result?.message || null,
        moreInfo: result?.more_info || null,
      },
    }, 502);
  }

  return json({
    ok: true,
    sid: result?.sid || null,
    contentSid,
    mediaUrl: null,
    status: result?.status || "queued",
    to: maskPhone(toPhone),
    from,
  });
}
