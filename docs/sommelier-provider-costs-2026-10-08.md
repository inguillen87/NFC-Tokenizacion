# NexID: costo del sommelier contextual

Investigación del 8 de octubre de 2026. Recomendaría evaluar **Hugging Face con `openai/gpt-oss-20b:deepinfra`**, manteniendo **OpenAI `gpt-6-luna` como alternativa**. Para el volumen definido abajo, sus tarifas equivalen a **USD 28,40 y USD 98 mensuales**, respectivamente. La calidad en español, la fidelidad a las fichas de cada marca y la latencia siguen sin medir. Este informe no habilita ni publica una integración.

## Escenario y cálculo reproducible

**100.000 conversaciones mensuales × 4 turnos = 400.000 solicitudes.** Cada solicitud promedia 1.200 tokens de entrada y 250 de salida: **480 millones de entrada y 100 millones de salida**. Conversaciones no significa usuarios únicos. Los 1.200 tokens incluyen instrucciones, ficha del producto e historial enviado en cada turno.

`Costo mensual USD = 480 × precio entrada por millón + 100 × precio salida por millón`

Se comparan tarifas normales sin cache ni Batch. Los 250 tokens deben representar toda la salida facturable: un modelo con razonamiento puede facturar tokens adicionales si sólo contamos el texto visible. No se incluyen reintentos, herramientas, búsqueda, embeddings, infraestructura NexID, impuestos ni conversión de moneda.

