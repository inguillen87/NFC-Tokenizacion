import Link from "next/link";
import { SectionHeading } from "@product/ui";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  KeyRound,
  LockKeyhole,
  PackageCheck,
  ScanLine,
  Server,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { getDashboardI18n } from "../../../lib/locale";
import { dashboardContent } from "../../../lib/dashboard-content";
import { InteractiveSdkGuide } from "./interactive-guide";
import styles from "./sdk-vision.module.css";

const serverExample = `// Tu backend o BFF. Nunca ejecutar con la API key en el navegador.
const response = await fetch("https://api.nexid.lat/api/v1/sdk/verify", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-nexid-api-key": process.env.NEXID_API_KEY,
    "x-nexid-tenant-slug": "mi-tenant",
  },
  body: JSON.stringify({
    bid: "LOT-2026-0042",
    picc_data: tap.piccData,
    enc: tap.enc,
    cmac: tap.cmac,
  }),
});

if (!response.ok) throw new Error("nexID verification failed");
const result = await response.json();`;

const controls = [
  {
    icon: KeyRound,
    title: "Credencial por tenant",
    body: "Cada integración usa una key revocable, con nombre, vencimiento y alcance explícito.",
  },
  {
    icon: LockKeyhole,
    title: "Solo servidor",
    body: "La API key queda en el backend, BFF, POS o ERP. El navegador recibe únicamente el resultado necesario.",
  },
  {
    icon: ShieldCheck,
    title: "Permiso mínimo",
    body: "Verify, claims, productos, eventos, POS y logística se habilitan por separado.",
  },
  {
    icon: Webhook,
    title: "Salida verificable",
    body: "Los webhooks se firman cuando el tenant configura un secreto de entrega.",
  },
];

const carriers = [
  {
    icon: ScanLine,
    eyebrow: "Entrada accesible",
    title: "QR, GS1 y NFC estándar",
    body: "Identidad visible, telemetría y experiencia digital. Sirven para empezar, pero no demuestran por sí solos que el soporte físico sea imposible de copiar.",
    verdict: "IDENTIDAD VISIBLE",
  },
  {
    icon: PackageCheck,
    eyebrow: "Autenticidad fuerte",
    title: "NFC criptográfico y tamper",
    body: "El servidor valida datos dinámicos y políticas anti-replay. La afirmación de autenticidad depende del carrier, la configuración y la lectura recibida.",
    verdict: "VERIFICACIÓN CRIPTOGRÁFICA",
  },
];

export default async function SdkVisionPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className={styles.page}>
      <SectionHeading
        eyebrow="Developer Hub"
        title={copy.pages.sdkVision.title}
        description="Contrato técnico y operativo para conectar productos físicos con nexID sin exponer secretos ni confundir una simulación con producción."
      />

      <section className={styles.hero} aria-labelledby="sdk-contract-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Contrato actual</p>
          <h2 id="sdk-contract-title">La integración empieza en el servidor del cliente.</h2>
          <p>
            La app, el QR o el lector capturan la señal. El backend autorizado llama a nexID,
            recibe un veredicto y decide qué mostrar, registrar o enviar al CRM.
          </p>
          <div className={styles.badges} aria-label="Propiedades del contrato">
            <span><CheckCircle2 aria-hidden="true" /> API de producción</span>
            <span><Server aria-hidden="true" /> Server-side</span>
            <span><ShieldCheck aria-hidden="true" /> Scopes explícitos</span>
          </div>
          <div className={styles.actions}>
            <Link href="/api-keys" className={styles.primaryAction}>
              Administrar credenciales <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="https://nexid.lat/sdk" className={styles.secondaryAction}>
              Ver arquitectura pública
            </Link>
          </div>
        </div>

        <ol className={styles.pipeline} aria-label="Flujo de integración nexID">
          <li><span>01</span><div><b>Producto o lector</b><small>QR, GS1, NFC, POS o ERP</small></div></li>
          <li><span>02</span><div><b>Backend del cliente</b><small>Protege la key y aplica negocio</small></div></li>
          <li><span>03</span><div><b>API nexID</b><small>Verifica tenant, scope y evidencia</small></div></li>
          <li><span>04</span><div><b>Resultado controlado</b><small>UX, CRM, webhook o auditoría</small></div></li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="guided-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Guía interactiva</p>
          <h2 id="guided-title">Elegí el punto de entrada y mirá el contrato exacto</h2>
          <p>La guía genera ejemplos para backend. No ejecuta transacciones ni consume una key real.</p>
        </div>
        <InteractiveSdkGuide />
      </section>

      <section className={styles.section} aria-labelledby="carrier-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Verdad del carrier</p>
          <h2 id="carrier-title">No todos los identificadores prueban lo mismo</h2>
          <p>nexID conserva el mismo API, pero ajusta el veredicto al nivel físico de evidencia disponible.</p>
        </div>
        <div className={styles.carrierGrid}>
          {carriers.map(({ icon: Icon, eyebrow, title, body, verdict }) => (
            <article key={title} className={styles.carrierItem}>
              <div className={styles.iconBox}><Icon aria-hidden="true" /></div>
              <div>
                <p className={styles.itemEyebrow}>{eyebrow}</p>
                <h3>{title}</h3>
                <p>{body}</p>
                <span className={styles.verdict}>{verdict}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.codeSection} aria-labelledby="server-example-title">
        <div className={styles.codeIntro}>
          <p className={styles.eyebrow}>Ejemplo mínimo</p>
          <h2 id="server-example-title">Una llamada real a producción, desde servidor</h2>
          <p>
            Este ejemplo usa REST porque el paquete público todavía no fue publicado por nexID.
            No instalamos ni recomendamos paquetes de terceros con un nombre parecido.
          </p>
          <div className={styles.codeFacts}>
            <span><Code2 aria-hidden="true" /> Endpoint versionado</span>
            <span><KeyRound aria-hidden="true" /> Secreto en variable de entorno</span>
            <span><ShieldCheck aria-hidden="true" /> Tenant y scope validados</span>
          </div>
        </div>
        <pre className={styles.code}><code>{serverExample}</code></pre>
      </section>

      <section className={styles.section} aria-labelledby="governance-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Gobierno enterprise</p>
          <h2 id="governance-title">Control antes de escalar volumen</h2>
        </div>
        <div className={styles.controlGrid}>
          {controls.map(({ icon: Icon, title, body }) => (
            <article key={title} className={styles.controlItem}>
              <Icon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
