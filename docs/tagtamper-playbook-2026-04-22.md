# TagTamper 424 DNA — Plan de remediación operativo (hoy + próximo pedido)

## TL;DR
Si la etiqueta rota sigue en `VALID`, hay que resolver 3 capas:
1. **Backend fail-safe** (ya aplicado): si falta evidencia TT en batch TagTamper, no confiar.
2. **Personalización NDEF/SDM** (proveedor): incluir evidencia TT explícita (URL o ENC verificable).
3. **Validación de campo** (intacta vs rota): confirmar que el estado cambia en `/sun` y logs.

---

## 1) Qué hacer hoy (sin esperar próximo lote)

1. Activar modo estricto en producción:
   - `TAGTAMPER_REQUIRE_EVIDENCE=1`
2. Redeploy sin caché.
3. Test A/B:
   - Tag intacta: tap real
   - Tag rota/abierta: tap real
4. Verificar en `/sun` response:
   - `result`
   - `tamper_signal`
   - `tamper_opened`
   - `tamper_risk`
   - `tag_tamper_config_detected`
   - `tag_tamper_evidence_required`
   - `enc_plain_status_byte`

Resultado esperado en anti-fraude premium:
- Si no hay evidencia TT confiable: `TAMPER_UNVERIFIED` (nunca `VALID`).
- Si hay evidencia de apertura/manipulación: `OPENED` o `TAMPER_RISK`.

---

## 2) Qué pedir al proveedor (próximo pedido)

Solicitar **personalización TagTamper explícita** en SDM/NDEF para que backend reciba señal inequívoca del loop:

- Incluir estado TT de forma explícita en URL (query param) **o** dentro de campo ENC con formato acordado.
- Entregar documento de mapeo oficial (valor -> estado):
  - `closed/intact`
  - `opened`
  - `tamper/alarm`
- Entregar 2 muestras certificadas por lote:
  - una intacta
  - una con loop abierto
- Entregar layout SDM final por escrito:
  - qué se espeja en `picc_data`
  - qué se espeja en `enc`
  - qué parámetro TT sale en URL

### Mensaje sugerido al importador/proveedor

> Necesitamos personalización NXP NTAG 424 DNA TagTamper para anti-fraude premium en botellas.
> Requerimos que el estado TagTamper (loop intacto/abierto) sea exportado de forma inequívoca en el flujo SUN,
> ya sea como parámetro TT explícito en URL o como campo ENC con mapeo documentado.
> Por favor incluir especificación de mapeo de valores TT y dos muestras certificadas (intacta y abierta)
> para validación backend antes de liberar producción.

---

## 3) Criterio de aceptación (go-live)

- 20/20 taps con tag intacta no deben caer en `OPENED`/`TAMPER_RISK`.
- 20/20 taps con tag abierta deben caer en `OPENED` o `TAMPER_RISK`.
- 0 casos de tag abierta clasificada como `VALID`.

---

## 4) Política anti-hack recomendada

- Mantener `TAGTAMPER_REQUIRE_EVIDENCE=1` para líneas premium.
- Bloquear rewards/claims/ownership/tokenization cuando el estado sea:
  - `OPENED`
  - `TAMPER_RISK`
  - `TAMPER_UNVERIFIED`

Esto evita “falsos auténticos” por personalización incompleta del proveedor.
