"use client";

import { Check, Clipboard, Code2, ListTree, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Locale = "es-AR" | "pt-BR" | "en";
type SnippetId = "curl" | "node" | "python";

const navItems: Array<{ id: string; label: Record<Locale, string> }> = [
  { id: "thesis", label: { "es-AR": "Tesis", "pt-BR": "Tese", en: "Thesis" } },
  { id: "carrier-profiles", label: { "es-AR": "Chips", "pt-BR": "Chips", en: "Chips" } },
  { id: "api", label: { "es-AR": "API", "pt-BR": "API", en: "API" } },
  { id: "rollout", label: { "es-AR": "Rollout", "pt-BR": "Rollout", en: "Rollout" } },
  { id: "trust-layers", label: { "es-AR": "Trust layers", "pt-BR": "Trust layers", en: "Trust layers" } },
  { id: "faq", label: { "es-AR": "FAQ", "pt-BR": "FAQ", en: "FAQ" } },
  { id: "actions", label: { "es-AR": "Acciones", "pt-BR": "Acoes", en: "Actions" } },
];

const snippets: Record<SnippetId, string> = {
  curl: `export NEXID_API_BASE="$NEXID_API_BASE"
export NEXID_VALIDATION_ROUTE="$NEXID_VALIDATION_ROUTE"

curl -X POST "$NEXID_API_BASE$NEXID_VALIDATION_ROUTE" \\
  -H "Authorization: Bearer $NEXID_TENANT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "carrier": "ntag424_dna",
    "uid": "$TAG_UID",
    "counter": "$SUN_COUNTER",
    "cmac": "$SUN_CMAC",
    "batchId": "$BATCH_ID",
    "channel": "consumer-web"
  }'`,
  node: `const baseUrl = process.env.NEXID_API_BASE;
const route = process.env.NEXID_VALIDATION_ROUTE;

const response = await fetch(\`\${baseUrl}\${route}\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.NEXID_TENANT_TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    carrier: "ntag424_dna",
    uid: tag.uid,
    counter: tag.sunCounter,
    cmac: tag.sunCmac,
    batchId: tag.batchId,
    channel: "consumer-web",
  }),
});

const verdict = await response.json();`,
  python: `import os
import requests

response = requests.post(
    f"{os.environ['NEXID_API_BASE']}{os.environ['NEXID_VALIDATION_ROUTE']}",
    headers={
        "Authorization": f"Bearer {os.environ['NEXID_TENANT_TOKEN']}",
        "Content-Type": "application/json",
    },
    json={
        "carrier": "ntag424_dna",
        "uid": tag["uid"],
        "counter": tag["sun_counter"],
        "cmac": tag["sun_cmac"],
        "batchId": tag["batch_id"],
        "channel": "consumer-web",
    },
)

verdict = response.json()`,
};

const copyByLocale: Record<
  Locale,
  {
    navTitle: string;
    navBody: string;
    consoleEyebrow: string;
    consoleTitle: string;
    consoleBody: string;
    contractTitle: string;
    contractItems: string[];
    copied: string;
    copy: string;
    note: string;
  }
> = {
  "es-AR": {
    navTitle: "Mapa vivo de la doc",
    navBody: "La barra marca la seccion visible y acelera una lectura tecnica o comercial.",
    consoleEyebrow: "Integracion guiada",
    consoleTitle: "Tabs reales para llevar la validacion a un piloto",
    consoleBody:
      "Los snippets usan variables de entorno porque el endpoint exacto y el token se entregan por tenant. Esto evita publicar rutas privadas y mantiene el contrato copiable.",
    contractTitle: "Contrato minimo que debe llegar al backend",
    contractItems: ["carrier", "uid", "counter", "cmac", "batchId", "channel"],
    copied: "Copiado",
    copy: "Copiar",
    note: "La validacion productiva finaliza server-side: replay, politica de tenant, ownership y garantia no viven en el cliente.",
  },
  "pt-BR": {
    navTitle: "Mapa vivo da doc",
    navBody: "A barra marca a secao visivel e acelera leitura tecnica ou comercial.",
    consoleEyebrow: "Integracao guiada",
    consoleTitle: "Tabs reais para levar validacao a um piloto",
    consoleBody:
      "Os snippets usam variaveis de ambiente porque o endpoint exato e o token sao entregues por tenant. Isso evita publicar rotas privadas e mantem o contrato copiavel.",
    contractTitle: "Contrato minimo que deve chegar ao backend",
    contractItems: ["carrier", "uid", "counter", "cmac", "batchId", "channel"],
    copied: "Copiado",
    copy: "Copiar",
    note: "A validacao produtiva termina server-side: replay, politica do tenant, ownership e garantia nao ficam no cliente.",
  },
  en: {
    navTitle: "Live docs map",
    navBody: "The rail tracks the visible section and speeds up technical or commercial review.",
    consoleEyebrow: "Guided integration",
    consoleTitle: "Real tabs to move validation into a pilot",
    consoleBody:
      "Snippets use environment variables because the exact endpoint and token are tenant-scoped. That keeps private routes unpublished while preserving a copyable contract.",
    contractTitle: "Minimum contract received by the backend",
    contractItems: ["carrier", "uid", "counter", "cmac", "batchId", "channel"],
    copied: "Copied",
    copy: "Copy",
    note: "Production validation is finalized server-side: replay, tenant policy, ownership and warranty do not live in the client.",
  },
};

function highlightedLine(line: string, language: SnippetId) {
  const tokenPattern =
    language === "python"
      ? /(#.*$|"[^"]*"|'[^']*'|\b(?:import|response|headers|json|verdict)\b|\bPOST\b|\bos\b|\brequests\b|\$[A-Z0-9_]+)/g
      : /(\/\/.*$|"[^"]*"|'[^']*'|`[^`]*`|\b(?:const|await|fetch|method|headers|body|Authorization|JSON|stringify|export|curl|POST)\b|\$[A-Z0-9_]+)/g;
  const parts = line.split(tokenPattern).filter(Boolean);

  return parts.map((part, index) => {
    let className = "text-slate-200";
    if (part.startsWith("#") || part.startsWith("//")) className = "text-slate-500";
    else if (part.startsWith('"') || part.startsWith("'") || part.startsWith("`")) className = "text-emerald-300";
    else if (part.startsWith("$")) className = "text-violet-300";
    else if (/^(const|await|fetch|method|headers|body|Authorization|JSON|stringify|export|curl|POST|import|response|json|verdict|os|requests)$/.test(part)) className = "text-cyan-300";

    return (
      <span key={`${part}-${index}`} className={className}>
        {part}
      </span>
    );
  });
}

export function DocsIntegrationConsole({ locale }: { locale: Locale }) {
  const copy = copyByLocale[locale] || copyByLocale["es-AR"];
  const [activeSection, setActiveSection] = useState(navItems[0].id);
  const [activeSnippet, setActiveSnippet] = useState<SnippetId>("curl");
  const [copiedSnippet, setCopiedSnippet] = useState<SnippetId | null>(null);
  const renderedCode = useMemo(() => snippets[activeSnippet].split("\n"), [activeSnippet]);

  useEffect(() => {
    const sectionNodes = navItems
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (!sectionNodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-24% 0px -62% 0px", threshold: [0.08, 0.2, 0.4] }
    );

    sectionNodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const onCopy = async () => {
    await navigator.clipboard?.writeText(snippets[activeSnippet]).catch(() => null);
    setCopiedSnippet(activeSnippet);
    window.setTimeout(() => setCopiedSnippet(null), 1400);
  };

  return (
    <section className="grid w-full min-w-0 gap-4 lg:grid-cols-[minmax(210px,0.55fr)_minmax(0,1.45fr)]">
      <aside className="sticky top-20 hidden h-fit rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-4 shadow-[0_18px_80px_rgba(8,47,73,0.24)] backdrop-blur-xl lg:block">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
            <ListTree className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-white">{copy.navTitle}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{copy.navBody}</p>
          </div>
        </div>
        <nav className="space-y-1" aria-label="Docs scroll spy">
          {navItems.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold transition ${
                  isActive
                    ? "border border-cyan-300/30 bg-cyan-400/15 text-cyan-100"
                    : "border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-100"
                }`}
              >
                {item.label[locale]}
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-cyan-300" : "bg-slate-700"}`} />
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/75 shadow-[0_20px_90px_rgba(2,6,23,0.42)]">
        <div className="grid gap-0 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
              <TerminalSquare className="h-3.5 w-3.5" />
              {copy.consoleEyebrow}
            </span>
            <h3 className="mt-4 text-2xl font-black leading-tight text-white">{copy.consoleTitle}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{copy.consoleBody}</p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{copy.contractTitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {copy.contractItems.map((item) => (
                  <span key={item} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex rounded-2xl border border-white/10 bg-slate-950 p-1">
                {(["curl", "node", "python"] as SnippetId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSnippet(id)}
                    className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                      activeSnippet === id
                        ? "bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.2)]"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                    }`}
                  >
                    {id === "node" ? "Node.js" : id}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-300/20"
              >
                {copiedSnippet === activeSnippet ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                {copiedSnippet === activeSnippet ? copy.copied : copy.copy}
              </button>
            </div>

            <div className="min-w-0 overflow-x-auto bg-slate-950">
              <pre className="min-w-[680px] p-4 text-[11.5px] leading-6 sm:p-5">
                <code>
                  {renderedCode.map((line, index) => (
                    <span key={`${activeSnippet}-${index}`} className="block">
                      <span className="mr-4 inline-block w-6 select-none text-right text-slate-600">{index + 1}</span>
                      {highlightedLine(line, activeSnippet)}
                    </span>
                  ))}
                </code>
              </pre>
            </div>

            <div className="flex items-start gap-3 border-t border-white/10 bg-cyan-950/20 px-4 py-3 text-xs leading-5 text-cyan-100">
              <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <p>{copy.note}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
