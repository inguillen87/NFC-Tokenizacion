import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Socket, isIPv4 } from "node:net";
import { captureOwnershipMutation, ownershipFixture } from "./ownership-current-state-fixture.mjs";

const OWN_SCHEMA = /^ownership_current_qa_[0-9a-f]{32}$/;
const QA_DATABASE = /^nexid_e2e(?:_[a-z0-9][a-z0-9_-]{0,48})?$/;
const LOCAL_DOCKER = "unix:///var/run/docker.sock";
const GITHUB_POSTGRES_IMAGES = Object.freeze({
  "16.4": "postgres:16.4-alpine@sha256:5660c2cbfea50c7a9127d17dc4e48543eedd3d7a41a595a2dfa572471e37e64c",
  "18.4": "postgres:18.4-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15",
});
const issuedDockerAttestations = new WeakSet();
const loopbackPeer = value => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(value);
function privateIpv4(value) {
  if (!isIPv4(value)) return false;
  const [a,b] = value.split(".").map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Only the enterprise entrypoint issues this descriptor after its existing
// test-env/URL/empty-database/version checks. Docker output stays in memory:
// no container Env, credentials or raw inspect payload enters the receipt.
export function attestGithubPostgresDocker({ config, env, platform, workflowText, runDocker }) {
  if (env?.GITHUB_ACTIONS !== "true") return null;
  assert.equal(platform, "linux", "Docker PostgreSQL attestation requires the Linux GitHub runner");
  assert.equal(env.NODE_ENV, "test"); assert.equal(env.VERCEL_ENV, "test");
  const url = new URL(config.databaseUrl);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const port = Number(url.port || 5432);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol) && !url.search && !url.hash, "Unaltered QA PostgreSQL URL required");
  assert.ok(["127.0.0.1", "::1"].includes(host) && port === 5432, "Literal loopback CI PostgreSQL endpoint required");
  assert.equal(url.username, "nexid_e2e"); assert.equal(config.databaseRole, "nexid_e2e");
  assert.match(config.databaseName, QA_DATABASE);
  assert.equal(decodeURIComponent(url.pathname.slice(1)), config.databaseName);
  const image = GITHUB_POSTGRES_IMAGES[config.expectedPostgresVersion];
  assert.ok(image, "Only the exact PostgreSQL 16.4/18.4 CI images may use Docker attestation");
  assert.equal(config.expectedServerVersionNumber, config.expectedPostgresVersion === "16.4" ? 160004 : 180004);
  const matrix = [...String(workflowText).matchAll(/- version: "([^"]+)"\s+image: "([^"]+)"/g)];
  assert.equal(matrix.length, 2, "Expected immutable two-version PostgreSQL CI matrix");
  for (const [version,pinned] of Object.entries(GITHUB_POSTGRES_IMAGES)) {
    assert.equal(matrix.filter(row => row[1] === version && row[2] === pinned).length, 1, "CI image pin must equal the checked-in workflow");
  }
  assert.equal(typeof runDocker, "function", "Explicit local Docker reader required");
  const ids = String(runDocker(["--host", LOCAL_DOCKER, "ps", "--filter", `publish=${port}`, "--filter", "status=running", "--format", "{{.ID}}"])).trim().split(/\s+/).filter(Boolean);
  assert.equal(ids.length, 1, "Exactly one local running container must publish the QA PostgreSQL port");
  assert.match(ids[0], /^[a-f0-9]{12,64}$/);
  let inspected;
  try { inspected = JSON.parse(runDocker(["--host", LOCAL_DOCKER, "inspect", ids[0]])); }
  catch { throw new Error("Local Docker PostgreSQL inspection JSON rejected"); }
  assert.ok(Array.isArray(inspected) && inspected.length === 1, "One local container inspection required");
  const container = inspected[0];
  assert.match(container?.Id || "", /^[a-f0-9]{64}$/);
  assert.ok(container.Id.startsWith(ids[0]));
  assert.equal(container.State?.Running, true, "QA PostgreSQL container must be running");
  assert.equal(container.Config?.Image, image, "QA container must use the exact immutable CI image");
  const bindings = container.NetworkSettings?.Ports?.["5432/tcp"];
  assert.ok(Array.isArray(bindings) && bindings.length > 0 && bindings.some(row => ["0.0.0.0", "127.0.0.1"].includes(row.HostIp)), "An IPv4 local published PostgreSQL binding is required");
  assert.ok(bindings.every(row => ["0.0.0.0", "127.0.0.1", "::", "::1"].includes(row.HostIp) && row.HostPort === String(port)), "QA container port binding mismatch");
  const networks = Object.entries(container.NetworkSettings?.Networks || {});
  assert.equal(networks.length, 1, "Exactly one local GitHub service network is required");
  const [networkName,network] = networks[0];
  assert.match(networkName, /^github_network_[a-f0-9]{32}$/);
  assert.equal(container.HostConfig?.NetworkMode, networkName);
  assert.match(network.NetworkID || "", /^[a-f0-9]{64}$/);
  assert.ok(privateIpv4(network.IPAddress), "A private IPv4 from the attested local container is required");
  const descriptor = Object.freeze({
    kind: "github-actions-local-docker-postgresql-v1", daemon: LOCAL_DOCKER,
    containerId: container.Id, image, networkName, networkId: network.NetworkID,
    expectedServerAddress: network.IPAddress, expectedHost: host, expectedPort: port,
    databaseName: config.databaseName, databaseRole: config.databaseRole,
    postgresVersion: config.expectedPostgresVersion, serverVersionNumber: config.expectedServerVersionNumber,
    workflowSha256: createHash("sha256").update(workflowText).digest("hex"),
  });
  issuedDockerAttestations.add(descriptor);
  return descriptor;
}

