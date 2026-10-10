import type { Metadata } from "next";
import Link from "next/link";
import { PublicLegalShell, privacyContactEmail, privacyContactHref } from "../../components/public-legal-shell";

export const metadata: Metadata = {
  title: "Privacidad | NexID",
  description: "Qué datos utiliza NexID para el pasaporte de producto, el acceso a tu cuenta y los servicios de las marcas. Ubicación opcional y solicitudes sobre tus datos.",
  alternates: { canonical: "https://nexid.lat/privacy" },
  openGraph: { title: "Privacidad | NexID", description: "Conocé cómo se utilizan tus datos y cómo contactar a NexID.", url: "https://nexid.lat/privacy", type: "website", locale: "es_AR" },
};

export default function PrivacyPage() {
  return (
    <PublicLegalShell
      page="privacy"
      title="Tu privacidad en NexID."
      description="Esta política explica qué información usamos cuando consultás un producto, accedés a tu cuenta o elegís un servicio de una marca."
      sections={[
        { id: "responsable", title: "Quién opera el servicio", content: <>
          <p><strong>NexID es una marca comercial operada por GUILLEN MARCELO ARIEL, titular legal del servicio.</strong> El contacto público para consultas sobre datos es <a href={privacyContactHref}>{privacyContactEmail}</a>.</p>
          <p>Esta política cubre las experiencias de NexID: sitio web, pasaporte de producto por NFC o QR y portal de usuario. Una empresa que publica productos y servicios en NexID también administra la información y las acciones que le corresponden. Sus sitios externos y canales propios pueden tener políticas adicionales.</p>
        </> },
        { id: "datos", title: "Qué información utilizamos", content: <>
          <ul>
            <li><strong>Acceso y cuenta.</strong> Email o teléfono que ingresás, identidad de la cuenta, preferencias y sesiones. Los códigos de acceso y las sesiones tienen vigencia limitada; la validación utiliza valores protegidos mediante hash.</li>
            <li><strong>Lecturas y productos.</strong> Identificadores del producto, lote o etiqueta, fecha, resultado de la lectura y eventos técnicos de verificación. Si elegís guardar o vincular un producto, esa acción puede asociarse con tu cuenta y la empresa correspondiente.</li>
            <li><strong>Servicios que elegís.</strong> Datos que ingresás en solicitudes, consultas, calificaciones o programas de beneficios habilitados por la empresa, junto con su estado y los consentimientos asociados.</li>
            <li><strong>Datos técnicos.</strong> Información de la conexión y del navegador necesaria para operar y proteger el servicio, como la dirección IP, datos del agente de usuario, errores y eventos de seguridad. Algunos registros de sesión utilizan hashes de la IP y del agente de usuario.</li>
          </ul>
          <p>Consultar una etiqueta no identifica por sí solo a una persona. Una lectura y una cuenta son registros distintos; el vínculo depende del acceso y de las acciones disponibles en el flujo.</p>
        </> },
        { id: "finalidades", title: "Para qué usamos los datos", content: <>
          <p>Para mostrar el pasaporte y su estado, verificar lecturas digitales, proteger el acceso, prevenir reutilización de mensajes o abuso, mantener tu sesión y atender las acciones que solicitás.</p>
          <p>Cuando guardás un producto o elegís un servicio, la información necesaria puede alimentar tu historial y la gestión de esa empresa. <strong>Iniciar sesión no autoriza por sí solo mensajes comerciales, compras ni inscripción en beneficios.</strong> Esas acciones dependen de su configuración, condiciones y permisos.</p>
          <p>Si consultás un asistente de producto o sommelier, el texto de tu pregunta y el contexto del producto pueden procesarse con los servicios de IA configurados para generar una respuesta. Evitá incluir datos sensibles, contraseñas o códigos de acceso en esas preguntas.</p>
        </> },
        { id: "ubicacion", title: "Ubicación y permisos", content: <>
          <p><strong>La ubicación del navegador se solicita con una acción y permiso explícitos.</strong> Podés continuar sin compartirla. En las experiencias que la utilizan, se reduce a una zona aproximada; no se presenta como una posición exacta.</p>
          <p>También puede existir una estimación por IP, identificada como aproximada. No equivale al GPS ni prueba por sí sola dónde se encuentra físicamente un producto o una persona.</p>
          <p>La ubicación de origen publicada por la marca es distinta de la ubicación de quien consulta. Las demos identifican los datos simulados. Los enlaces a mapas externos pueden incluir las coordenadas que elegís abrir.</p>
        </> },
        { id: "empresas", title: "Información para las marcas", content: <>
          <p>La empresa correspondiente puede consultar los eventos y las acciones de sus productos dentro de los permisos de NexID. Las vistas de gestión distinguen lecturas anónimas, productos vinculados y personas con consentimiento de contacto.</p>
          <p>La identificación de una etiqueta no se toma como autorización para contactar a su usuario. Los consentimientos se registran por empresa y finalidad. En <Link href="/me/privacy">Privacidad de mi cuenta</Link> podés consultar los registros disponibles; necesitás iniciar sesión.</p>
        </> },
        { id: "proveedores", title: "Servicios que intervienen", content: <>
          <p>NexID utiliza servicios de infraestructura y comunicaciones para alojar la plataforma, almacenar datos y entregar mensajes. Entre las integraciones del servicio se encuentran Vercel, Neon, Resend, WhatsApp de Meta y Twilio. El proveedor utilizado depende del canal y de la configuración activa.</p>
          <p>Si elegís WhatsApp para acceder, tu número y el mensaje de autenticación se procesan mediante el proveedor configurado y WhatsApp. Elegir email utiliza el servicio de correo configurado. Esto no constituye autorización para campañas comerciales.</p>
          <p>Estos proveedores pueden procesar información fuera de tu país. Las consultas a asistentes pueden utilizar proveedores de IA configurados. Podés solicitar información sobre los servicios que intervienen en tu caso.</p>
        </> },
        { id: "cookies", title: "Cookies y preferencias", content: <>
          <p>NexID utiliza cookies para mantener el acceso y preferencias como idioma o modo claro y oscuro. La preferencia de apariencia también puede guardarse en el almacenamiento local del navegador.</p>
          <p>Podés borrar estos datos desde tu navegador o cerrar sesión. Eliminar la cookie de acceso cierra ese acceso en el navegador; no elimina tu cuenta ni el historial asociado.</p>
        </> },
        { id: "conservacion", title: "Conservación y eliminación", content: <>
          <p>La conservación depende del tipo de dato y de su finalidad: acceso, operación del servicio, seguridad, atención de solicitudes o trazabilidad del producto. Las sesiones y los códigos tienen vencimiento; ese vencimiento no implica eliminar todos los registros asociados.</p>
          <p>La baja de una cuenta y la eliminación de todos los registros son acciones diferentes. Pueden permanecer vínculos, eventos o registros de trazabilidad y seguridad que requieren una revisión de alcance. Podés pedir qué datos se conservan sobre vos, para qué se utilizan y solicitar su eliminación.</p>
          <p><Link href="/data-deletion">Consultá cómo solicitar la eliminación de tus datos.</Link></p>
        </> },
        { id: "solicitudes", title: "Consultas y derechos", content: <>
          <p>Para solicitar acceso, una copia, corrección, eliminación de datos o revisión de un consentimiento, escribí a <a href={privacyContactHref}>{privacyContactEmail}</a>. Indicá el email o teléfono de tu cuenta y qué querés revisar, sin enviar códigos de acceso ni documentos sensibles de entrada.</p>
          <p>Una solicitud sobre datos de una empresa específica debe indicar también la marca o el producto. Es necesario verificar que la solicitud corresponde a la persona titular antes de entregar información o modificar una cuenta.</p>
          <p>Las modificaciones de esta política se publican en esta página con su fecha de actualización.</p>
        </> },
      ]}
    >
      <h2>Lo esencial</h2>
      <p>Usamos tu contacto para acceder, registramos las acciones que elegís y pedimos permiso para la ubicación del navegador. Entrar a tu cuenta no habilita mensajes comerciales automáticamente.</p>
      <p><Link href="/data-deletion">Quiero consultar o eliminar mis datos</Link></p>
    </PublicLegalShell>
  );
}
