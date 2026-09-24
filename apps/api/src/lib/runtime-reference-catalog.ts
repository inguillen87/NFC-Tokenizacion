import { sql } from './db';

export function assertCatalogCodes(rows: Array<Record<string, unknown>>, expected: readonly string[], catalog: string) {
  const codes = rows.map(row => row.code);
  if (codes.some(code => typeof code !== 'string') || new Set(codes).size !== codes.length || expected.some(code => !codes.includes(code))) {
    throw new Error('runtime_reference_catalog_incomplete:' + catalog);
  }
}

/** An installed migration-owned catalog is read, never re-seeded by requests. */
export async function requireRuntimeCarrierCatalog(codes: readonly string[]) {
  const rows = await sql`SELECT code FROM public.carrier_profiles WHERE code = ANY(${[...codes]}::text[])`;
  assertCatalogCodes(rows, codes, 'carrier_profiles');
}

export async function requireRuntimeLedgerCatalog() {
  const codes = ['none', 'polygon', 'iota'];
  const rows = await sql`SELECT code FROM public.ledger_providers WHERE code = ANY(${codes}::text[])`;
  assertCatalogCodes(rows, codes, 'ledger_providers');
}
