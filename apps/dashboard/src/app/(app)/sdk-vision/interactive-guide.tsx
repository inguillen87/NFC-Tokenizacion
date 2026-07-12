"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  KeyRound,
  QrCode,
  Server,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import styles from "./interactive-guide.module.css";

type IntegrationMode = "qr" | "nfc" | "pos";
type CodeView = "request" | "response";

const modes = [
  {
    id: "qr" as const,
    icon: QrCode,
    label: "QR existente",
    title: "Registrar una lectura visible",
    endpoint: "/api/v1/sdk/events",
    claim: "Registra identidad y telemetría. No afirma autenticidad criptográfica.",
    captures: ["BID o identificador de lote", "Canal que originó la lectura", "Contexto permitido por el tenant"],
    payload: {
      eventType: "qr.scan",
      bid: "LOT-2026-0042",
      source: "consumer_qr",
      meta: { campaign: "origin-passport" },
    },
    response: {
      ok: true,
      eventId: "evt_01J...",
      eventType: "qr.scan",
      bid: "LOT-2026-0042",
      traceId: "trc_01J...",
    },
  },
  {
    id: "nfc" as const,
    icon: ShieldCheck,
    label: "NFC seguro",
    title: "Verificar una señal criptográfica",
    endpoint: "/api/v1/sdk/verify",
    claim: "El servidor evalúa firma dinámica, replay, carrier y política del tenant.",
    captures: ["BID asociado al tag", "PICC data de la lectura", "ENC y CMAC dinámicos"],
    payload: {
      bid: "LOT-2026-0042",
      picc_data: "04A7F3...",
      enc: "E1A2C3...",
      cmac: "C5A9...",
    },
    response: {
      ok: true,
      verdict: "VALID",
      uidMasked: "04A7****19D0",
      sealStatus: "CLOSED",
      eventId: "evt_01J...",
      traceId: "trc_01J...",
    },
  },
  {
    id: "pos" as const,
    icon: ShoppingCart,
    label: "POS / ERP",
    title: "Autorizar un claim desde una compra",
    endpoint: "/api/v1/sdk/pos/activate",
    claim: "El POS emite un token de un solo uso; el claim posterior lo consume de forma atómica.",
    captures: ["BID comprado", "ID externo de orden", "Retailer autorizado"],
    payload: {
      bid: "LOT-2026-0042",
      externalOrderId: "ORDER-1058",
      retailerId: "STORE-AR-009",
      expiresInMinutes: 20,
    },
    response: {
      ok: true,
      activationId: "act_01J...",
      bid: "LOT-2026-0042",
      posToken: "nxpos_••••••••••••",
      expiresAt: "2026-07-11T16:20:00.000Z",
      traceId: "trc_01J...",
    },
  },
];

export function InteractiveSdkGuide() {
  const [mode, setMode] = useState<IntegrationMode>("nfc");
  const [view, setView] = useState<CodeView>("request");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const active = modes.find((item) => item.id === mode) ?? modes[1];

  const requestCode = useMemo(() => `const response = await fetch(
  "https://api.nexid.lat${active.endpoint}",
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nexid-api-key": process.env.NEXID_API_KEY,
      "x-nexid-tenant-slug": "mi-tenant",
    },
    body: JSON.stringify(${JSON.stringify(active.payload, null, 2)}),
  },
);

if (!response.ok) throw new Error("nexID request failed");
const result = await response.json();`, [active]);

  const responseCode = useMemo(
    () => JSON.stringify(active.response, null, 2),
    [active],
  );
  const visibleCode = view === "request" ? requestCode : responseCode;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(visibleCode);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  return (
    <div className={styles.guide}>
      <div className={styles.modeBar} role="group" aria-label="Elegir punto de entrada">
        {modes.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={mode === id ? styles.modeActive : styles.mode}
            aria-pressed={mode === id}
            onClick={() => {
              setMode(id);
              setView("request");
            }}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        <section className={styles.context} aria-labelledby="integration-mode-title">
          <span className={styles.simulationBadge}>SIMULACIÓN DE CONTRATO</span>
          <h3 id="integration-mode-title">{active.title}</h3>
          <p>{active.claim}</p>

          <div className={styles.captureBlock}>
            <p>Datos que captura el sistema autorizado</p>
            <ul>
              {active.captures.map((item) => (
                <li key={item}><Check aria-hidden="true" /> {item}</li>
              ))}
            </ul>
          </div>

          <div className={styles.securityNote}>
            <KeyRound aria-hidden="true" />
            <div>
              <b>La API key no aparece en la app del consumidor.</b>
              <span>Se inyecta desde una variable de entorno en backend, BFF, POS o ERP.</span>
            </div>
          </div>

          <Link href="/api-keys" className={styles.keyLink}>
            Configurar una credencial <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className={styles.contract} aria-labelledby="contract-code-title">
          <div className={styles.contractHeader}>
            <div>
              <p><Server aria-hidden="true" /> PRODUCCIÓN · SERVER-SIDE</p>
              <h3 id="contract-code-title">{active.endpoint}</h3>
            </div>
            <div className={styles.viewTabs} role="tablist" aria-label="Código del contrato">
              <button
                type="button"
                role="tab"
                aria-selected={view === "request"}
                className={view === "request" ? styles.tabActive : styles.tab}
                onClick={() => setView("request")}
              >
                Request
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "response"}
                className={view === "response" ? styles.tabActive : styles.tab}
                onClick={() => setView("response")}
              >
                Respuesta ejemplo
              </button>
            </div>
          </div>

          <div className={styles.codeShell}>
            <div className={styles.codeToolbar}>
              <span><Code2 aria-hidden="true" /> {view === "request" ? "Node.js / TypeScript" : "JSON ilustrativo"}</span>
              <button type="button" onClick={copyCode} aria-label="Copiar ejemplo de código">
                {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copyState === "copied" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <pre><code>{visibleCode}</code></pre>
          </div>

          <p className={styles.truthNote}>
            {view === "request"
              ? "Este código no se ejecuta desde esta pantalla. Es una guía para el servidor del cliente."
              : "La respuesta es un ejemplo de forma y campos; los IDs y el veredicto dependen de la solicitud real."}
          </p>
          <span className={styles.copyFeedback} aria-live="polite">
            {copyState === "error" ? "No se pudo copiar. Seleccioná el código manualmente." : ""}
          </span>
        </section>
      </div>
    </div>
  );
}
