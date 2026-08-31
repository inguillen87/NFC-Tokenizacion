# Anuncio de marca y solicitud de patente

Piezas preparadas como borradores para revisión. **No publicar todavía:** los PNG incluyen un aviso visible porque el repositorio no contiene la documentación que respalde los estados legales.

- Instagram feed 4:5: `nexid-marca-patente-instagram-1080x1350.png`
- Facebook 1.91:1: `nexid-marca-patente-facebook-1200x628.png`
- LinkedIn 1.91:1: `nexid-marca-patente-linkedin-1200x628.png`

Copy principal usado en las tres piezas:

> Registramos la marca nexID y presentamos una solicitud de patente de invención.

No se usa el símbolo ®, “tecnología patentada”, “patente concedida” ni “patent pending”. Antes de quitar el aviso y publicar, validar con la documentación correspondiente:

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

La composición se puede regenerar como borrador desde la raíz del repositorio con:

```powershell
node scripts/render-social-announcement.mjs
```

Una vez verificada la documentación, la versión sin aviso se genera deliberadamente con:

```powershell
node scripts/render-social-announcement.mjs --confirm-legal-claims
```

Ese indicador no valida nada por sí mismo: sólo debe usarse después del control documental.

La base visual es una imagen generada para esta campaña; el isotipo y el copy se incorporan de forma determinística desde los assets oficiales del repositorio.
