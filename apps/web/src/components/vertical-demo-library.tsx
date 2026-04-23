import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppLocale } from "@product/config";
import { ProductExitLink } from "./product-exit-link";

type Locale = AppLocale;

type PackMeta = { key: string; tag: string; simulates: string; audience: string };

const COPY: Record<Locale, { title: string; subtitle: string; why215: string; why424: string; openLab: string; downloadCsv: string; downloadJson: string; sim: string; forWho: string }> = {
  "es-AR": { title: "Vertical Demo Library", subtitle: "Elegí rubro y probá un demo pack real con CSV + JSON.", why215: "NTAG215 supera QR/email/foto en experiencias low-cost de acceso, campañas y tracking simple.", why424: "NTAG424 DNA TagTamper supera credenciales estáticas para anti-clone, tamper y autenticidad premium.", openLab: "Abrir Demo Lab", downloadCsv: "Descargar CSV", downloadJson: "Descargar JSON", sim: "Simula", forWho: "Para" },
  "pt-BR": { title: "Vertical Demo Library", subtitle: "Escolha um setor e teste um pack real com CSV + JSON.", why215: "NTAG215 supera QR/e-mail/foto em jornadas low-cost de acesso, campanhas e tracking simples.", why424: "NTAG424 DNA TagTamper supera credenciais estáticas para anti-clone, tamper e autenticidade premium.", openLab: "Abrir Demo Lab", downloadCsv: "Baixar CSV", downloadJson: "Baixar JSON", sim: "Simula", forWho: "Para" },
  en: { title: "Vertical Demo Library", subtitle: "Choose a vertical and run a real CSV + JSON demo pack.", why215: "NTAG215 beats QR/email/photo for low-cost access, campaigns and simple tracking.", why424: "NTAG424 DNA TagTamper beats static credentials for anti-clone, tamper and premium authenticity.", openLab: "Open Demo Lab", downloadCsv: "Download CSV", downloadJson: "Download JSON", sim: "Simulates", forWho: "For" },
};

function metaByKey(key: string): Omit<PackMeta, "key" | "tag"> {
  if (key.includes("wine")) return { simulates: "Bottle passport, uncork events and authenticity state.", audience: "wineries, export and premium retail" };
  if (key.includes("events")) return { simulates: "Wristband tap, valid/duplicate access and gate control.", audience: "event agencies and venue operators" };
  if (key.includes("cosmetics")) return { simulates: "Cap opening, tamper signal and product passport.", audience: "cosmetics brands and distributors" };
  if (key.includes("agro")) return { simulates: "Bag tear, lot verification and origin traceability.", audience: "agro input companies and cooperatives" };
  if (key.includes("pharma")) return { simulates: "Chain-of-custody verification and anti-counterfeit checks.", audience: "pharma labs and regulated distributors" };
  return { simulates: "Luxury item authentication and ownership story.", audience: "luxury brands and activation partners" };
}

async function readPacks() {
  const base = path.resolve(process.cwd(), 'public', 'demo');

  try {
    const stats = await fs.stat(base);
    if (!stats.isDirectory()) return [] as PackMeta[];
  } catch {
    return [] as PackMeta[];
  }

  const dirs = (await fs.readdir(base, { withFileTypes: true })).filter((d) => d.isDirectory());

  const packs = await Promise.all(
    dirs.map(async (d) => {
      const manifestPath = path.join(base, d.name, 'manifest.csv');
      try {
        const content = await fs.readFile(manifestPath, 'utf8');
        const lines = content.trim().split('\n');
        const headers = lines[0]?.split(',').map((h) => h.trim()) || [];
        const first = (lines[1] || '').split(',').map((v) => v.trim());
        const row = Object.fromEntries(headers.map((h, i) => [h, first[i] || '']));
        const meta = metaByKey(d.name);
        return { key: d.name, tag: String(row.ic_type || 'UNKNOWN'), ...meta };
      } catch {
        return null;
      }
    })
  );

  return packs
    .filter((x): x is PackMeta => Boolean(x))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function VerticalDemoLibrary({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const packs = await readPacks();

  return (
    <section className="container-shell py-12 space-y-4">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{t.title}</p>
      <h2 className="text-2xl font-semibold text-white">{t.subtitle}</h2>
      <p className="text-sm text-slate-300">{t.why215}</p>
      <p className="text-sm text-slate-300">{t.why424}</p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {packs.map((p) => (
          <article key={p.key} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-cyan-300">{p.tag}</p>
            <h3 className="text-base font-semibold text-white mt-1">{p.key}</h3>
            <p className="mt-2 text-xs text-slate-300"><b>{t.sim}:</b> {p.simulates}</p>
            <p className="mt-1 text-xs text-slate-300"><b>{t.forWho}:</b> {p.audience}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <a className="rounded-md border border-white/10 p-2 text-slate-200" href={`/demo/${p.key}/manifest.csv`} download>{t.downloadCsv}</a>
              <a className="rounded-md border border-white/10 p-2 text-slate-200" href={`/demo/${p.key}/seed.json`} download>{t.downloadJson}</a>
            </div>
            <ProductExitLink kind="demoLab" className="mt-3 inline-block rounded-md border border-cyan-300/40 px-3 py-2 text-xs text-cyan-300">{t.openLab}</ProductExitLink>
          </article>
        ))}
      </div>
    </section>
  );
}
