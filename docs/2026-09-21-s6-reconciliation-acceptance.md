# S6 — Conciliación de retiros: aceptación verificada, no desplegada

Fecha de comprobación: 21 de septiembre de 2026.
Estado: código remoto y validación automatizada aprobados; publicación pendiente.

## Fuente exacta y resultado comprobado

- Repositorio: inguillen87/NFC-Tokenizacion.
- Rama de implementación: codex/nexid-recall-reconciliation-ui-20260920.
- Commit de código validado: c60b233924db262a73e0ef0704501662642ff602.
- Árbol del candidato: 260e1a7e7a25cf3d75bc71065cc8d8f26d2da7c5.
- Base del dashboard: 14d62ca9a67e07f20eb939e79af32cc5f7d106c2.
- API usada para aceptación: a3e51ffdc324631640734b4b246f23c1ac1f5842.
- GitHub Actions run: 35557122467; job: 106202801680.
- Conclusión del run y del job: success.
- Ejecución: 2026-09-21T03:19:10Z a 2026-09-21T03:22:24Z.
- Evidencia: https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35557122467

Se consultaron el estado, los pasos y el log completo del job. El resultado ya no
es sólo la aceptación parcial guardada en la PC: corresponde al código remoto
recuperado y a sus hashes comprobados al iniciar la ejecución.

## Gates que terminaron correctamente

1. Integridad de archivos contra el manifiesto de hashes del candidato.
2. TypeScript del dashboard.
3. Suite completa de dashboard: 964 pruebas, 962 aprobadas, cero fallidas,
   cero canceladas y dos omitidas. Incluye 16 pruebas de conciliación.
4. QA estático y build de producción de Next.js: compilación, TypeScript y
   generación de páginas completados.
5. Control de secretos: 2431 archivos inspeccionados por el gate, sin hallazgos
   de sus patrones prohibidos. No equivale a una auditoría completa de seguridad.
6. Recorrido integrado con Next/React/BFF, handlers existentes y PostgreSQL 18.4
   efímero. Sesiones, usuarios, retiros y comprobantes fueron sintéticos.
7. Cuatro variantes automatizadas de 1440/390 px y claro/oscuro; el reporte
   registra cero incidencias axe en cada superficie evaluada.
8. Limpieza del servidor de ensayo, procesos y contenedor al terminar.

El log de navegador confirma siete comprobaciones: filtros sin nuevas consultas;
preview de cantidades y cancelación; respuesta perdida con recuperación sin
repetir operación; respuesta del responsable asignado e historial por destino;
cambio concurrente que impide cerrar desde datos anteriores; fallo de lectura
previa e independencia del aprobador; exportación, consulta sin escritura y
configuración sintética de lote/tags intacta. Al cerrar el seguimiento, el aviso
público de producto permanece, tal como exige el circuito existente.

Artefacto del run: nexid-s6-reconciliation-evidence, ID 10621022525.
Tamaño registrado: 1371853 bytes.
SHA-256 registrado por GitHub Actions:
a1ca77beb6cb3be895da996c414c8021fbc6bd24ac7de2696d0fbb301448e372.
La retención configurada es de tres días. Ese identificador no garantiza que el
artefacto siga disponible después de su vencimiento.

## Cambios cerrados en el candidato

La gestión de retiros conserva su expediente y sus acciones originales. Acuses y
cantidades incorpora destinos filtrables, saldo declarado, cantidades devueltas e
inmovilizadas diferenciadas y acceso al historial del destino. Filtrar no altera
el objetivo del caso ni efectúa solicitudes nuevas.

La cantidad ingresada representa un total acumulado. El diálogo muestra cómo
quedaría el destino, sus pendientes y las variaciones; una reducción se identifica
como corrección. No convierte una declaración en evidencia física.

Antes de pedir o aprobar cierre se releen la revisión y autoridad. Un cambio
concurrente requiere nueva revisión humana. Los comandos con respuesta incierta
no se abandonan al actualizar, cambiar de caso o exportar: se conserva su intento
para reconciliarlo. No hay reintentos automáticos ni nuevas comunicaciones.

La vista móvil pliega la lista de casos después de elegir uno, mantiene una acción
para cambiarlo y compacta los encabezados. La comprobación automatizada exige que
el encabezado de pendientes quede dentro del primer viewport móvil ensayado.
Las fechas iniciales del caso usan un formato UTC determinista compartido por
servidor y navegador, evitando diferencias de hidratación por zona o formato local.

## Lo que aún NO se acredita

No se afirma revisión visual humana completa de las capturas finales ni
certificación WCAG. No se certificaron todos los recorridos privados de NexID,
la carga industrial, un retiro de cliente o una prueba física NFC en producción.

No se desplegó este incremento. El conector Vercel volvió a responder 403 Forbidden
al consultar app.nexid.lat bajo el equipo marcelos-projects-c26aa499. Su respuesta
pide reautenticación con acceso a ese equipo. Es un bloqueo de autoridad del
conector, no evidencia de una caída de la aplicación. No se intentó evadirlo,
crear un token ni extraer credenciales mediante otros servicios.

El cupo de Desktop Commander había impedido continuar por la PC. No se contrató
un plan ni se reintentó en bucle ese canal. La última ejecución de CI se comprobó
sin volver a lanzarla; este documento no cambia el código ensayado y no necesita
otro build del mismo código.

## Condiciones de publicación

Una conexión autorizada debe verificar los aliases y SHAs vigentes de las tres
aplicaciones, revisar las capturas finales y preparar el manifiesto de release.
Después corresponde desplegar únicamente dashboard a staging, comprobar sus
rutas públicas/privadas y promover el artefacto validado al dominio canónico.
Si otra ejecución cambió la base, reconciliar primero: no sobrescribir ni usar
force push. No desplegar la API ni la web incluidas en la rama del dashboard;
esas aplicaciones mantienen revisiones productivas independientes.

Los archivos locales anteriores permanecen en el worktree
C:\Users\guill\.codex\worktrees\nexid-recall-reconciliation-ui-20260920.
Esta recuperación no fue cotejada byte a byte con esos cambios sin commit:
reconciliar antes de retomar la PC; no hacer un reset destructivo.

No se cambian versiones públicas, aliases, bases, planes, SUN/SDM, TTStatus,
claves, contadores, QR/GS1, SDK, Polygon/IOTA o etiquetas de Balmec en este cierre
documental. No se acredita su estado actual mediante una nueva consulta de DB:
se preserva el alcance y no se hacen escrituras productivas.

S6 en el plan original comprende retiro completo e informe real del piloto. Esta
aceptación cierra el incremento de conciliación probado, no toda la fase S6 ni su
puesta en producción. La siguiente acción es habilitar la publicación autorizada,
no volver a construir otro módulo de retiro.
