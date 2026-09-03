#!/usr/bin/env node
import pg from "pg";

import {
  executeTenantAdminCredentialChange,
  readTenantAdminCredentialConfig,
  TenantAdminCredentialError,
} from "./lib/tenant-admin-credentials.mjs";

let client;
try {
  const config = readTenantAdminCredentialConfig();
  client = new pg.Client({
    connectionString: config.databaseUrl,
    enableChannelBinding: true,
    connectionTimeoutMillis: 5_000,
    query_timeout: 35_000,
    application_name: "nexid-tenant-admin-credential-ops-v1",
  });
  await client.connect();
  const result = await executeTenantAdminCredentialChange(client, config);
  console.log(JSON.stringify(result));
} catch (error) {
  const code = error instanceof TenantAdminCredentialError
    ? error.code
    : "tenant_admin_credential_operation_failed";
  console.error(JSON.stringify({ ok: false, code }));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => undefined);
}
