import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Socket } from "node:net";
import { attestGithubPostgresDocker, assertQaPostgresClientIdentity, runOwnershipCurrentStatePostgresQa } from "./helpers/ownership-current-state-postgres-harness.mjs";

test("ownership PostgreSQL harness requires an explicit disposable QA factory", async () => {
  await assert.rejects(runOwnershipCurrentStatePostgresQa(), /explicit disposable QA/);
});

for (const [name,identity,reason] of [
  ["production database",{database:"production",role:"nexid_e2e",address:"127.0.0.1",pid:1},/nexid_e2e/],
  ["remote server",{database:"nexid_e2e",role:"nexid_e2e",address:"192.0.2.1",pid:1},/non-loopback/],
  ["non-QA role",{database:"nexid_e2e",role:"application",address:"127.0.0.1",pid:1},/dedicated nexid_e2e/],
]) {
  test(`ownership PostgreSQL harness refuses ${name} before mutations and closes its client`, async () => {
    const statements=[]; let closed=false;
    await assert.rejects(runOwnershipCurrentStatePostgresQa({ connect: async () => ({
      query: async query => { statements.push(query); return {rows:[identity]}; },
      end: async () => {closed=true;},
    }) }),reason);
    assert.equal(closed,true);
    assert.doesNotMatch(statements.join("\n"),/CREATE|INSERT|UPDATE|DELETE|DROP|TRUNCATE/);
  });
}

test("ownership PostgreSQL harness rejects a reused client and closes it once before schema creation", async () => {
  const statements=[]; let closes=0;
  const client={
    query: async query => {statements.push(query); return {rows:[{database:"nexid_e2e",role:"nexid_e2e",address:"127.0.0.1",pid:1}]};},
    end: async () => {closes+=1;},
  };
  await assert.rejects(runOwnershipCurrentStatePostgresQa({connect:async()=>client}), /Distinct QA clients/);
  assert.equal(closes,1);
  assert.doesNotMatch(statements.join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP|TRUNCATE/);
});

const workflowText = readFileSync(new URL("../../../.github/workflows/enterprise-ephemeral-e2e.yml", import.meta.url), "utf8");
const githubTestEnv = { GITHUB_ACTIONS: "true", NODE_ENV: "test", VERCEL_ENV: "test" };
const networkName = `github_network_${"c".repeat(32)}`;
function attestationFixture({ version = "18.4", mutate = () => {}, ids = "a".repeat(12), env = githubTestEnv, platform = "linux", text = workflowText } = {}) {
  const image = [...workflowText.matchAll(/- version: "([^"]+)"\s+image: "([^"]+)"/g)].find(row => row[1] === version)?.[2];
  const config = { databaseUrl: "postgresql://nexid_e2e:synthetic@127.0.0.1:5432/nexid_e2e", databaseName: "nexid_e2e", databaseRole: "nexid_e2e", expectedPostgresVersion: version, expectedServerVersionNumber: version === "16.4" ? 160004 : 180004 };
  const container = { Id: "a".repeat(64), State: { Running: true }, Config: { Image: image, Env: ["QA_PRIVATE_VALUE=never-persist-this"] }, HostConfig: { NetworkMode: networkName }, NetworkSettings: { Ports: { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "5432" }, { HostIp: "::", HostPort: "5432" }] }, Networks: { [networkName]: { NetworkID: "b".repeat(64), IPAddress: "172.18.0.2" } } } };
  mutate({ config, container });
  const commands = [];
  const descriptor = attestGithubPostgresDocker({ config, env, platform, workflowText: text, runDocker: args => {
    commands.push(args); assert.deepEqual(args.slice(0,2), ["--host", "unix:///var/run/docker.sock"]);
    return args[2] === "ps" ? ids : JSON.stringify([container]);
  } });
  return { descriptor, commands };
}
function socketClient(overrides = {}) {
  // An unconnected real net.Socket with simulated metadata: no TCP connection
  // or SQL executes in these refusal/contract tests.
  const socket = new Socket();
  for (const [key,value] of Object.entries({ remoteAddress: "127.0.0.1", remotePort: 5432, readyState: "open", readable: true, writable: true, ...overrides })) Object.defineProperty(socket, key, { value, configurable: true });
  return { _connected: true, connectionParameters: { host: "127.0.0.1", port: 5432, user: "nexid_e2e", database: "nexid_e2e" }, connection: { stream: socket } };
}
const dockerIdentity = () => ({ database: "nexid_e2e", role: "nexid_e2e", pid: 1, address: "172.18.0.2", server_version_number: 180004, neon_endpoint_id: null, transaction_read_only: "off" });

