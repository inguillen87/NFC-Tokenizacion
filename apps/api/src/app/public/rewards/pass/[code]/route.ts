export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import QRCode from "qrcode";
import sharp from "sharp";
import { sql } from "../../../../../lib/db";

function clean(value: unknown) {
  return String(value || "").trim();
}

function escapeXml(value: unknown) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validCode(value: string) {
  return /^\d{6,10}$/.test(value);
}

function formatCode(value: string) {
  return value.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function firstName(value: unknown) {
  const name = clean(value);
  return name ? name.split(/\s+/)[0] : "Cliente";
}

function truncate(value: unknown, max: number) {
  const text = clean(value);
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function formatArDate(value: unknown) {
  const date = new Date(clean(value));
  if (Number.isNaN(date.getTime())) return "48h desde emision";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

async function getClaim(code: string) {
  try {
    const rows = await sql/*sql*/`
      SELECT
        c.redemption_code,
        c.status,
        c.metadata_json,
        c.created_at,
        r.title AS reward_title,
        r.code AS reward_code,
        con.display_name,
        con.phone,
        con.email,
        t.slug AS tenant_slug,
        COALESCE((c.metadata_json->>'expires_at')::timestamptz, c.created_at + interval '48 hours') AS expires_at
      FROM consumer_reward_claims c
      JOIN rewards r ON r.id = c.reward_id
      JOIN consumers con ON con.id = c.consumer_id
      JOIN tenants t ON t.id = c.tenant_id
      WHERE c.redemption_code = ${code}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function renderVoucherPng(input: {
  code: string;
  seal: string;
  tenant: string;
  rewardTitle: string;
  consumerName: string;
  phoneLast4: string;
  expiresAt: string;
  status: string;
}) {
  const qrPayload = `nexid:voucher:${input.tenant}:${input.code}${input.seal ? `:${input.seal}` : ""}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 330,
    color: { dark: "#020617", light: "#ffffff" },
  });
  const codeText = escapeXml(formatCode(input.code));
  const sealText = escapeXml(input.seal || "SIN SELLO");
  const tenantText = escapeXml(input.tenant);
  const rewardText = escapeXml(truncate(input.rewardTitle, 58));
  const nameText = escapeXml(firstName(input.consumerName));
  const expiresText = escapeXml(formatArDate(input.expiresAt));
  const phoneText = input.phoneLast4 ? `****${escapeXml(input.phoneLast4)}` : "telefono verificado";
  const statusLabel = input.status === "redeemed" ? "canjeado" : input.status === "expired" ? "vencido" : "activo";
  const statusText = escapeXml(statusLabel);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#020617"/>
          <stop offset="48%" stop-color="#071827"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="cyan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#22d3ee"/>
          <stop offset="100%" stop-color="#34d399"/>
        </linearGradient>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="16" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="900" height="1200" rx="54" fill="url(#bg)"/>
      <rect x="34" y="34" width="832" height="1132" rx="44" fill="none" stroke="#22d3ee" stroke-opacity=".35" stroke-width="2"/>
      <circle cx="760" cy="118" r="96" fill="#22d3ee" opacity=".12" filter="url(#glow)"/>
      <circle cx="142" cy="1030" r="126" fill="#7c3aed" opacity=".12" filter="url(#glow)"/>

      <g transform="translate(68 70)">
        <rect x="0" y="0" width="96" height="96" rx="26" fill="#0b1f33" stroke="#22d3ee" stroke-opacity=".38"/>
        <text x="24" y="63" fill="#f8fafc" font-family="Inter,Arial,sans-serif" font-size="43" font-weight="900">N</text>
        <text x="62" y="63" fill="#2dd4bf" font-family="Inter,Arial,sans-serif" font-size="43" font-weight="900">i</text>
        <circle cx="76" cy="25" r="8" fill="#34d399"/>
        <text x="122" y="34" fill="#67e8f9" font-family="Inter,Arial,sans-serif" font-size="16" font-weight="900" letter-spacing="4">NEXID VERIFIED CRM</text>
        <text x="122" y="68" fill="#e2e8f0" font-family="Inter,Arial,sans-serif" font-size="32" font-weight="900">Voucher seguro post-tap</text>
      </g>

      <g transform="translate(648 82)">
        <rect x="0" y="0" width="160" height="54" rx="27" fill="#052e2b" stroke="#34d399" stroke-opacity=".42"/>
        <circle cx="31" cy="27" r="8" fill="#34d399"/>
        <text x="49" y="33" fill="#bbf7d0" font-family="Inter,Arial,sans-serif" font-size="16" font-weight="800">${statusText}</text>
      </g>

      <g transform="translate(68 214)">
        <text x="0" y="0" fill="#a5f3fc" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="900" letter-spacing="4">HOLA ${nameText}</text>
        <text x="0" y="48" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="48" font-weight="950">Sos beneficiario</text>
        <text x="0" y="96" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="48" font-weight="950">de esta experiencia.</text>
        <rect x="0" y="134" width="764" height="108" rx="24" fill="#0f2438" stroke="#22d3ee" stroke-opacity=".22"/>
        <text x="28" y="178" fill="#94a3b8" font-family="Inter,Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="3">BENEFICIO</text>
        <text x="28" y="214" fill="#f8fafc" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="900">${rewardText}</text>
      </g>

      <g transform="translate(70 520)">
        <rect x="0" y="0" width="372" height="372" rx="36" fill="#ffffff"/>
        <image href="${qrDataUrl}" x="30" y="30" width="312" height="312"/>
        <g transform="translate(462 16)">
          <text x="0" y="0" fill="#94a3b8" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="900" letter-spacing="4">CODIGO DE CANJE</text>
          <text x="0" y="70" fill="#67e8f9" font-family="Inter,Arial,sans-serif" font-size="54" font-weight="950" letter-spacing="3">${codeText}</text>
          <rect x="0" y="112" width="320" height="70" rx="20" fill="#071827" stroke="#22d3ee" stroke-opacity=".28"/>
          <text x="22" y="156" fill="#e2e8f0" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="900">${phoneText}</text>
          <text x="0" y="232" fill="#94a3b8" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="900" letter-spacing="4">SELLO NEXID</text>
          <text x="0" y="270" fill="#f8fafc" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="950" letter-spacing="4">${sealText}</text>
        </g>
      </g>

      <g transform="translate(70 958)">
        <rect x="0" y="0" width="764" height="130" rx="28" fill="#02111f" stroke="#34d399" stroke-opacity=".22"/>
        <text x="30" y="44" fill="#bbf7d0" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="900" letter-spacing="4">VALIDO HASTA</text>
        <text x="30" y="86" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="950">${expiresText}</text>
        <text x="360" y="44" fill="#94a3b8" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="900" letter-spacing="4">TENANT</text>
        <text x="360" y="86" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="950">${tenantText}</text>
      </g>

      <text x="70" y="1138" fill="#94a3b8" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="700">Mostra este pase en el comercio. El staff valida codigo, telefono y sello desde nexID CRM.</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = clean(code).replace(/[^\d]/g, "");
  if (!validCode(normalizedCode)) {
    return new Response("Invalid voucher code", { status: 400 });
  }

  const url = new URL(req.url);
  const providedSeal = clean(url.searchParams.get("seal")).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 24);
  const fallbackTenant = clean(url.searchParams.get("tenant")).replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 60) || "demobodega";
  const claim = await getClaim(normalizedCode);
  const metadata = claim?.metadata_json || {};
  const expectedSeal = clean(metadata.verification_seal).toUpperCase();

  if (claim && expectedSeal && providedSeal !== expectedSeal) {
    return new Response("Invalid voucher seal", { status: 403 });
  }

  const png = await renderVoucherPng({
    code: normalizedCode,
    seal: expectedSeal || providedSeal,
    tenant: clean(claim?.tenant_slug) || fallbackTenant,
    rewardTitle: clean(claim?.reward_title) || "Beneficio nexID post-tap",
    consumerName: clean(claim?.display_name) || "Cliente nexID",
    phoneLast4: clean(claim?.phone).replace(/[^\d]/g, "").slice(-4),
    expiresAt: clean(claim?.expires_at) || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    status: clean(claim?.status) || "claimed",
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
