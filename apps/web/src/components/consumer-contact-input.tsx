"use client";

export type ConsumerContactDraft = {
  channel: "whatsapp" | "email";
  countryCode: string;
  localPhone: string;
  email: string;
};

export type ConsumerContactPayload = { email: string } | { phone: string };

const COUNTRY_OPTIONS = [
  { label: "AR movil", code: "+549", example: "2613168608" },
  { label: "AR", code: "+54", example: "1123456789" },
  { label: "UY", code: "+598", example: "99123456" },
  { label: "CL", code: "+56", example: "912345678" },
  { label: "BR", code: "+55", example: "11912345678" },
  { label: "PY", code: "+595", example: "981123456" },
  { label: "BO", code: "+591", example: "71234567" },
  { label: "PE", code: "+51", example: "912345678" },
  { label: "CO", code: "+57", example: "3001234567" },
  { label: "MX", code: "+52", example: "5512345678" },
  { label: "US", code: "+1", example: "3051234567" },
  { label: "ES", code: "+34", example: "612345678" },
] as const;

const DEFAULT_COUNTRY_CODE = "+549";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeCountryCode(value: string) {
  const digits = digitsOnly(value);
  return digits ? `+${digits}` : DEFAULT_COUNTRY_CODE;
}

function normalizeLocalPhone(value: string) {
  return digitsOnly(value).replace(/^0+/, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function splitPhoneValue(value: string) {
  const digits = digitsOnly(value);
  const sortedOptions = [...COUNTRY_OPTIONS].sort((a, b) => digitsOnly(b.code).length - digitsOnly(a.code).length);
  const match = sortedOptions.find((option) => digits.startsWith(digitsOnly(option.code)));
  if (!match) return { countryCode: DEFAULT_COUNTRY_CODE, localPhone: digits };
  return {
    countryCode: match.code,
    localPhone: digits.slice(digitsOnly(match.code).length),
  };
}

export function createEmptyConsumerContactDraft(): ConsumerContactDraft {
  return {
    channel: "whatsapp",
    countryCode: DEFAULT_COUNTRY_CODE,
    localPhone: "",
    email: "",
  };
}

export function consumerContactDraftFromValue(value: string): ConsumerContactDraft {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    return {
      ...createEmptyConsumerContactDraft(),
      channel: "email",
      email: trimmed,
    };
  }
  const phone = splitPhoneValue(trimmed);
  return {
    ...createEmptyConsumerContactDraft(),
    countryCode: phone.countryCode,
    localPhone: phone.localPhone,
  };
}

export function consumerContactDraftValue(draft: ConsumerContactDraft) {
  if (draft.channel === "email") return draft.email.trim();
  const countryCode = normalizeCountryCode(draft.countryCode);
  const localPhone = normalizeLocalPhone(draft.localPhone);
  return localPhone ? `${countryCode}${localPhone}` : "";
}

export function consumerContactDraftIsValid(draft: ConsumerContactDraft) {
  if (draft.channel === "email") return isValidEmail(draft.email);
  const countryDigits = digitsOnly(draft.countryCode);
  const localDigits = normalizeLocalPhone(draft.localPhone);
  const fullLength = `${countryDigits}${localDigits}`.length;
  return countryDigits.length >= 1 && localDigits.length >= 6 && fullLength >= 8 && fullLength <= 15;
}

export function consumerContactPayload(draft: ConsumerContactDraft): ConsumerContactPayload | null {
  if (!consumerContactDraftIsValid(draft)) return null;
  if (draft.channel === "email") return { email: draft.email.trim().toLowerCase() };
  return { phone: consumerContactDraftValue(draft) };
}

export function ConsumerContactInput({
  draft,
  onChange,
  disabled = false,
  idPrefix = "consumer-contact",
  compact = false,
  channelLocked,
}: {
  draft: ConsumerContactDraft;
  onChange: (draft: ConsumerContactDraft) => void;
  disabled?: boolean;
  idPrefix?: string;
  compact?: boolean;
  channelLocked?: ConsumerContactDraft["channel"];
}) {
  const activeDraft = channelLocked && draft.channel !== channelLocked ? { ...draft, channel: channelLocked } : draft;
  const selectedOption = COUNTRY_OPTIONS.find((option) => option.code === draft.countryCode) || COUNTRY_OPTIONS[0];
  const inputClass = compact
    ? "rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
    : "rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500";
  const selectClass = compact
    ? "rounded-lg border border-white/10 bg-slate-950/70 px-2 py-2 text-sm text-slate-100"
    : "rounded-xl border border-white/15 bg-slate-950 px-2 py-2.5 text-sm text-slate-100";

  return (
    <div className="grid gap-2">
      {!channelLocked ? <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-slate-950/45 p-1">
        {[
          ["whatsapp", "WhatsApp"],
          ["email", "Email"],
        ].map(([channel, label]) => (
          <button
            key={channel}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...draft, channel: channel as ConsumerContactDraft["channel"] })}
            title={channel === "whatsapp" ? "Enviar codigo por WhatsApp/SMS con prefijo separado." : "Enviar codigo al email del Passport."}
            className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition ${
              draft.channel === channel
                ? "bg-cyan-300 text-slate-950"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            } disabled:opacity-60`}
          >
            {label}
          </button>
        ))}
      </div> : null}

      {activeDraft.channel === "email" ? (
        <input
          suppressHydrationWarning
          id={`${idPrefix}-email`}
          value={activeDraft.email}
          onChange={(event) => onChange({ ...draft, email: event.target.value })}
          placeholder="tu@email.com"
          autoComplete="email"
          inputMode="email"
          disabled={disabled}
          title="Email donde recibis el codigo de acceso."
          className={inputClass}
        />
      ) : (
        <div className="grid grid-cols-[minmax(108px,0.34fr)_minmax(0,1fr)] gap-2">
          <select
            suppressHydrationWarning
            id={`${idPrefix}-country`}
            value={draft.countryCode}
            onChange={(event) => onChange({ ...draft, countryCode: event.target.value })}
            disabled={disabled}
            title="Prefijo internacional. Para Argentina movil, usa +549."
            className={selectClass}
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label} {option.code}
              </option>
            ))}
          </select>
          <input
            suppressHydrationWarning
            id={`${idPrefix}-phone`}
            value={draft.localPhone}
            onChange={(event) => {
              const value = event.target.value;
              if (value.trim().startsWith("+")) {
                onChange({ ...draft, ...splitPhoneValue(value) });
                return;
              }
              onChange({ ...draft, localPhone: normalizeLocalPhone(value) });
            }}
            placeholder={selectedOption.example}
            autoComplete="tel-national"
            inputMode="tel"
            disabled={disabled}
            title="Numero local sin prefijo, espacios ni guiones."
            className={inputClass}
          />
        </div>
      )}

      {activeDraft.channel === "whatsapp" ? (
        <p className="text-[11px] leading-4 text-slate-400">
          Se envia como <span className="font-mono text-cyan-100">{consumerContactDraftValue(activeDraft) || `${activeDraft.countryCode}${selectedOption.example}`}</span>.
        </p>
      ) : null}
    </div>
  );
}
