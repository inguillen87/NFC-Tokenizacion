import React from "react";
import { readDemoDataMetaFromPayload, readDemoDataMetaFromResponse } from "../../../../lib/demo-data-mode";

export interface AudienceMember {
  consumer_id?: string | null;
  display_name?: string | null;
  email_masked?: string | null;
  phone_masked?: string | null;
  city?: string | null;
  country?: string | null;
  tenant_slug?: string | null;
  status?: string | null;
  points_balance?: number | string | null;
  lifetime_points?: number | string | null;
  tap_count?: number | string | null;
  valid_taps?: number | string | null;
  risk_taps?: number | string | null;
  saved_products?: number | string | null;
  last_product?: string | null;
  marketing_opt_in?: boolean | null;
  whatsapp_opt_in?: boolean | null;
  segment?: string | null;
  last_tap_at?: string | null;
}

const TEXT_FIELDS = ["consumer_id", "display_name", "email_masked", "phone_masked", "city", "country", "tenant_slug", "status", "last_product", "segment", "last_tap_at"] as const;
const NUMBER_FIELDS = ["points_balance", "lifetime_points", "tap_count", "valid_taps", "risk_taps", "saved_products"] as const;

/** Missing identity is a valid source limitation, not a generated consumer ID. */
export function parseCampaignAudienceRows(value: unknown): AudienceMember[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return TEXT_FIELDS.every((key) => item[key] == null || typeof item[key] === "string")
      && NUMBER_FIELDS.every((key) => item[key] == null
        || (typeof item[key] === "number" && Number.isFinite(item[key]))
        || (typeof item[key] === "string" && item[key].trim() !== "" && Number.isFinite(Number(item[key]))))
      && ["marketing_opt_in", "whatsapp_opt_in"].every((key) => item[key] == null || typeof item[key] === "boolean");
  })) return null;
  return value as AudienceMember[];
}

export function campaignAudienceIsDemo(response: Response, payload: unknown) {
  const items = payload && typeof payload === "object" && "items" in payload && Array.isArray(payload.items)
    ? payload.items
    : [];
  const hasDeclaredDemoRows = items.some((item) => item && typeof item === "object"
    && String(item.data_provenance || "").trim().toLowerCase() === "declared_demo");
  return readDemoDataMetaFromResponse(response).demoMode
    || readDemoDataMetaFromPayload(payload).demoMode
    || hasDeclaredDemoRows;
}

export function campaignAudienceRowKey(member: AudienceMember, index: number) {
  // A render-only fallback: never copied into the member or used as an actor ID.
  return member.consumer_id?.trim() || `audience-row:${index}`;
}

export function CampaignAudienceIdentity({ member }: { member: AudienceMember }) {
  const label = member.display_name?.trim() || "Perfil sin nombre informado";
  const contact = member.email_masked?.trim()
    || member.consumer_id?.trim().slice(0, 8)
    || "Identificador de contacto no disponible";
  return <>
    <div className="truncate text-sm font-bold text-white">{label}</div>
    <div className="truncate text-[10px] text-slate-500">{contact}</div>
  </>;
}