| Ruta y modelo | Entrada USD/M | Salida USD/M | Cálculo USD | Total mensual USD | Fuente |
|---|---:|---:|---:|---:|---|
| HF · `openai/gpt-oss-20b:deepinfra` | 0,03 | 0,14 | 14,40 + 14,00 | **28,40** | [Catálogo HF](https://router.huggingface.co/v1/models) |
| HF · `openai/gpt-oss-20b:novita` | 0,04 | 0,15 | 19,20 + 15,00 | **34,20** | [Catálogo HF](https://router.huggingface.co/v1/models) |
| HF · `openai/gpt-oss-20b:groq` | 0,10 | 0,50 | 48,00 + 50,00 | **98,00** | [Catálogo HF](https://router.huggingface.co/v1/models) |
| HF · Llama 3.1 8B · DeepInfra o Novita | 0,02 | 0,05 | 9,60 + 5,00 | **14,60** | [Catálogo HF](https://router.huggingface.co/v1/models) |
| HF · DeepSeek V4.1 Flash · DeepInfra | 0,20 | 0,60 | 96,00 + 60,00 | **156,00** | [Catálogo HF](https://router.huggingface.co/v1/models) |
| Groq directo · `openai/gpt-oss-20b` | 0,075 | 0,30 | 36,00 + 30,00 | **66,00** | [Modelos Groq](https://console.groq.com/docs/models) |
| OpenAI · `gpt-6-luna` · Standard | 0,10 | 0,50 | 48,00 + 50,00 | **98,00** | [Modelo y tarifas](https://developers.openai.com/api/docs/models/gpt-6-luna) |
| DeepSeek directo · `deepseek-flash` · fuera de pico | 0,15 | 0,60 | 72,00 + 60,00 | **132,00** | [Tarifas DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/) |
| DeepSeek directo · `deepseek-flash` · pico | 0,30 | 1,20 | 144,00 + 120,00 | **264,00** | [Tarifas DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/) |

El [catálogo sanitizado observado](C:/Temp/nexid-wine-experience-20261007/artifacts/sommelier-20261008/research/hf-catalog-selected.json) proviene del GET público oficial de HF a las **2026-10-08T11:54:26.5383520Z**; SHA256 `2a43871262c01e25d6247b036f43a73ced7078208a131f22e36c730dc3ae4e01`. Las rutas GPT OSS 20B indicadas declaran soporte de salida estructurada; las dos rutas Llama de USD 14,60 no lo declaran. Esa diferencia requiere evaluación y validación propia. El catálogo es una observación, no una tarifa garantizada a futuro ni una prueba de inferencia.

El mismo modelo tiene precios distintos entre **Groq directo y el router HF**. HF declara ausencia de recargo, pero no corresponde sustituir el precio observado del router por la tarifa pública de otro canal. DeepSeek aplica pico de lunes a viernes, 01–04 y 06–10 UTC, excepto feriados chinos; el gasto real dependerá del horario de las solicitudes. [Facturación HF](https://huggingface.co/docs/inference-providers/pricing), [calendario DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/).

## Qué es gratis y qué se paga

**HF Free actualmente no incluye créditos mensuales de Inference Providers.** PRO cuesta USD 9/mes e incluye USD 2 de créditos de cómputo; Team/Enterprise incluye USD 2 por asiento compartidos. Se puede comprar crédito y pagar consumo sin contratar PRO. Con HF como intermediario factura HF; con clave propia del proveedor factura ese proveedor y no se aplican los créditos HF. [Créditos y facturación](https://huggingface.co/docs/inference-providers/pricing), [precio PRO](https://huggingface.co/pricing).

Contratar PRO solamente para descontar USD 2 elevaría el escenario DeepInfra a **9 + (28,40 − 2) = USD 35,40**. Si ya existe PRO y los USD 2 están libres y son aplicables, el consumo adicional sería USD 26,40, además de la suscripción existente. No se inspeccionaron saldo ni plan de la cuenta. Los modelos de pesos abiertos tampoco eliminan el costo de ejecutar inferencia; un endpoint dedicado tiene su propia tarifa de infraestructura. [Cómputo HF](https://huggingface.co/pricing).

## Datos y operación

| Servicio | Condiciones oficiales relevantes |
|---|---|
| HF + DeepInfra | HF no conserva cuerpos de solicitud/respuesta; mantiene registros de depuración sin datos del usuario hasta 30 días y remite a la política del proveedor. DeepInfra declara entradas/salidas de inferencia ordinaria sólo en memoria y sin entrenamiento; Bulk tiene excepciones de persistencia. Su política contempla transferencias a EE. UU. Esto no demuestra una región de ejecución fija para nuestra ruta HF. [HF](https://huggingface.co/docs/inference-providers/security), [inferencia DeepInfra](https://docs.deepinfra.com/account/data-privacy), [política](https://deepinfra.com/privacy). |
| OpenAI | API sin entrenamiento salvo consentimiento; registros de abuso hasta 30 días por defecto, con excepciones. ZDR requiere aprobación. `store:false` no elimina esos registros. La residencia UE de Luna requiere elegibilidad/configuración y tiene un recargo regional del 10%; no está incluida en la tabla. [Datos](https://developers.openai.com/api/docs/guides/your-data), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna). |
| DeepSeek directo | Los términos API se rigen por China continental, con tribunal en la jurisdicción de la sede de Hangzhou. El desarrollador debe informar y gestionar los datos de sus usuarios. No se verificó un compromiso API equivalente a ZDR; no se extrapola la política del chatbot a nuestra aplicación. [Términos API](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html). |
| Groq directo | Inferencia sin retención por defecto, con excepciones de fiabilidad/abuso hasta 30 días; permite activar ZDR. Los datos retenidos se alojan en GCP en EE. UU.; conserva metadatos de uso. No se inspeccionó la configuración de nuestra cuenta. [Datos Groq](https://console.groq.com/docs/your-data). |

El promedio del escenario es **9,26 solicitudes/minuto** en un mes de 30 días; no dimensiona los picos. Groq publica 1.000 RPM/250.000 TPM para este modelo en Developer; Luna publica 5.000 RPM/2 millones TPM en Build; DeepSeek Flash, 2.500 solicitudes concurrentes por cuenta. Son límites publicados, no cuotas verificadas para NexID ni garantías de disponibilidad. HF depende también del proveedor elegido. [Groq](https://console.groq.com/docs/models), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/).

## Integración propuesta

Usaría un adaptador dentro de la API NexID, con credenciales únicamente en servidor: HF Chat Completions mediante `https://router.huggingface.co/v1`, proveedor **fijo `:deepinfra`**, y OpenAI Luna como alternativa controlada. El modelo abierto llamado `openai/gpt-oss-20b` no utiliza la clave de OpenAI cuando se ejecuta en HF: utiliza el token HF. El router selecciona el proveedor más rápido por defecto; fijarlo evita cambiar silenciosamente costo y tratamiento de datos. Groq también admite SDK OpenAI, con su propia clave y endpoint. Compatibilidad no significa equivalencia de todos los parámetros. [HF](https://huggingface.co/docs/inference-providers/index), [Groq](https://console.groq.com/docs/openai).

Antes de elegir, probaría respuestas breves en español/portugués/inglés, maridajes, preguntas fuera de ficha y resistencia a instrucciones maliciosas. El contexto debe resolver producto y tenant en servidor, usar información aprobada por la marca y permitir sólo lectura: sin firmas NFC, GPS, contactos, datos CRM ni herramientas de escritura. Se necesitan presupuesto por tenant, límites de entrada/salida, plazo máximo, cancelación y reintentos acotados. Para Luna conviene evaluar razonamiento `none`; la documentación exige ese ajuste para function calling en Chat Completions. [Modelo Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).

**Estado:** investigación de fuentes oficiales y cálculo aritmético. No se enviaron conversaciones a modelos, no se consultaron secretos ni balances y no se modificaron API, WEB, dashboard o configuración. No hay ahorro, rendimiento, calidad ni aceptación de producción medidos por este informe.
