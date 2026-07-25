# Decisión de custodia de claves para Nexid

Fecha del análisis: 24 de julio de 2026.

## Decisión ejecutiva

HSM no es obligatorio para demos, testnet ni staging temprano. Para producción paga, sí conviene usar desde el primer cliente un KMS con claves no exportables y respaldo HSM: el costo es demasiado bajo como para justificar una solución casera o afirmar una protección que no existe.

La elección recomendada depende de dónde se ejecute el firmante:

- Si Nexid mantiene el firmante en Google Cloud, usar Google Cloud HSM multi-tenant. Dos claves `secp256k1` cuestan aproximadamente USD 5 al mes.
- Si todavía no hay compromiso con GCP y se busca el menor costo HSM, AWS KMS cuesta aproximadamente USD 2 al mes por dos claves.
- No agregar una segunda nube únicamente para ahorrar USD 3 al mes. La identidad de workload, auditoría, soporte y operación cuestan más que esa diferencia.

El crédito de Google de USD 300 por 90 días no es el precio del servicio. Es un crédito general de bienvenida para toda la nube. Con dos claves Cloud HSM, el consumo estimado durante los 90 días sería cercano a USD 15; el resto del crédito vencería sin utilizarse.

## Modelo de 200.000 tags

Supuestos del escenario objetivo:

- 200.000 tags.
- Lotes de 5.000 tags: 40 lotes.
- Un anclaje por lote y por cadena: 80 firmas.
- Dos claves activas: una para Polygon y otra para IOTA EVM.

| Custodia | 80 firmas/mes | 200.000 firmas/mes | 400.000 firmas/mes |
|---|---:|---:|---:|
| Google KMS software | USD 0,12024 | USD 0,72 | USD 1,32 |
| AWS KMS, HSM gestionado | USD 2,0012 | USD 5,00 | USD 8,00 |
| Google Cloud HSM multi-tenant | USD 5,0012 | USD 8,00 | USD 11,00 |
| Azure Key Vault Premium HSM | USD 10,0012 | USD 13,00 | USD 16,00 |

Con Google Cloud HSM, USD 5,0012 repartidos entre 200.000 tags equivalen a aproximadamente USD 0,000025 por tag y mes, o USD 0,00030 por tag y año. El HSM no amenaza el margen.

## El costo que sí puede crecer

Con el snapshot usado en el informe, 40 transacciones Polygon agrupadas cuestan aproximadamente USD 0,11–0,28. Doscientas mil transacciones individuales, bajo los mismos supuestos, cuestan aproximadamente USD 564–1.410.

El `maxFeePerGas` usado es un techo y no una factura garantizada. El gas real del contrato debe medirse antes de cotizar a clientes.

La política económica correcta es:

1. Guardar eventos individuales fuera de cadena.
2. Anclar una raíz Merkle por lote en IOTA.
3. Agregar un contrato de raíces en Polygon sólo si un cliente exige prueba de lote en ambas cadenas.
4. Mintear o transferir el activo individual en Polygon sólo al reclamar, activar o cambiar de propietario.

## Estado real del repositorio

- El executor ya define un firmante remoto independiente del proveedor y valida la transacción firmada antes de transmitirla.
- Terraform declara dos claves Google `EC_SIGN_SECP256K1_SHA256`.
- Falta el adaptador real que invoque KMS, convierta la firma DER a `r/s`, normalice low-S y derive la paridad de recuperación EVM.
- IOTA ya tiene batching Merkle de hasta 5.000 eventos.
- Polygon no tiene batch mint ni contrato de raíz de evidencia; hoy el contrato realiza un mint por llamada.
- El claim del SDK todavía no dispara un lazy mint asíncrono completo.

Por eso, las 80 firmas son el escenario objetivo de doble anclaje, no el estado productivo actual. El flujo pragmático inmediato es 40 anchors IOTA por fabricación y Polygon sólo para claims o transferencias verificadas.

## Aislamiento por cliente

No se debe crear una clave cloud por tag ni por lote. Para clientes enterprise, dos claves dedicadas por tenant cuestan aproximadamente:

- AWS KMS: USD 2 por cliente y mes.
- Google Cloud HSM: USD 5 por cliente y mes.

Con 100 clientes enterprise serían aproximadamente USD 200 o USD 500 al mes. Se puede incluir custodia HSM dedicada como prestación enterprise de USD 10–25 mensuales por cliente. Los clientes pequeños pueden compartir un publisher de plataforma con aislamiento lógico, mientras los contratos exigentes reciben claves dedicadas.

## Opciones descartadas

- Vercel variables, Cloudflare secrets, R2 y Blob: sirven para secretos de test o integración, pero el proceso puede obtener la clave en claro. No son HSM ni custodia no exportable.
- Vault Community Transit: no ofrece `secp256k1` de forma nativa. Guardar la clave en Vault KV y firmar en la aplicación vuelve a exponerla.
- Disco extraíble offline: puede ser parte de una recuperación en frío, pero no es un firmante online disponible, auditable y de alta disponibilidad.
- HSM dedicado single-tenant: Google ronda USD 3.500/mes y no tiene sentido para este volumen.

No se debe vender ninguna de estas alternativas como “HSM emulado”. Eso sería técnicamente falso y crearía riesgo contractual.

## Próximo orden de implementación

1. Elegir el cloud del servicio firmante; Google Cloud HSM si se mantiene el plan actual, AWS KMS si se decide una base AWS antes de construir el adaptador.
2. Implementar el adaptador KMS real y probar una transacción EVM completa.
3. Agregar nonce manager distribuido y rotación explícita de publishers.
4. Convertir el mint Polygon en outbox idempotente y asíncrono.
5. Automatizar el scheduler de roots por lote.
6. Configurar alertas de USD 10, USD 25 y USD 50 y medir costo por tenant.

## Fuentes oficiales

- [Google Cloud KMS pricing](https://cloud.google.com/kms/pricing)
- [Google Cloud KMS algorithms](https://docs.cloud.google.com/kms/docs/algorithms)
- [Google Cloud KMS protection levels](https://docs.cloud.google.com/kms/docs/protection-levels)
- [Google Cloud Free Trial](https://docs.cloud.google.com/free/docs/free-cloud-features)
- [AWS KMS pricing](https://aws.amazon.com/kms/pricing/)
- [AWS KMS asymmetric key specifications](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html)
- [AWS KMS security](https://aws.amazon.com/kms/features/)
- [Azure Key Vault pricing](https://azure.microsoft.com/en-us/pricing/details/key-vault/)
- [HashiCorp Vault Transit](https://developer.hashicorp.com/vault/docs/secrets/transit)
- [HCP Vault Dedicated Starter end of life](https://support.hashicorp.com/hc/en-us/articles/36950769223187-HCP-Vault-Dedicated-Starter-SKU-End-Of-Life)
- [Polygon Gas Station](https://docs.polygon.technology/tools/gas/polygon-gas-station/)

El informe HTML fue validado a 1.440 px y 390 px, con 17 bloques, un gráfico, dos indicadores, tres tablas y apertura verificable del linaje de las cifras.
