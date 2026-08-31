# Anuncio de marca y solicitud de patente

Las tres piezas fueron exportadas sin la franja roja de borrador, por pedido expreso del usuario. Esta decisión de presentación no constituye validación jurídica, registral ni del estado de la solicitud de patente.

- Instagram feed 4:5: `nexid-marca-patente-instagram-1080x1350.png`
- Facebook 1.91:1: `nexid-marca-patente-facebook-1200x628.png`
- LinkedIn 1.91:1: `nexid-marca-patente-linkedin-1200x628.png`

Copy principal usado en las tres piezas:

> Registramos la marca nexID y presentamos una solicitud de patente de invención.

No se usa el símbolo ®, “tecnología patentada”, “patente concedida” ni “patent pending”. La ausencia de la franja no confirma los estados legales comunicados; antes de publicar, validar con la documentación correspondiente:

- titular de la marca y de la solicitud;
- organismo y jurisdicción;
- número de registro de marca;
- número de expediente o solicitud de patente;
- fecha de registro y fecha de presentación;
- redacción autorizada por el asesor legal.

## Caption sugerido

Hoy nexID da un nuevo paso: registramos nuestra marca y presentamos una solicitud de patente de invención. Seguimos protegiendo la innovación que convierte cada producto conectado en una experiencia más simple, útil y medible para marcas y clientes.

Conocé más en https://nexid.lat

## Reproducción

La versión entregada, sin franja roja de borrador, se generó por pedido del usuario desde la raíz del repositorio con:

```powershell
node scripts/render-social-announcement.mjs --confirm-legal-claims
```

Para volver a generar borradores con el aviso visible:

```powershell
node scripts/render-social-announcement.mjs
```

El indicador usado para exportar sin franja no valida nada por sí mismo ni reemplaza el control documental y jurídico previo a la publicación.

La base visual es una imagen generada para esta campaña; el isotipo y el copy se incorporan de forma determinística desde los assets oficiales del repositorio.
