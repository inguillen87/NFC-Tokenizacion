import type { Metadata } from "next";
import Link from "next/link";
import { PublicLegalShell, privacyContactEmail, deletionContactHref } from "../../components/public-legal-shell";

export const metadata: Metadata = {
  title: "Solicitud de eliminación de datos | NexID",
  description: "Cómo solicitar la eliminación de datos o la baja de una cuenta NexID, sin necesidad de iniciar sesión. Contacto, alcance y verificación de identidad.",
  alternates: { canonical: "https://nexid.lat/data-deletion" },
  openGraph: { title: "Eliminar mis datos | NexID", description: "Instrucciones públicas para solicitar la revisión y eliminación de tus datos.", url: "https://nexid.lat/data-deletion", type: "website", locale: "es_AR" },
};

export default function DataDeletionPage() {
  return (
    <PublicLegalShell
      page="data-deletion"
      title="Solicitá la eliminación de tus datos."
      description="Podés hacer la solicitud aunque no puedas entrar a tu cuenta. Aquí encontrás el contacto, qué información incluir y qué alcance tiene la baja."
      sections={[
        { id: "como-solicitar", title: "Cómo hacer la solicitud", content: <>
          <ol>
            <li>Escribí a <a href={deletionContactHref}>{privacyContactEmail}</a> con el asunto <strong>Solicitud de eliminación de datos NexID</strong>.</li>
            <li>Indicá el email o teléfono que usaste en NexID y si querés dar de baja la cuenta, eliminar datos concretos o revisar un consentimiento.</li>
            <li>Si se trata de una marca o producto, indicá cuál. Si podés, enviá la solicitud desde el email asociado a tu cuenta.</li>
          </ol>
          <p><strong>No envíes códigos de verificación, contraseñas, datos de tarjeta ni imágenes de documentos de identidad en el primer mensaje.</strong> Es necesario verificar la titularidad antes de entregar datos o modificar una cuenta.</p>
          <p><a href={deletionContactHref}>Preparar email de solicitud</a>. Este enlace abre tu aplicación de correo; la solicitud se envía cuando vos enviás el mensaje.</p>
        </> },
        { id: "alcance", title: "Qué datos podés pedir revisar", content: <>
          <ul>
            <li><strong>Cuenta y contacto:</strong> email, teléfono, nombre y acceso a la cuenta.</li>
            <li><strong>Actividad vinculada:</strong> productos guardados, historial de lecturas, solicitudes y vínculos con empresas.</li>
            <li><strong>Permisos y consentimientos:</strong> finalidades de contacto, servicios o ubicación relacionados con tu actividad.</li>
          </ul>
          <p>También podés solicitar una copia o corrección de tus datos, sin pedir la baja de la cuenta.</p>
        </> },
        { id: "baja-y-registros", title: "Cuenta y trazabilidad son diferentes", content: <>
          <p>La baja de la cuenta retira los datos de contacto del perfil y revoca sus sesiones. <strong>No implica, por sí sola, borrar todos los registros de la plataforma.</strong></p>
          <p>Los eventos de producto, vínculos, solicitudes, identidades o registros de seguridad pueden requerir una revisión adicional. Una solicitud de eliminación debe evaluar también esos registros y el alcance que corresponda.</p>
          <p>Los datos de una etiqueta, lote o producto publicados por una empresa no son necesariamente datos personales tuyos. Cerrar sesión, borrar cookies o retirar el producto de una vista tampoco equivale a eliminar todos sus registros.</p>
        </> },
        { id: "sin-acceso", title: "Si no podés iniciar sesión", content: <>
          <p>Usá el mismo contacto por email. No necesitás recuperar tu acceso para consultar el procedimiento de eliminación. Indicá qué contacto utilizaste y el problema de acceso; no envíes un código recibido por email o WhatsApp.</p>
          <p>Si tenés acceso, <Link href="/me/privacy">Privacidad de mi cuenta</Link> muestra los registros de consentimiento disponibles. La solicitud por email sigue siendo el canal indicado aquí para pedir revisión o eliminación.</p>
        </> },
        { id: "seguimiento", title: "Alcance y seguimiento", content: <>
          <p>Enviar un email inicia una solicitud; no ejecuta una eliminación automática. Conservá tu mensaje para poder consultar su estado y el alcance de la revisión.</p>
          <p>Si necesitás saber qué datos podrían permanecer y por qué, incluí esa pregunta en tu solicitud. La información sobre el uso de los datos está en la <Link href="/privacy">política de privacidad de NexID</Link>.</p>
        </> },
      ]}
    >
      <h2>Sin iniciar sesión</h2>
      <p>Escribí a <a href={deletionContactHref}>{privacyContactEmail}</a> e indicá el contacto de tu cuenta y qué datos querés eliminar. No compartas ningún código de acceso.</p>
    </PublicLegalShell>
  );
}
