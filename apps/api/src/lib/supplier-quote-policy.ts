/** Shared wire policy, mirrored byte-for-byte in API and dashboard; no secrets or platform imports. */
export const SUPPLIER_QUOTE_PROTOCOL = "nexid.supplier-quote.v1";
export const QUOTE_MAX_MINOR = 999_999_999_999;
export const QUOTE_CURRENCIES = ["ARS", "USD", "EUR"] as const;
export type QuoteCurrency = typeof QUOTE_CURRENCIES[number];
export type QuoteAction = "issue" | "accept" | "reject" | "withdraw";
export type QuoteOffer = { currency: QuoteCurrency; net_minor: number; tax_minor: number; shipping_minor: number; valid_until: string; conditions: string };
export type QuoteCommand = { action: QuoteAction; expected_revision: number; expected_request_revision: number; expected_review_revision: number; offer: QuoteOffer | null; reason: string };
export type QuoteEvent = QuoteOffer & { id: string; revision: number; request_revision: number; quote_version: number; source_request_revision: number; review_revision: number; action: QuoteAction; state: "offered" | "accepted" | "rejected" | "withdrawn"; total_minor: number; reason: string; actor_id: string; created_at: string };
export type QuoteState = { revision: number; current: QuoteEvent | null; history: QuoteEvent[]; count: number; truncated: boolean; next_before_revision: number | null; as_of: string };
export class QuoteContractError extends Error { constructor() { super("supplier_quote_contract_invalid"); } }
const bad = (): never => { throw new QuoteContractError(); };
const obj = (value: unknown): Record<string, unknown> => !value || typeof value !== "object" || Array.isArray(value) ? bad() : value as Record<string, unknown>;
const exact = (value: unknown, fields: string[]) => { const row = obj(value); if (Object.keys(row).length !== fields.length || fields.some(field => !Object.hasOwn(row, field))) return bad(); return row; };
const int = (value: unknown, min = 0, max = 2147483646): number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : bad();
const uuid = (value: unknown): string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : bad();
const text = (value: unknown, required = true): string => typeof value !== "string" || value.length > 2000 || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ? bad() : value;
function date(value: unknown, canonical = false): string {
 const raw = value instanceof Date ? value.toISOString() : value;
 if (typeof raw !== "string" || raw.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(Date.parse(raw))) return bad();
 const result = new Date(raw).toISOString(); if (canonical && result !== raw) return bad(); return result;
}
export function quoteTotal(offer: Pick<QuoteOffer, "net_minor" | "tax_minor" | "shipping_minor">): number {
 const result = int(offer.net_minor,1,QUOTE_MAX_MINOR)+int(offer.tax_minor,0,QUOTE_MAX_MINOR)+int(offer.shipping_minor,0,QUOTE_MAX_MINOR);
 return int(result,1,QUOTE_MAX_MINOR);
}
function offerFields(input: Record<string, unknown>, canonical = false): QuoteOffer {
 if (!QUOTE_CURRENCIES.includes(input.currency as QuoteCurrency)) return bad();
 const offer = { currency: input.currency as QuoteCurrency, net_minor: int(input.net_minor,1,QUOTE_MAX_MINOR), tax_minor: int(input.tax_minor,0,QUOTE_MAX_MINOR), shipping_minor: int(input.shipping_minor,0,QUOTE_MAX_MINOR), valid_until: date(input.valid_until,canonical), conditions: text(input.conditions) };
 quoteTotal(offer); return offer;
}
export function parseQuoteCommand(value: unknown): QuoteCommand {
 const row = exact(value,["action","expected_revision","expected_request_revision","expected_review_revision","offer","reason"]);
 if (!["issue","accept","reject","withdraw"].includes(String(row.action))) return bad();
 const action = row.action as QuoteAction;
 const reason = text(row.reason, action !== "accept").trim();
 const offer = action === "issue" ? offerFields(exact(row.offer,["currency","net_minor","tax_minor","shipping_minor","valid_until","conditions"]),true) : row.offer === null ? null : bad();
 return { action, expected_revision:int(row.expected_revision,0,2147483645), expected_request_revision:int(row.expected_request_revision,1,2147483645), expected_review_revision:int(row.expected_review_revision), offer, reason };
}
export function parseQuoteEvent(value: unknown): QuoteEvent {
 const row = obj(value), offer = offerFields(row), action = row.action as QuoteAction;
 const states = { issue:"offered",accept:"accepted",reject:"rejected",withdraw:"withdrawn" } as const;
 if (!Object.hasOwn(states,action) || row.state !== states[action]) return bad();
 const revision = int(row.revision,1), request_revision = int(row.request_revision,2), quote_version = int(row.quote_version,1,revision), source_request_revision = int(row.source_request_revision,1,request_revision-1);
 const created_at = date(row.created_at);
 if (quoteTotal(offer) !== row.total_minor || (action === "issue" && (request_revision !== source_request_revision+1 || Date.parse(offer.valid_until) <= Date.parse(created_at)))
  || (action === "accept" && Date.parse(offer.valid_until) <= Date.parse(created_at))) return bad();
 return { ...offer,id:uuid(row.id),revision,request_revision,quote_version,source_request_revision,review_revision:int(row.review_revision),action,state:states[action],total_minor:quoteTotal(offer),reason:text(row.reason,action!=="accept"),actor_id:uuid(row.actor_id),created_at };
}
export function parseQuoteState(value: unknown, requestRevision: number, quotationRevision: number, before: number | null = null): QuoteState {
 const row = obj(value), revision = int(row.revision), current = row.current === null ? null : parseQuoteEvent(row.current);
 if (revision !== quotationRevision || (revision===0)!==(current===null) || (current && (current.revision!==revision || current.request_revision>requestRevision))
   || !Array.isArray(row.history) || row.history.length>50 || row.count!==row.history.length || typeof row.truncated!=="boolean") return bad();
 const history = row.history.map(parseQuoteEvent), ids = new Set<string>();
 for (let i=0;i<history.length;i++) { const item=history[i]; if(ids.has(item.id)||item.revision>revision||item.request_revision>requestRevision||(before!==null&&item.revision>=before)
   || (i>0&&(item.revision!==history[i-1].revision+1||item.request_revision<=history[i-1].request_revision||Date.parse(item.created_at)<Date.parse(history[i-1].created_at))))return bad();ids.add(item.id); }
 const first = history[0]?.revision, next = first && first>1 ? first : null;
 if(row.truncated!==(next!==null)||row.next_before_revision!==next||(revision>0&&before===null&&(!history.length||JSON.stringify(history.at(-1))!==JSON.stringify(current))))return bad();
 return { revision,current,history,count:history.length,truncated:row.truncated,next_before_revision:next,as_of:date(row.as_of) };
}
/** Decimal input only: comma OR period separates cents; grouping and exponent are rejected. */
export function quoteMinorFromText(input: string, allowZero = false): number {
 if(typeof input!=="string"||!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(input.trim()))return bad();
 const [whole,fraction=""] = input.trim().split(/[.,]/), value = BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));
 if(value>BigInt(QUOTE_MAX_MINOR)||(!allowZero&&value===0n))return bad();return Number(value);
}
export function quoteMoney(minor: number,currency: QuoteCurrency): string {
 int(minor,0,QUOTE_MAX_MINOR);if(!QUOTE_CURRENCIES.includes(currency))return bad();
 const whole=Math.floor(minor/100).toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");return currency+" "+whole+","+String(minor%100).padStart(2,"0");
}
