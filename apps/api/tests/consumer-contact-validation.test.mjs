import test from "node:test";
import assert from "node:assert/strict";

const { parseConsumerContact } = await import("../src/lib/consumer-contact.ts");

test("consumer contact accepts normalized email", () => {
  assert.deepEqual(parseConsumerContact({ email: "Guillen.Marce@gmail.com " }), {
    ok: true,
    contact: "guillen.marce@gmail.com",
    type: "email",
  });
});

test("consumer contact rejects malformed email", () => {
  assert.deepEqual(parseConsumerContact({ email: "bad@" }), { ok: false, error: "invalid_email" });
});

test("consumer contact accepts international phone", () => {
  assert.deepEqual(parseConsumerContact({ phone: "+54 9 261 316 8608" }), {
    ok: true,
    contact: "+5492613168608",
    type: "phone",
  });
});

test("consumer contact rejects short phone", () => {
  assert.deepEqual(parseConsumerContact({ phone: "12345" }), { ok: false, error: "invalid_phone" });
});

test("consumer contact accepts generic contact field", () => {
  assert.deepEqual(parseConsumerContact({ contact: "2613168608" }), {
    ok: true,
    contact: "+2613168608",
    type: "phone",
  });
});