for (const version of ["16.4", "18.4"]) test(`Docker attestation accepts only the exact local immutable PostgreSQL ${version} service`, () => {
  const { descriptor, commands } = attestationFixture({ version });
  assert.equal(commands.length, 2); assert.ok(Object.isFrozen(descriptor));
  assert.equal(descriptor.postgresVersion, version);
  assert.equal(descriptor.expectedServerAddress, "172.18.0.2");
  assert.doesNotMatch(JSON.stringify(descriptor), /QA_PRIVATE_VALUE|never-persist|password|postgresql:\/\//i);
  const identity = { ...dockerIdentity(), server_version_number: descriptor.serverVersionNumber };
  assert.equal(assertQaPostgresClientIdentity(socketClient(), identity, { dockerAttestation: descriptor, env: githubTestEnv, platform: "linux" }).mode, descriptor.kind);
});

test("non-GitHub execution keeps native loopback checks and never invokes Docker", () => {
  assert.equal(attestGithubPostgresDocker({ env: { GITHUB_ACTIONS: "false" }, runDocker: () => { throw new Error("must not execute"); } }), null);
  assert.equal(assertQaPostgresClientIdentity({}, { ...dockerIdentity(), address: "127.0.0.1" }).mode, "native-server-loopback");
  assert.throws(() => assertQaPostgresClientIdentity({}, dockerIdentity()), /non-loopback/);
});

for (const [name,options,reason] of [
  ["non-Linux runner", { platform: "win32" }, /Linux/],
  ["non-test runtime", { env: { ...githubTestEnv, NODE_ENV: "production" } }, /production/],
  ["multiple matching containers", { ids: `${"a".repeat(12)}\n${"b".repeat(12)}` }, /Exactly one/],
  ["no matching container", { ids: "" }, /Exactly one/],
  ["changed workflow pin", { text: workflowText.replace("5660c2cb", "0000c2cb") }, /workflow/],
  ["wrong container image", { mutate: ({container}) => { container.Config.Image = "postgres:18"; } }, /immutable/],
  ["stopped container", { mutate: ({container}) => { container.State.Running = false; } }, /running/],
  ["wrong port", { mutate: ({container}) => { container.NetworkSettings.Ports["5432/tcp"][0].HostPort = "5433"; } }, /binding mismatch/],
  ["missing IPv4 binding", { mutate: ({container}) => { container.NetworkSettings.Ports["5432/tcp"].shift(); } }, /IPv4/],
  ["multiple networks", { mutate: ({container}) => { container.NetworkSettings.Networks.extra = {}; } }, /Exactly one/],
  ["public server IP", { mutate: ({container}) => { container.NetworkSettings.Networks[networkName].IPAddress = "192.0.2.1"; } }, /private IPv4/],
  ["remote configured host", { mutate: ({config}) => { config.databaseUrl = config.databaseUrl.replace("127.0.0.1", "192.0.2.1"); } }, /loopback/],
  ["URL host override", { mutate: ({config}) => { config.databaseUrl += "?host=192.0.2.1"; } }, /Unaltered/],
  ["unsupported version", { version: "18.6" }, /16.4\/18.4/],
]) test(`Docker attestation refuses ${name}`, () => assert.throws(() => attestationFixture(options), reason));

for (const [name,mutate,reason] of [
  ["declared loopback with real remote peer", (client) => { Object.defineProperty(client.connection.stream, "remoteAddress", { value: "192.0.2.1" }); }, /TCP peer/],
  ["missing socket", client => { delete client.connection.stream; }, /TCP socket/],
  ["plain fake socket object", client => { client.connection.stream = { readyState: "open", remoteAddress: "127.0.0.1", remotePort: 5432 }; }, /TCP socket/],
  ["closed socket", client => { client.connection.stream.destroy(); }, /TCP socket/],
  ["wrong TCP port", client => { Object.defineProperty(client.connection.stream, "remotePort", { value: 5433 }); }, /TCP peer/],
  ["wrong declared port", client => { client.connectionParameters.port = 5433; }, /endpoint/],
  ["wrong declared host", client => { client.connectionParameters.host = "localhost"; }, /endpoint/],
  ["unconnected client", client => { client._connected = false; }, /TCP socket/],
  ["another private server IP", (_,identity) => { identity.address = "172.18.0.3"; }, /exact attested/],
  ["public server IP", (_,identity) => { identity.address = "192.0.2.1"; }, /exact attested/],
  ["missing server IP", (_,identity) => { delete identity.address; }, /exact attested/],
  ["wrong server version", (_,identity) => { identity.server_version_number = 180006; }, /version/],
  ["missing version", (_,identity) => { delete identity.server_version_number; }, /version/],
  ["remote Neon identity", (_,identity) => { identity.neon_endpoint_id = "remote"; }, /Neon/],
  ["read-only database", (_,identity) => { identity.transaction_read_only = "on"; }, /Writable/],
  ["wrong QA database", (_,identity) => { identity.database = "nexid_e2e_other"; }, /database mismatch/],
  ["wrong role", (_,identity) => { identity.role = "application"; }, /dedicated/],
]) test(`Attested client refuses ${name}`, () => {
  const { descriptor } = attestationFixture(); const client = socketClient(), identity = dockerIdentity();
  mutate(client,identity);
  assert.throws(() => assertQaPostgresClientIdentity(client, identity, { dockerAttestation: descriptor, env: githubTestEnv, platform: "linux" }), reason);
});

test("attested mode refuses unissued descriptors and non-GitHub callers", () => {
  const { descriptor } = attestationFixture();
  assert.throws(() => assertQaPostgresClientIdentity(socketClient(), dockerIdentity(), { dockerAttestation: { ...descriptor }, env: githubTestEnv, platform: "linux" }), /Unissued/);
  assert.throws(() => assertQaPostgresClientIdentity(socketClient(), dockerIdentity(), { dockerAttestation: descriptor, env: { ...githubTestEnv, GITHUB_ACTIONS: "false" }, platform: "linux" }), /Linux GitHub runner/);
});

test("an IPv4-mapped loopback TCP peer is accepted for the exact attested IPv4 endpoint", () => {
  const { descriptor } = attestationFixture();
  assert.equal(assertQaPostgresClientIdentity(socketClient({ remoteAddress: "::ffff:127.0.0.1" }), dockerIdentity(), { dockerAttestation: descriptor, env: githubTestEnv, platform: "linux" }).tcpPeer, "::ffff:127.0.0.1");
});

test("ownership refuses a fabricated Docker descriptor before schema writes and closes the client", async () => {
  let closed = false; const statements = [];
  await assert.rejects(runOwnershipCurrentStatePostgresQa({ dockerAttestation: {}, connect: async () => ({ query: async query => { statements.push(query); return { rows: [dockerIdentity()] }; }, end: async () => { closed = true; } }) }), /Unissued/);
  assert.equal(closed, true); assert.equal(statements.filter(text => text.startsWith("SELECT")).length, 1);
  assert.deepEqual(statements.slice(1), ["ROLLBACK"]);
  assert.doesNotMatch(statements.join("\n"), /CREATE|INSERT|UPDATE|DELETE|DROP|TRUNCATE/);
});
