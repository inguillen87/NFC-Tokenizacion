import Link from "next/link";
import { redirect } from "next/navigation";
import { buildConsumerNextPath, readConsumerPrivacyPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import recoveryStyles from "../_components/consumer-list-recovery.module.css";
import styles from "../brands/brands.module.css";

type Row = Record<string, unknown>;
function record(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function tenantId(value: unknown): string | null {
  // Match only the reported ID; names, slugs and normalized IDs cannot establish a relationship.
  return typeof value === "string" && value.trim() ? value : null;
}
function purposeLabel(value: unknown): string {
  const labels: Record<string, string> = {
    whatsapp: "Mensajes por WhatsApp", whatsapp_marketing: "Promociones por WhatsApp",
    promotions: "Promociones de la marca", campaigns: "Campañas de la marca",
  };
  return typeof value === "string" && Object.hasOwn(labels, value) ? labels[value] : "Propósito no identificado";
}
function permissionLabel(value: unknown): string {
  return value === true ? "Autorizado" : value === false ? "No autorizado" : "Estado no informado";
}
function reportedBrands(payload: Row | null): Row[] | null {
  return payload?.ok === true && Array.isArray(payload.items) && payload.items.every(record) ? payload.items : null;
}
function groupedPermissions(rows: Row[], brands: Row[] | null) {
  const groups = new Map<string, { name: string; identified: boolean; rows: Row[] }>();
  rows.forEach((row, index) => {
    const id = tenantId(row.tenant_id);
    const key = id === null ? `unidentified-${index}` : `tenant-${id}`;
    const matches = id === null ? [] : (brands || []).filter(brand => tenantId(brand.tenant_id) === id);
    const name = matches.length === 1 ? text(matches[0].name) : null;
    const group = groups.get(key) || { name: name || "Marca sin nombre informado", identified: name !== null, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  });
  return Array.from(groups.values());
}

export default async function PrivacyPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const nextPath = buildConsumerNextPath("/me/privacy", params);
  const session = await readConsumerSession(nextPath);
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const [privacyRead, brandsRead] = await Promise.all([readConsumerPrivacyPath("privacy"), readConsumerPrivacyPath("brands")]);
  if (privacyRead.status === "unauthenticated" || brandsRead.status === "unauthenticated") {
    redirect(`/login?consumer=1&next=${encodeURIComponent(nextPath)}`);
  }
  const privacy = privacyRead.status === "ready" ? privacyRead.data : null;
  const consentRows = privacy?.ok === true && Array.isArray(privacy.consents) && privacy.consents.every(record) ? privacy.consents : null;
  const consumer = record(privacy?.consumer) ? privacy.consumer : null;
  const brands = reportedBrands(brandsRead.status === "ready" ? brandsRead.data : null);
  const groups = consentRows === null ? [] : groupedPermissions(consentRows, brands);
  const locales: Record<string, string> = { "es-AR": "Español (Argentina)", "pt-BR": "Português (Brasil)", en: "English", "en-US": "English (United States)" };
  const locale = text(consumer?.preferred_locale);

  return (
    <PortalShell title="Tus permisos con las marcas" subtitle="Consultá qué permisos quedaron registrados en tu cuenta para cada marca.">
      {privacyRead.status === "forbidden" ? (
        <section data-testid="consumer-privacy-forbidden" className={recoveryStyles.notice} role="status">
          <h2>Acceso denegado a tus permisos</h2><p>Esta cuenta no tiene acceso a esta consulta. No podemos confirmar tus permisos desde esta pantalla.</p>
          <Link className={styles.link} href="/me" prefetch={false}>Volver a mi cuenta</Link>
        </section>
      ) : consentRows === null ? (
        <section data-testid="consumer-privacy-unavailable" className={recoveryStyles.notice} role="status">
          <h2>No pudimos cargar tus permisos</h2><p>Reintentá la consulta. Esto no confirma que no tengas permisos registrados.</p><ConsumerDataRetryButton />
        </section>
      ) : (
        <>
          <section className={styles.intro} aria-labelledby="privacy-account-title">
            <h2 id="privacy-account-title">La información de tu cuenta</h2>
            <p>Nombre: <strong>{text(consumer?.display_name) || "Nombre no informado"}</strong></p>
            <p>Correo: <strong>{text(consumer?.email) || "Correo no informado"}</strong></p>
            <p>Idioma preferido: <strong>{locale && Object.hasOwn(locales, locale) ? locales[locale] : "No informado"}</strong></p>
            <p>Esta vista muestra los permisos registrados. Consultarlos no modifica tus elecciones.</p>
            <Link className={styles.link} href="/me/brands" prefetch={false}>Ver mis marcas y clubes</Link>
          </section>
          {consentRows.length === 0 ? (
            <section data-testid="consumer-privacy-empty" className={styles.empty}>
              <h2>No hay permisos registrados en esta cuenta</h2><p>Las elecciones que queden registradas con cada marca aparecerán acá.</p>
            </section>
          ) : (
            <>
              {brands === null && <section data-testid="consumer-privacy-brands-unavailable" className={recoveryStyles.notice} role="status">
                <h2>{brandsRead.status === "forbidden" ? "Acceso denegado a los nombres de tus marcas" : "No pudimos cargar los nombres de tus marcas"}</h2>
                <p>Tus permisos registrados siguen visibles. No asignamos un nombre de marca sin poder confirmarlo.</p><ConsumerDataRetryButton />
              </section>}
              <div className={styles.cards} data-testid="consumer-privacy-permissions">
                {groups.map((group, index) => <section key={index} className={styles.card} aria-labelledby={`privacy-brand-${index}`}>
                  <header className={styles.identity}><h2 id={`privacy-brand-${index}`}>{group.name}</h2>
                    {!group.identified && <p>No se pudo asociar un nombre único desde tus membresías.</p>}
                  </header>
                  <ul className={styles.list}>{group.rows.map((row, rowIndex) => <li key={rowIndex}>
                    <strong>{purposeLabel(row.scope)}</strong><span>{permissionLabel(row.granted)}</span>
                    {purposeLabel(row.scope) === "Propósito no identificado" && text(row.scope) && <details><summary>Ver referencia del permiso</summary><p>{text(row.scope)}</p></details>}
                  </li>)}</ul>
                </section>)}
              </div>
            </>
          )}
        </>
      )}
    </PortalShell>
  );
}
