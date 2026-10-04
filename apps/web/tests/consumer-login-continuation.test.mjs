import test from "node:test";
import assert from "node:assert/strict";
import { consumerAuthStartPayload, normalizeConsumerAuthReturnPath } from "../src/app/login/consumer-login-continuation.ts";

test("email continuation preserves product selection without transmitting TAP or device credentials", () => {
  const next = "/me/products?tenant=balmec&bid=RA-2407&eventId=9007199254740993&fromTap=1&action=products&focus=9007199254740993&freshToken=private-capability&uid=tag-secret&mac=nfc-signature&ctr=000001&picc_data=private&lat=-32.9&lng=-68.8&contact=private%40example.test#history";
  const sanitized = "/me/products?fromTap=1&eventId=9007199254740993&focus=9007199254740993&bid=RA-2407&tenant=balmec&action=products";
  assert.equal(normalizeConsumerAuthReturnPath(next), sanitized);
  assert.deepEqual(consumerAuthStartPayload({ email: "persona@example.test" }, next), { email: "persona@example.test", next: sanitized });
  assert.deepEqual(consumerAuthStartPayload({ phone: "+5491155551234" }, next), { phone: "+5491155551234" });
});

test("normal consumer and legacy nonconsumer destinations do not change the OTP start contract", () => {
  for (const next of [undefined, null, "/me", "/docs", "/sun?uid=secret&mac=signature", "/login?t=private", "https://evil.example", "//evil.example", "/\\evil.example", "/%2e%2e//evil.example"]) {
    assert.equal(normalizeConsumerAuthReturnPath(next), "/me");
    assert.deepEqual(consumerAuthStartPayload({ email: "persona@example.test" }, next), { email: "persona@example.test" });
  }
});

test("only existing consumer routes can be sent in the email link", () => {
  for (const route of ["/me", "/me/products", "/me/passport", "/me/brands", "/me/wallet", "/me/marketplace", "/me/rewards", "/me/experiences", "/me/sommelier", "/me/taps", "/me/privacy", "/me/security", "/me/cork-analyzer", "/me/taps/9223372036854775807"]) {
    assert.equal(normalizeConsumerAuthReturnPath(route), route, route);
  }
  for (const route of ["/me/unknown", "/me/products/", "/me/taps/0", "/me/taps/01", "/me/taps/9223372036854775808", "/me/taps/9007199254740993/claim", "/me/taps/demo-sun-preview"]) {
    assert.equal(normalizeConsumerAuthReturnPath(route), "/me", route);
  }
});

test("ambiguous or invalid continuation fields fall back rather than select a partial TAP", () => {
  for (const query of [
    "fromTap=1&fromTap=1", "eventId=1&event%49d=2", "tenant=balmec&tenant=other", "bid=A&bid=B", "focus=1&focus=2", "action=save&action=claim",
    "eventId=0", "eventId=01", "eventId=9223372036854775808", "eventId=1e3", "eventId=", "fromTap=true", "fromTap=0",
    "tenant=bad%2Fslug", "tenant=", `tenant=${"a".repeat(121)}`, "bid=private%40example.test", `bid=${"a".repeat(201)}`, "action=delete", "action=SAVE", "focus=not-an-id",
  ]) assert.equal(normalizeConsumerAuthReturnPath(`/me/products?${query}`), "/me", query);
  assert.equal(normalizeConsumerAuthReturnPath("/me/products?eventId=1&next=https%3A%2F%2Fevil.example&token=private#private"), "/me/products?eventId=1");
});

test("browser-normalized and nested encoded unsafe forms never become email destinations", () => {
  for (const next of ["\\\\evil.example", "%2F%2Fevil.example", "%252F%252Fevil.example", "/%5C%5Cevil.example", "/me?eventId=1%00", "/me?tenant=%E0%A4%A", "/me?tenant=%252525252561", "/me/taps/1%2F..%2F..%2Funknown", "javascript%3Aalert(1)", `/${"x".repeat(2048)}`]) {
    assert.equal(normalizeConsumerAuthReturnPath(next), "/me", next);
  }
});
