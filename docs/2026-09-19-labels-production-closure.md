# Producción QR / GS1 — cierre publicado el 19/09/2026

## Artefactos efectivamente promovidos

API: 2026.09.19-api-labels.1, commit a39eaf32bc861ad4a0d073c5e1115b1c6efab80b,
dpl_9LEp6zxrXfMpP6TB2g7rFSqYAzqb en api.nexid.lat.
Dashboard: 2026.09.19-dashboard.20, commit 210964916f3877666cb22b2e8b69c021f612964c,
dpl_5PWgoZPTDFqtsy4CAcuvVXjjykFX en app.nexid.lat.
Web conservada: 2026.09.19-web-consumer.1, commit e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg en nexid.lat.

Los dos builds nuevos terminaron READY desde fuentes limpias, gitDirty=0, con
proyecto y SHA confirmados. Se promovió primero API y después dashboard y se
confirmaron los tres dominios; la web del TAP no fue redeployada.

## Cierre operativo

La empresa accede desde Lotes -> Enlaces QR / estado NFC -> Producción QR / GS1.
La acción nueva aparece en los perfiles QR/GS1 compatibles, no en TagTamper.
CSV de hasta 100 identidades y 64 KiB: preparar, revisar errores por fila,
validar contra registro y prefijos autorizados, confirmar con referencia y
recuperar el comprobante. Archivo, auditoría y recibo se confirman juntos;
una respuesta perdida se reconcilia con el mismo ID sin duplicar las filas.

La impresión reutiliza el registro vigente: HTML autónomo con SVG, CSV y JSON.
QR básico produce copias del mismo enlace de lote y así lo informa; no serializa
unidades ficticias. GS1 usa las identidades del comprobante y revalida estado y
prefijo antes de preparar otra plancha. No activa chips ni acredita autenticidad
NFC, producción física, calidad de impresión o aceptación de fábrica.

## Migración y preservación de datos

Se aplicó 20260919180000_0110_gs1_batch_import.sql en una transacción con
precondición de ausencia y comprobación de hashes antes de registrar la migración.
Es aditiva: tabla de comprobantes, índice y funciones. No modifica lote/tag previo.
Hash plan: 96ec0c16b461cd59033956b83b8149d7e612ba6ee97fc9e918e44e972ee4d8e2.
Hash commit: 87a76562f46f9cd253e894993b3eb297c5c59e256aaa8e53a06a393c7bda75cc.
Ambos coinciden con el código que pasó las pruebas locales; SECURITY INVOKER,
privilegios PUBLIC revocados y ejecución del runtime comprobada.

La consulta posterior confirmó cero importaciones, cero identidades GS1 y cero
prefijos activos: no se crearon datos de cliente o licencias de muestra para la
presentación. El primer cliente GS1 debe aportar su GTIN y autorización real.
Balmec conserva su perfil ntag424_dna_tt, 10 etiquetas activas y 10 inactivas,
y el hash f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se cambiaron claves, contadores, TTStatus, Polygon/IOTA, mensajes o planes.
Vercel sigue informando Neon Free/free_v3.

## Evidencia de pruebas

Dashboard: TypeScript y build aprobados; 886 pruebas, 884 aprobadas, cero fallidas
y dos omitidas. API: seis pruebas nuevas, build y toda la cadena de regresiones
aprobados. Gates de secretos aprobados. No hay dependencias/lockfile nuevos.

20 escenarios con PostgreSQL real local y los handlers de producción probaron
concurrencia, 100 filas, recepción completa, reintentos, cambios durante revisión,
falta/revocación de prefijo, conflictos, rollback ante fallos de auditoría/recibo,
historial, print de 100 filas, escape de contenido y conservación del estado NFC.
Diez comprobaciones integradas Next/React/BFF+PostgreSQL pasaron junto a cuatro
casos visuales 1440/390 claro/oscuro, sin hallazgos axe en la superficie evaluada.
La plancha se renderizó sin red externa. No se imprimió ni escaneó físicamente.

Después de publicar: /health 200, /sun sin argumentos 400, versiones de API y
dashboard correctas y seis pruebas públicas de navegador aprobadas. La ruta
privada exige login y no expone la interfaz sin sesión. En el staging, la consulta
de historial sin sesión fue rechazada antes de acceder a datos.

El intento de abrir el lote en el Chrome autenticado del titular no logró
conectar por CDP en 15 segundos; quedó sin confirmar, antes de abrir una pestaña.
No se afirma una importación/impresión productiva ni una nueva lectura física.
Los usuarios, prefijos y GTIN de las pruebas completas fueron exclusivamente locales.

## Alcance pendiente

Este cierre es preparación acotada de archivos y planchas. No representa una
cola masiva de miles de unidades, reserva de rangos futuros, protocolo directo
de impresora industrial, lectura UHF ni aprobación de muestras físicas. Se
conservan esos siguientes pasos del plan, sin convertir el piloto NFC actual.
Rollback previo: API dpl_EF7fbwNt2JVZuPXFpGLrUjL1Jcw3 y dashboard
dpl_CvrjWucm6Qop7PTe6WbR9KpkRMbs. Una reversa no borra auditoría ni identidades.
