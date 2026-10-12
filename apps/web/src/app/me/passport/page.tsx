import Link from "next/link";
import styles from "./passport.module.css";
import { buildConsumerNextPath, fetchConsumerMe, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { PortalShell } from "../_components/portal-shell";
import { homeAccountStatusLabel } from "../_components/consumer-home-model";
import { ShieldCheck, UserCheck, Award, Sparkles, WalletCards, PackageCheck, ChevronRight } from "lucide-react";

type Passport = { ok?: boolean; consumer?: { display_name?: string | null; email?: string | null; status?: string | null } };

export default async function PassportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const session = await readConsumerSession(buildConsumerNextPath("/me/passport", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const payload = (await fetchConsumerMe()) as Passport | null;
  const consumer = payload?.consumer;
  if (payload?.ok !== true || consumer === null || typeof consumer !== "object" || Array.isArray(consumer)) return <ConsumerPortalUnavailable />;
  if ([consumer.display_name, consumer.email, consumer.status].some(value => value !== undefined && value !== null && typeof value !== "string")) return <ConsumerPortalUnavailable />;
  const status = typeof consumer.status === "string" ? consumer.status.trim().toLowerCase() : null;
  const accountStatusLabel = homeAccountStatusLabel(status);
  
  const isVerif = status === "verified";
  const tone = isVerif 
    ? styles.verified 
    : styles.pending;
    
  const tenant = typeof params.tenant === "string" ? params.tenant : "";

  return (
    <PortalShell title="Mi pasaporte NexID" subtitle="Tu cuenta, tus productos y las marcas que elegís.">
      
      <div className={styles.root}>
      {/* Datos de cuenta informados por API. */}
      <section className={styles.card+" relative overflow-hidden rounded-3xl border p-6 transition"}>
        <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-44 w-44 rounded-full bg-amber-600/5 blur-3xl" />
        
        <div className={styles.accountHeader+" flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4"}>
          <div className="flex min-w-0 items-center gap-3">
            <div className={styles.accountIcon+" grid h-12 w-12 place-items-center rounded-2xl border"}>
              <UserCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className={styles.amber+" text-[10px] font-black uppercase tracking-[0.2em]"}>Datos de tu cuenta</p>
              <h2 className={styles.primary+" text-xl font-black mt-0.5 break-words"}>{consumer.display_name || "Nombre no informado"}</h2>
              <p className={styles.muted+" text-[11px] font-mono break-all"}>{consumer.email || "Correo no informado"}</p>
            </div>
          </div>
          
          <span data-testid="consumer-passport-account-status" className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider self-start sm:self-center ${styles.status} ${tone}`}>
            {accountStatusLabel}
          </span>
        </div>

        <div className={styles.detailGrid+" mt-4 grid gap-3 text-xs sm:grid-cols-2"}>
          <p><span className={styles.muted+" block text-[9px] uppercase tracking-wider font-bold mb-0.5"}>Tipo de cuenta</span>Cuenta NexID</p>
          <p><span className={styles.muted+" block text-[9px] uppercase tracking-wider font-bold mb-0.5"}>Estado de tu cuenta</span>{accountStatusLabel}</p>
        </div>
      </section>

      {/* Accesos y condiciones; no acredita membresías ni registros. */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Membresías", value: "Condiciones por marca", desc: "Consultá tus marcas para revisar las membresías y condiciones que informa cada una.", Icon: Award, colorClass: styles.amber },
          { title: "Registros digitales", value: "Consultar en tu wallet", desc: "Consultá los registros digitales disponibles de tus productos.", Icon: WalletCards, colorClass: styles.cyan },
          { title: "Estado de cuenta", value: accountStatusLabel, desc: "Estado informado por NexID.", Icon: ShieldCheck, colorClass: styles.emerald }
        ].map(({ title, value, desc, Icon, colorClass }) => {
          const FeatureIcon = Icon;
          return (
            <article key={title} className={styles.featureCard+" rounded-3xl border p-5 transition duration-300"}>
              <div className="flex items-center justify-between">
                <span className={styles.muted+" text-[10px] font-black uppercase tracking-wider"}>{title}</span>
                <FeatureIcon className={`h-4.5 w-4.5 ${colorClass}`} />
              </div>
              <p className={styles.primary+" mt-3 text-lg font-black leading-tight"}>{value}</p>
              <p className={styles.muted+" mt-1.5 text-[10px] leading-relaxed"}>{desc}</p>
            </article>
          );
        })}
      </section>

      {/* Navigation triggers */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/me/products" className={styles.action+" rounded-2xl border px-4 py-3.5 text-xs font-bold transition flex items-center justify-between"}>
          <span>Ver mis productos</span>
          <ChevronRight className={styles.actionIcon+" h-4 w-4"} />
        </Link>
        <Link href={tenant ? `/me/wallet?tenant=${encodeURIComponent(tenant)}` : "/me/wallet"} className={styles.action+" "+styles.wallet+" rounded-2xl border px-4 py-3.5 text-xs font-bold transition flex items-center justify-between"}>
          <span>Ver wallet y registros digitales</span>
          <ChevronRight className={styles.actionIcon+" h-4 w-4"} />
        </Link>
        <Link href={tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace"} className={styles.action+" "+styles.catalog+" rounded-2xl border px-4 py-3.5 text-xs font-bold transition flex items-center justify-between"}>
          <span>Consultar catálogo</span>
          <ChevronRight className={styles.actionIcon+" h-4 w-4"} />
        </Link>
      </section>
      
      </div>
    </PortalShell>
  );
}
