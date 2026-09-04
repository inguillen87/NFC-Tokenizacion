import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const crmSource = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const encodeSource = await readFile(new URL("../src/app/(app)/demo-lab/encode/page.tsx", import.meta.url), "utf8");

test("tenant CRM sessions stay locked to their server-provided scope", () => {
  assert.match(crmSource, /const tenantSession = mode === "tenant"/);
  assert.match(crmSource, /const lockedTenantScope = String\(tenantScope \|\| ""\)\.trim\(\)\.toLowerCase\(\)/);
  assert.match(crmSource, /useState\(\(\) => tenantSession \? lockedTenantScope : "all"\)/);
  assert.match(crmSource, /if \(tenantSession\) setSelectedTenant\(lockedTenantScope\)/);
  assert.match(crmSource, /const effectiveSelectedTenant = tenantSession \? lockedTenantScope : selectedTenant/);
  assert.match(crmSource, /tenantSession \? \([\s\S]*Tenant no disponible[\s\S]*\) : \([\s\S]*Todos los tenants/);
});

test("CRM high-impact and data-dependent actions fail closed", () => {
  assert.match(crmSource, /dashboardHighImpactPermissionMatches\([\s\S]*"events\.read_sensitive"[\s\S]*account\.deniedPermissions/);
  assert.match(crmSource, /\.\.\.\(canReadSensitiveEvents \? \[\{[\s\S]*label: "Riesgos"[\s\S]*\}\] : \[\]\)/);
  assert.match(crmSource, /if \(commercialActivityEvents\.length === 0\) return/);
  assert.match(crmSource, /disabled=\{valuesUnavailable \|\| commercialActivityEvents\.length === 0\}/);
  assert.match(crmSource, /No hay actividad con producto reconocido, actor asociado, tipo elegible y consentimiento por canal para exportar/);
  assert.match(crmSource, /const streetViewTarget = useMemo\([\s\S]*strictCoordinatePair\(event\.lat, event\.lng\)/);
  assert.match(crmSource, /disabled=\{valuesUnavailable \|\| !streetViewTarget\}/);
  assert.match(crmSource, /No hay coordenadas reportadas utilizables en la ventana actual/);
});

test("Encode Station does not present decorative hardware controls as operative", () => {
  assert.match(encodeSource, /Vista previa · sin acceso al hardware/);
  assert.match(encodeSource, /no es un payload firmado ni confirma que una etiqueta haya sido escrita o leída/);
  assert.equal((encodeSource.match(/disabled aria-describedby="encode-hardware-status"/g) ?? []).length, 3);
  assert.match(encodeSource, /Write test · no disponible/);
  assert.match(encodeSource, /Verify readback · requiere lector/);
  assert.match(encodeSource, /Advanced makeReadOnly · bloqueado/);
  assert.doesNotMatch(encodeSource, /onClick=\{\(\) => setReadOnlyConfirm/);
});
