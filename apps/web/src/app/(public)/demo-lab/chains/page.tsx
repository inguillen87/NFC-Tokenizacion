import type { Metadata } from "next";
import { productUrls } from "@product/config";
import { ChainLabClient, type ChainLabModel, type LabGoal } from "./chain-lab-client";
// The model stays as an executable .mjs module so the same normalization logic is
// covered directly by the repository's Node test runner.
// @ts-expect-error Local JSDoc-checked ESM module intentionally has no generated declaration file.
import { buildChainLabViewModel } from "./chain-lab-model.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chain Lab IOTA + Polygon | nexID",
  description: "Laboratorio guiado que consulta evidencia testnet publica y muestra si esta verificada, parcial o no disponible para IOTA y Polygon.",
  alternates: { canonical: "/demo-lab/chains" },
  robots: { index: true, follow: true },
};

type ChainLabPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PublicSourceResult = {
  payload: unknown;
  source: { ok: boolean; status: number; error: string | null };
};

const PUBLIC_CHAIN_FETCH_TIMEOUT_MS = 6_000;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function resolveGoal(value: string | string[] | undefined): LabGoal {
  const normalized = first(value).trim().toLowerCase();
  if (normalized === "audit" || normalized === "iota") return "audit";
  if (normalized === "ownership" || normalized === "polygon") return "ownership";
  return "dual";
}

function apiBase() {
  return String(productUrls.api || "https://api.nexid.lat").replace(/\/$/, "");
}

function safeReason(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const raw = "reason" in value ? String(value.reason || "") : "";
  const normalized = raw.trim().replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 96);
  return normalized || null;
}

async function loadPublicSource(path: string): Promise<PublicSourceResult> {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(PUBLIC_CHAIN_FETCH_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    const payload = await response.json().catch(() => null) as unknown;
    return {
      payload,
      source: {
        ok: response.ok && payload !== null,
        status: response.status,
        error: response.ok ? null : safeReason(payload) || "upstream_http_error",
      },
    };
  } catch {
    return {
      payload: null,
      source: { ok: false, status: 0, error: "timeout_or_network_error" },
    };
  }
}

export default async function ChainLabPage({ searchParams }: ChainLabPageProps) {
  const params = searchParams ? await searchParams : {};
  const initialGoal = resolveGoal(params.goal || params.layer);
  const [catalog, certificate] = await Promise.all([
    loadPublicSource("/public/proof/demo-cases"),
    loadPublicSource("/public/polygon/ownership"),
  ]);
  const model = buildChainLabViewModel({
    catalog: catalog.payload,
    certificate: certificate.payload,
    sources: {
      catalog: catalog.source,
      certificate: certificate.source,
    },
    observedAt: new Date().toISOString(),
  }) as ChainLabModel;

  return <ChainLabClient model={model} initialGoal={initialGoal} />;
}
