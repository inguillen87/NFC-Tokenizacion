export const GS1_DIGITAL_LINK_TRUST_LEVEL = "GS1_IDENTITY_RESOLVED";
export const GS1_DIGITAL_LINK_AUTH_LEVEL = "NOT_CRYPTOGRAPHICALLY_AUTHENTICATED";

const PASSTHROUGH_QUERY_KEYS = ["tenant", "bid", "product", "winery", "api", "lang"];

export type Gs1DigitalLinkResolverParams = {
  gtin: string;
  lot?: string | null;
  serial?: string | null;
};

function cleanPathValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function buildGs1DigitalLinkSunUrl(requestUrl: string | URL, params: Gs1DigitalLinkResolverParams) {
  const incoming = new URL(String(requestUrl));
  const target = new URL("/sun", incoming.origin);
  const gtin = cleanPathValue(params.gtin);
  const lot = cleanPathValue(params.lot);
  const serial = cleanPathValue(params.serial);

  target.searchParams.set("qr", "1");
  target.searchParams.set("channel", "qr");
  target.searchParams.set("source", "gs1");
  target.searchParams.set("carrier", "gs1_digital_link");
  target.searchParams.set("trust_level", GS1_DIGITAL_LINK_TRUST_LEVEL);
  target.searchParams.set("authentication_level", GS1_DIGITAL_LINK_AUTH_LEVEL);
  if (gtin) target.searchParams.set("gtin", gtin);
  if (lot) target.searchParams.set("lot", lot);
  if (serial) target.searchParams.set("serial", serial);

  for (const key of PASSTHROUGH_QUERY_KEYS) {
    const value = incoming.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }

  return target;
}