export function assertQaPostgresClientIdentity(client, identity, { dockerAttestation, env = process.env, platform = process.platform } = {}) {
  assert.match(identity?.database || "", QA_DATABASE);
  assert.equal(identity.role, "nexid_e2e", "A dedicated nexid_e2e QA role is required");
  if (!dockerAttestation) {
    assert.ok(["127.0.0.1", "::1"].includes(identity.address), "Refusing a non-loopback PostgreSQL server");
    return { mode: "native-server-loopback", serverAddress: identity.address };
  }
  assert.ok(issuedDockerAttestations.has(dockerAttestation), "Unissued Docker PostgreSQL attestation refused");
  assert.ok(env.GITHUB_ACTIONS === "true" && env.NODE_ENV === "test" && env.VERCEL_ENV === "test" && platform === "linux", "Docker PostgreSQL attestation requires the test Linux GitHub runner");
  const d = dockerAttestation, parameters = client?.connectionParameters, socket = client?.connection?.stream;
  assert.ok(parameters && parameters.host === d.expectedHost && Number(parameters.port) === d.expectedPort && parameters.user === d.databaseRole && parameters.database === d.databaseName, "Actual PostgreSQL client endpoint or identity mismatch");
  assert.ok(socket instanceof Socket && !socket.destroyed && !socket.connecting && socket.readyState === "open" && socket.readable && socket.writable && client._connected === true && !client._ending && !client._ended, "A live actual PostgreSQL TCP socket is required");
  assert.ok(loopbackPeer(socket.remoteAddress) && socket.remoteAddress.replace(/^::ffff:/, "") === d.expectedHost && socket.remotePort === d.expectedPort, "Actual PostgreSQL TCP peer must match the attested loopback endpoint");
  assert.equal(identity.database, d.databaseName, "Attested QA database mismatch");
  assert.equal(identity.role, d.databaseRole, "Attested QA role mismatch");
  assert.equal(identity.address, d.expectedServerAddress, "PostgreSQL server address must equal the exact attested local Docker IPv4");
  assert.equal(Number(identity.server_version_number), d.serverVersionNumber, "Attested PostgreSQL version mismatch");
  assert.equal(String(identity.neon_endpoint_id || "").trim(), "", "Remote Neon PostgreSQL refused");
  assert.equal(identity.transaction_read_only, "off", "Writable disposable QA PostgreSQL required");
  assert.ok(Number.isInteger(identity.pid) && identity.pid > 0, "A numeric PostgreSQL backend PID is required");
  return { mode: d.kind, serverAddress: identity.address, tcpPeer: socket.remoteAddress, tcpPort: socket.remotePort, serverVersionNumber: Number(identity.server_version_number) };
}

// Importing this file does not connect or read environment credentials. Only
// an explicit, already-connected loopback QA factory can run these statements.
// Compatibility entry point only: positive statements now belong to the whole
// actual claim core. The frozen former 51/4 statement-only results remain historical.
export async function runOwnershipCurrentStatePostgresQa(options = {}) {
  const { runConsumerOwnershipClaimPostgresQa } = await import("./consumer-ownership-claim-postgres-harness.mjs");
  return runConsumerOwnershipClaimPostgresQa(options);
}
