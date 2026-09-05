# Observación de taps SUN — 5 de septiembre de 2026

## Alcance y fuentes

Revisión de sólo lectura de la ventana **12:05–12:20 ART (UTC−03:00)**. Se consultaron los logs del proyecto Vercel `nexid-api` (`prj_r0dmVaKogGs8y4NAZ2njCWHhUgLk`), deployment productivo `dpl_7CAcNex7ofwMEt2sHxLvoX7h45s2`, y los registros de `public.events` de Neon `nfc-token-api` (`young-mouse-14324031`), rama `main` (`br-jolly-butterfly-aivukyzq`, primary/default). Las otras ramas listadas eran backups o staging.

No se escribieron datos, no se repitieron URLs SUN y no se modificaron credenciales, despliegues ni configuración. Este informe omite identificadores de tags, IP, query strings, capacidades, coordenadas y datos personales.

## Eventos persistidos

Los tres registros pertenecen a **Bodega Balmec**, slug `demobodega`, con `source=real`, `event_type=TAP_VALID`, `verdict=valid`, `cmac_ok=true` y `allowlisted=true`. La denominación del tenant no convierte estas lecturas en datos de la demo simulada.

| Hora de persistencia ART | Resultado digital | Observación del teléfono | Recibida ART |
| --- | --- | --- | --- |
| 12:08:57 | `VALID_CLOSED` — el tag informa cerrado | No registrada | — |
| 12:09:09 | `VALID_OPENED` — el tag informa abierto | Mendoza; aproximada; consentimiento explícito registrado | 12:09:30 |
| 12:09:53 | `VALID_CLOSED` — el tag informa cerrado | Mendoza; aproximada; consentimiento explícito registrado | 12:10:08 |

Resultado agregado de esa ventana: **3 taps, 2 tags distintos, 2 resultados cerrado, 1 abierto y 2 observaciones consentidas en Mendoza**. El conteo de tags no representa personas ni propietarios.

Los tres eventos conservan por separado su zona de red original: **Buenos Aires, AR**, fuente `edge_ip_approx`. En los dos enriquecidos, `post_tap_location_observation` informa `source=browser_geolocation_approximate_consent`, `consent=true` y `precision=approximate`. Por tanto, la observación posterior del teléfono no debe confundirse con la estimación inicial de red ni con el origen del producto. No se verificó físicamente la ubicación del dispositivo.

## Contraste con la API productiva

Los logs de esa misma ventana muestran tres `GET /sun` con respuesta **303**, iniciados a las 12:08:56, 12:09:08 y 12:09:52 ART. También muestran dos `POST /sun/context` con respuesta **200**, a las 12:09:30 y 12:10:08 ART. Son consistentes con las tres persistencias y los horarios de recepción de las dos observaciones. No se usa esta coincidencia temporal para afirmar la identidad de una persona.

## Lo que queda probado y lo que no

- **Probado:** las tres lecturas están persistidas para Balmec como actividad real y dos recibieron el enriquecimiento de ubicación aproximada con consentimiento.
- **No probado por esta revisión:** que el CRM haya recibido estos mismos registros por su stream, que el mapa del dashboard haya representado la observación posterior, o que el recorrido físico completo esté certificado en realtime.
- Un resultado digital válido verifica el mensaje y los controles registrados; no certifica por sí solo contenido, autenticidad física, propiedad, origen o cadena de custodia del producto.

La consulta de esquema de `public.events` no mostró la columna `realtime_projection_revision`. Esto no constituye una auditoría completa de migraciones, pero confirma que no debe suponerse activo el contrato local del outbox a partir de estos taps.
