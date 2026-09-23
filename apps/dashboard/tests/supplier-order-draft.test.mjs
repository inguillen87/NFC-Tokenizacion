import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { SUPPLIER_CONSTRUCTIONS, emptySupplierOrderDraft, applySupplierConstruction, validateSupplierOrderDraft, supplierOrderErrorMessage, SUPPLIER_ORDER_MAX_QUANTITY, SUPPLIER_ORDER_MAX_SUB_BATCHES } from '../src/lib/supplier-order-draft.ts';

const draft = () => ({ ...applySupplierConstruction(emptySupplierOrderDraft(), 'pet_wet'), tenant_slug: 'qa-only', order_name: 'Construcción sintética', base_batch_id: 'QA-ONLY', total_quantity: '100', notes: 'Conservar esta nota' });
const valid = (value = draft(), purpose = 'trial_integration') => validateSupplierOrderDraft(value, purpose);

test('applying any construction preserves the operator work and leaves purpose outside the template', () => {
  const before = Object.freeze({ ...draft(), customer_slug: 'qa-customer', sub_batch_size: '50', pack_purpose: 'production' });
  for (const profile of SUPPLIER_CONSTRUCTIONS) {
    const after = applySupplierConstruction(before, profile.id);
    for (const key of ['tenant_slug', 'customer_slug', 'order_name', 'base_batch_id', 'total_quantity', 'sub_batch_size', 'notes', 'pack_purpose']) assert.equal(after[key], before[key], `${profile.id}: ${key}`);
    assert.equal(after.chip_model, profile.chipModel);
    assert.equal(after.carrier_profile_code, profile.carrierProfileCode);
    assert.equal(after.material_type, profile.materialType);
  }
  assert.equal(applySupplierConstruction(before, 'unknown'), before);
});

test('the seven constructions keep DNA, TT and logistics physically separate without inventing the UHF chip', () => {
  assert.equal(SUPPLIER_CONSTRUCTIONS.length, 7);
  assert.equal(new Set(SUPPLIER_CONSTRUCTIONS.map(x => x.materialType)).size, 7);
  for (const profile of SUPPLIER_CONSTRUCTIONS) {
    const d = applySupplierConstruction(draft(), profile.id);
    if (profile.carrierProfileCode === 'uhf_rfid') {
      assert.equal(d.chip_model, '');
      assert.equal(valid(d).ok, false);
      const result = valid({ ...d, chip_model: 'supplier-confirmed-model' });
      assert.equal(result.ok, true); assert.equal(result.secureSun, false);
      assert.equal(valid({ ...d, chip_model: 'NTAG213' }).ok, false);
    } else {
      const result = valid(d);
      assert.equal(result.ok, true); assert.equal(result.secureSun, true);
      assert.equal(result.payload.chip_model, profile.chipModel);
    }
  }
});

test('purpose remains an explicit exact decision for every construction and quantity', () => {
  for (const purpose of ['', 'trial', 'Production', ' production ', null, undefined, true]) assert.equal(validateSupplierOrderDraft(draft(), purpose).ok, false);
  for (const purpose of ['trial_integration', 'production']) assert.equal(valid(draft(), purpose).payload.pack_purpose, purpose);
});

test('one homogeneous lot is the default and only explicit splitting changes the count', () => {
  const one = valid(); assert.equal(one.subBatchCount, 1); assert.equal(one.payload.sub_batch_size, 100);
  const split = valid({ ...draft(), sub_batch_size: '30' }); assert.equal(split.subBatchCount, 4); assert.equal(split.payload.sub_batch_size, 30);
  assert.equal(valid({ ...draft(), total_quantity: '52', sub_batch_size: '1' }).subBatchCount, 52);
  assert.equal(valid({ ...draft(), total_quantity: '53', sub_batch_size: '1' }).ok, false);
});

test('quantities reject truncation, exponents, unsafe values and impossible splits', () => {
  for (const quantity of ['0', '-1', '1.5', '1e2', 'Infinity', 'NaN', '100000001', '', ' ']) assert.equal(valid({ ...draft(), total_quantity: quantity }).ok, false, quantity);
  for (const size of ['0', '-1', '1.5', '1e2', '101', 'NaN']) assert.equal(valid({ ...draft(), sub_batch_size: size }).ok, false, size);
  assert.equal(valid({ ...draft(), total_quantity: '100000000' }).ok, true);
});

test('construction validation rejects mismatched security profile and empty identities', () => {
  for (const changes of [{ tenant_slug: '' }, { order_name: ' ' }, { chip_model: '' }, { carrier_profile_code: 'unknown' }, { chip_model: 'NTAG424_DNA_TT' }, { carrier_profile_code: 'ntag424_dna_tt' }, { carrier_profile_code: 'uhf_rfid' }]) assert.equal(valid({ ...draft(), ...changes }).ok, false);
  for (const bid of ['lower-case', 'INTERNAL DEMO', '-QA', 'QA-', 'QA--ONE', 'QA/ONE', 'é']) assert.equal(valid({ ...draft(), base_batch_id: bid }).ok, false, bid);
  for (const carrier of ['ntag213', 'ntag215', 'ntag216']) {
    for (const chip of ['UCODE_9', 'NTAG424_DNA', 'NTAG424_DNA_TT', ...['NTAG213', 'NTAG215', 'NTAG216'].filter(x => x.toLowerCase() !== carrier)]) assert.equal(valid({ ...draft(), carrier_profile_code: carrier, chip_model: chip }).ok, false);
    assert.equal(valid({ ...draft(), carrier_profile_code: carrier, chip_model: carrier.toUpperCase() }).secureSun, false);
  }
});

test('payload is allowlisted, defaults the customer to the verified company and carries no invented acceptance', () => {
  const result = valid({ ...draft(), tenant_slug: ' QA-ONLY ', key: 'never-copy', approved: true, sample_size: 3, physical_ceremony_verified: true });
  assert.equal(result.ok, true);
  assert.equal(result.payload.tenant_slug, 'qa-only'); assert.equal(result.payload.customer_slug, 'qa-only');
  assert.deepEqual(Object.keys(result.payload).sort(), ['tenant_slug', 'customer_slug', 'order_name', 'base_batch_id', 'total_quantity', 'sub_batch_size', 'chip_model', 'carrier_profile_code', 'material_type', 'notes', 'pack_purpose'].sort());
  assert.equal(valid({ ...draft(), notes: 'á'.repeat(32768) }).ok, false);
});

test('technical and untrusted server messages are not reflected to the operator', () => {
  assert.match(supplierOrderErrorMessage('batch_bid_already_exists'), /Revisá los pedidos existentes/);
  for (const reason of ['<script>unsafe</script>', 'DATABASE_URL=secret', '__proto__', 'constructor', null, {}]) {
    const message = supplierOrderErrorMessage(reason); assert.equal(typeof message, 'string'); assert.doesNotMatch(message, /secret|<script>|DATABASE_URL/);
  }
});

test('client plan boundaries agree with the existing server contract', async () => {
  const source = await readFile(new URL('../../api/src/app/admin/supplier-orders/route.ts', import.meta.url), 'utf8');
  const limit = name => Number(source.match(new RegExp(`const ${name} = ([\\d_]+);`))[1].replaceAll('_', ''));
  assert.equal(SUPPLIER_ORDER_MAX_QUANTITY, limit('MAX_SUPPLIER_ORDER_QUANTITY'));
  assert.equal(SUPPLIER_ORDER_MAX_SUB_BATCHES, limit('MAX_SUPPLIER_SUB_BATCHES'));
});
