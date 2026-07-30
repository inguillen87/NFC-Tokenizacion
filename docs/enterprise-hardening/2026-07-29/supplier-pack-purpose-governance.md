# Supplier pack purpose governance

Estado: implementado y verificado localmente. No aplicado ni probado contra la base productiva.

## La separación que nexID necesita

La plataforma tiene tres planos distintos y no debe usar un resultado de uno como prueba automática de otro:

1. **Evidencia criptográfica NFC de lectura:** K_META/K_FILE, SDM/SUN, CMAC, contador, replay y el estado TagTamper reportado prueban propiedades criptográficas de una lectura. No certifican por sí solos origen, contenido, adhesión, instalación del loop, apertura real, custodia ni autenticidad del producto físico. Esta ruta no cambia.
2. **Integración con fábrica:** el pack cifrado permite programar y validar un lote piloto. Un QA de diez tags demuestra integración técnica; no demuestra aceptación estadística de un lote comercial.
3. **Liberación comercial:** activar, habilitar claim, consumir POS, registrar ownership, tokenizar o publicar en marketplace requiere una política comercial separada y auditable.

## Contrato actual

| Propósito | Export factory pack | QA SUN fijo | Activación, claim y ownership | Disposición |
| --- | --- | --- | --- | --- |
| `legacy_unclassified` | bloqueado | sólo rechazo; un pass exige clasificación auditada | bloqueado | sin clasificar |
| `trial_integration` | permitido, cifrado y marcado | permitido para integración | bloqueado; no admite override | `NON_SELLABLE` |
| `production` | bloqueado | no puede aprobar con el gate fijo | bloqueado | pendiente QA v2 |

El override administrativo existente no puede cruzar ninguno de estos tres límites. Sigue siendo utilizable únicamente para fallas operativas que una política futura declare overrideables.

## Samples físicos existentes

La migración no reescribe claves, ciphertext, BID, UID, SDM, CMAC, contadores ni estado TagTamper. Las filas existentes se marcan `legacy_unclassified` sin heurísticas. Un superadmin o tenant admin autorizado puede clasificar una sola vez como `trial_integration` únicamente el alcance histórico que todavía esté inactivo, mediante una decisión append-only que enumera exactamente los sub-batches y sus recibos QA existentes.

La clasificación preserva la validación SUN de los samples. No los convierte en vendibles y no activa tags nuevos. Los samples que ya estaban activos antes de la migración siguen pudiendo validar SUN, pero la clasificación los rechaza deliberadamente: no se reescriben ni se "regularizan" en silencio y deben inventariarse como excepción histórica antes del rollout.

## Autoridad de base de datos

La migración `20260729143000_0071_supplier_pack_purpose_governance.sql` agrega:

- propósito declarado inmutable en order y sub-batch;
- decisión legacy-to-trial y detalle exacto append-only;
- vistas que exponen propósito declarado, efectivo y receipt de clasificación;
- scope QA server-owned;
- resolución fail-closed de vínculos forward, reverse y tenant+BID;
- triggers de transición para batches y tags;
- guards de identidad y propósito en POS, SDK claim y ownership del consumidor;
- watermark, preflight y dry-run hasta `0071`.

## Límites que siguen abiertos

- `production` necesita QA v2: plan aprobado por tenant, muestra estratificada elegida por servidor, AQL/accept-reject registrado y receipt de liberación.
- tokenización y marketplace requieren FKs autoritativas hacia tag/ownership antes de instalar el mismo guard sin romper flujos realmente públicos o no-supplier.
- falta ejecutar la cadena completa en PostgreSQL descartable, incluyendo concurrencia, rollback tardío y filas históricas.
- falta inventario read-only y rollout controlado sobre Neon. Ningún test local prueba que `0071` esté aplicado en producción.

## Custodia de secretos

Los packs piloto siguen usando envelope AES-256-GCM con AAD por tenant/lote/rol/versión. Eso es custodia por software; no es HSM ni KMS administrado. La migración de custodia puede hacerse sin cambiar el propósito comercial ni el camino SUN físico, pero debe presentarse honestamente hasta contar con evidencia del proveedor de claves.
