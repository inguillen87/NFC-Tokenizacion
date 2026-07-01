import { sql } from "../src/lib/db.js";
import { createShipment, processSealScan } from "../src/lib/secure-delivery.js";
import { buildSupplierSubBatchPlan, generateSupplierBatchKeys } from "../src/lib/supplier-ops.js";
import { hashEvidencePayload } from "../src/lib/proof-layer.js";

async function runSmokeTests() {
  console.log("🚀 Iniciando Smoke Tests Empresariales...");
  
  // 1. Setup inicial
  console.log("🔍 Obteniendo Tenant de prueba...");
  const tenants = await sql`SELECT id FROM tenants LIMIT 1`;
  if (!tenants.length) {
    console.log("❌ No hay tenants en la DB para probar.");
    process.exit(1);
  }
  const tenantId = tenants[0].id;
  console.log(`✅ Tenant ID obtenido: ${tenantId}`);

  // 2. Módulo de Secure Delivery (Logística)
  console.log("\n📦 --- TEST: SECURE DELIVERY ---");
  try {
    const shipment = await createShipment({
      tenantId,
      trackingNumber: "TRK-SMOKE-123",
      originAddress: "Bodega Balmaceda Central",
      destinationAddress: "Cliente Premium",
    });
    console.log("✅ Envío creado exitosamente:", shipment.shipmentCode);

    // Insertar un sello ficticio para poder probar
    const fakeSealUid = "04123456789ABC";
    const insertedSeal = await sql`
      INSERT INTO seal_inventory (tenant_id, uid_hex, status) 
      VALUES (${tenantId}, ${fakeSealUid}, 'UNASSIGNED') 
      RETURNING id
    `;
    const sealId = insertedSeal[0].id;
    console.log("✅ Sello generado en inventario");

    const applyResult = await processSealScan({
      uidHex: fakeSealUid,
      tenantId,
      ttRaw: "4343", // Cerrado
      context: "APPLY",
      location: "Warehouse A"
    });
    console.log("✅ Operador aplicó el sello (Estado esperado SEALED):", applyResult.newStatus);
    if (applyResult.newStatus !== "SEALED") throw new Error("Fallo al sellar");

    const handoffResult = await processSealScan({
      uidHex: fakeSealUid,
      tenantId,
      ttRaw: "4343", // Cerrado
      context: "HANDOFF",
      scannedBy: "Courier Juan"
    });
    console.log("✅ Hand-off al Courier exitoso (Estado esperado IN_TRANSIT):", handoffResult.newStatus);
    if (handoffResult.newStatus !== "IN_TRANSIT") throw new Error("Fallo hand-off");

    const verifyResult = await processSealScan({
      uidHex: fakeSealUid,
      tenantId,
      ttRaw: "4F4F", // Abierto (Simulando que el cliente lo abrió)
      context: "VERIFY"
    });
    console.log("✅ Cliente verificó entrega abierta (Estado esperado DELIVERED_OPENED):", verifyResult.newStatus);
    if (verifyResult.newStatus !== "DELIVERED_OPENED") throw new Error("Fallo verificación final");

  } catch (error) {
    console.error("❌ Falló test Secure Delivery:", error);
    process.exit(1);
  }

  // 3. Módulo Supplier Ops (Fabricantes)
  console.log("\n🏭 --- TEST: SUPPLIER OPERATIONS ---");
  try {
    const plan = buildSupplierSubBatchPlan({
      customerSlug: "bodega-balmaceda",
      orderName: "Lote Exportación 2026",
      baseBatchId: "EXP-2026",
      totalQuantity: 25000,
      subBatchSize: 10000,
    });
    console.log(`✅ Plan de fabricación generado. Total Sub-Lotes esperados (3): ${plan.length}`);
    if (plan.length !== 3) throw new Error("Cálculo de sub-lotes incorrecto");
    console.log("Muestra de Sub-Lotes planificados:", plan.map(p => ({ bid: p.bid, qtty: p.expectedQuantity })));

    const keys = generateSupplierBatchKeys();
    console.log("✅ Claves KMS de fabricación generadas de forma segura.");
    console.log("Fingerprint SHA256 (Público):", keys.fingerprint);
    if (!keys.kMetaHex || !keys.kFileHex || !keys.fingerprint) throw new Error("Fallo generación de claves");

  } catch (error) {
    console.error("❌ Falló test Supplier Ops:", error);
    process.exit(1);
  }

  // 4. Módulo Trust Layer (IOTA Anchors)
  console.log("\n🔗 --- TEST: TRUST LAYER ANCHORING ---");
  try {
    const hash = hashEvidencePayload({
      tenantId,
      resourceType: "shipment",
      resourceId: "SHP-1234",
      eventType: "delivery_verified",
      payload: { ttRaw: "4F4F", timestamp: Date.now() }
    });
    console.log("✅ Hash de evidencia logístico generado:", hash);
    if (!hash || hash.length !== 64) throw new Error("Fallo hashing de evidencia");

  } catch (error) {
    console.error("❌ Falló test Trust Layer:", error);
    process.exit(1);
  }

  console.log("\n🎉 TODOS LOS TESTS EMPRESARIALES PASARON CORRECTAMENTE 🎉");
  process.exit(0);
}

runSmokeTests().catch(console.error);
