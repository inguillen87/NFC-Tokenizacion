# Estado de S5 — SDK e integración

Objetivo del plan: incorporar terceros sin soporte constante.

## Cerrado en código y aceptación local

- SDK privado existente empaquetado, instalable fuera del monorepo.
- Kit con manifiesto de integridad y descarga privada autorizada en el dashboard.
- Comprobación de catálogo con permisos mínimos.
- Adaptador de recepción CSV: validar, planificar, enviar y reconciliar.
- Receptor webhook v2 con persistencia y deduplicación local transaccional.
- Perfil de credenciales ERP CSV que no habilita verificación NFC ni activación.

## Falta para cerrar todo S5

Un ERP, POS o WMS elegido por el primer cliente, integración a su circuito real,
identificadores estables del sistema origen, endpoint HTTPS de cliente, prueba
operativa con autorización y aceptación de responsables. El CSV es un adaptador
genérico de intercambio, no un conector nativo certificado.

## Después

S6: retiros/cuarentenas y evidencia comercial del piloto sobre datos reales.
S7: consentimiento, aprobación, presupuesto y resultados de campañas.
Mantener S0–S4 y el costo controlado; no reescribir SDK ni verificador NFC.
