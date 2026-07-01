# Plan de Implementación Front-End: Enterprise, Logistics & Trust Layers

Este plan detalla el desarrollo de la "cara visible" (Front-end) de toda la lógica empresarial y criptográfica que ya construimos en el backend durante el sprint anterior. 

## User Review Required
> [!IMPORTANT]
> Revisa este plan de acción. Estamos por construir interfaces en 3 frentes distintos (Dashboard de Admin, Mobile App para el consumidor final y Landing Page pública). Al aprobar este plan, los agentes comenzarán a escribir y desplegar todo el código React/Next.js.

## Open Questions
> [!NOTE]
> ¿Prefieres que arranquemos primero por el Dashboard B2B (para que puedas mostrarle a un cliente corporativo cómo gestiona sus envíos) o prefieres empezar por el Mobile PWA (para mostrarle a un inversor cómo el usuario final escanea y ve el paquete sellado)?
> El plan los incluye a ambos, pero el orden es flexible.

## Proposed Changes

---

### Phase 1: Dashboard B2B (Admin Panel)

Construiremos las pantallas para que los administradores, operadores logísticos (3PL) y empresas (como Syngenta o Correos Privados) puedan operar la plataforma.

#### [NEW] `apps/dashboard/src/app/(app)/logistics/page.tsx`
Pantalla principal para Secure Delivery. Mostrará:
- Métricas de envíos seguros.
- Pool de etiquetas (sellos) sin asignar (`UNASSIGNED`).
- Envíos en tránsito y entregados.

#### [NEW] `apps/dashboard/src/app/(app)/logistics/shipments/page.tsx`
Tabla maestra de envíos (`shipments`), donde el operario de depósito puede escanear una etiqueta virgen, vincularla a un número de orden y cambiar el estado a `ASSIGNED` y luego a `SEALED`.

#### [MODIFY] `apps/dashboard/src/app/(app)/proof/page.tsx`
Mejoraremos la sección de la Capa de Pruebas (Trust Layer) para:
- Mostrar gráficamente la distinción entre **Polygon (Propiedad)** e **IOTA (Evidencia/Notarización)**.
- Mostrar la lista de hashes (Merkle Roots) anclados para el `manifest_hash`, `qa_passed`, y `logistics_events`.
- Incluir la alerta de que la red es de prueba (Testnet) y no debe usarse para pruebas legales finales aún.

---

### Phase 2: Mobile PWA Scanner (Consumidor y Operador)

Construiremos la interfaz súper premium (Mobile-First) para el destinatario final y el courier.

#### [MODIFY] `apps/web/src/components/ScannerResult/ProductPassport.tsx` (o equivalente)
Modificaremos el componente principal del Digital Product Passport (DPP) para soportar los nuevos estados criptográficos NTAG 424 DNA TagTamper, mostrando:
- **Estado `DELIVERED_CLOSED`**: UI color verde premium, mensaje "Tu paquete llegó sellado y es auténtico".
- **Estado `DELIVERED_OPENED`**: UI de advertencia color rojo/naranja, mensaje "El sello aparece abierto. Crear reclamo".
- **Estado Offline**: Mensaje "Verificación pendiente: Necesitamos conexión para confirmar autenticidad criptográfica" para no dar falsos positivos.

#### [NEW] `apps/web/src/components/ScannerResult/CourierHandoff.tsx`
Una pantalla oculta o de uso específico para el Courier, permitiéndole escanear el paquete y cambiar el estado a `IN_TRANSIT`.

---

### Phase 3: Marketing B2B (Landing, Docs & DemoLab)

Vamos a pulir la imagen comercial de nexID para vender esto como una solución empresarial.

#### [MODIFY] `apps/web/src/app/(public)/landing/page.tsx`
Agregaremos la sección **"nexID Secure Delivery"**.
- Pitch comercial premium (enfocado en IT, pharma, lujo).
- Cuadro comparativo entre Tracking Básico (QR/GS1) vs Secure Authenticity (NFC 424) vs Tamper Evidence (TagTamper).

#### [MODIFY] `apps/web/src/app/(public)/demo-lab/page.tsx`
Se agregarán las nuevas demostraciones corporativas:
- **Polygon Ownership Demo**
- **IOTA Proof Layer Demo** (Evidencia de manufactura y envíos).
- **Offline Field Scan Demo**.

## Verification Plan

### Automated Tests
- Correr el linter y compilador en ambas apps (`npm -w dashboard run build`, `npm -w web run build`).

### Manual Verification
- Ingresaremos al Dashboard y simularemos la asignación de un sello de envío (`SEALED`).
- Escanearemos virtualmente (vía script o endpoint) un tag en estado cerrado (`ttRaw=4343`) y verificaremos que la Mobile PWA muestre la interfaz verde de seguridad intacta.
- Escanearemos virtualmente un tag en estado abierto (`ttRaw=4F4F`) y verificaremos la interfaz de advertencia y reclamo.
