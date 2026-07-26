import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const start = await readFile(new URL("../src/app/consumer/associate/start/route.ts", import.meta.url), "utf8");
const verify = await readFile(new URL("../src/app/consumer/associate/verify/route.ts", import.meta.url), "utf8");
const authStart = await readFile(new URL("../src/app/consumer/auth/start/route.ts", import.meta.url), "utf8");

for (const [name, source] of [["start", start], ["verify", verify]]) {
  test(`consumer contact-link ${name} is authenticated, rate-limited and fail-closed`, () => {
    const rateIndex = source.indexOf("enforceCriticalRateLimit(req");
    const authIndex = source.indexOf("getConsumerFromRequest(req)");
    assert.ok(rateIndex > 0 && authIndex > rateIndex);
    assert.match(source, /contact_linking_temporarily_unavailable/);
    assert.match(source, /feature_disabled/);
    assert.match(source, /503/);
    assert.doesNotMatch(source, /consumer_auth_challenges|points_balance \+ 100|status = 'verified'|2FA Activado/);
  });
}

test("redundant OTP delivery is not represented as MFA", () => {
  assert.match(authStart, /multiChannelDelivery/);
  assert.match(authStart, /authenticationFactorsRequired: 1/);
  assert.match(authStart, /twoFactor: false/);
  assert.match(authStart, /single_factor_otp_with_optional_redundant_delivery/);
});
