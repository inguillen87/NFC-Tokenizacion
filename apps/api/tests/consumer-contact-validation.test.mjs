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

test("explicit international prefixes survive both phone input fields at every supported length", () => {
  for (let length = 8; length <= 15; length += 1) {
    const digits = `1${"2".repeat(length - 1)}`;
    const presentations = [
      ` +${digits.slice(0, 3)} ${digits.slice(3)} `,
      `+(${digits.slice(0, 3)}) ${digits.slice(3, 5)}-${digits.slice(5)}`,
      `+${digits.slice(0, 3)}.${digits.slice(3)}`,
    ];
    for (const field of ["phone", "contact"]) {
      const expected = { ok: true, contact: `+${digits}`, type: "phone" };
      for (const formatted of presentations) {
        assert.deepEqual(parseConsumerContact({ [field]: formatted }), expected);
      }
      assert.deepEqual(parseConsumerContact({ [field]: expected.contact }), expected);
    }
  }
});

test("international prefix preservation keeps phone length validation and empty-input rejection", () => {
  for (const field of ["phone", "contact"]) {
    for (const digits of ["1".repeat(7), "1".repeat(16)]) {
      assert.deepEqual(parseConsumerContact({ [field]: `+${digits}` }), { ok: false, error: "invalid_phone" });
    }
  }
  assert.deepEqual(parseConsumerContact({}), { ok: false, error: "contact_required" });
});

test("unprefixed contacts retain their existing identity normalization without guessing a prefix", () => {
  for (const [input, normalized] of [
    ["12345678", "12345678"],
    ["123456789", "123456789"],
    ["1234567890", "+1234567890"],
    ["123456789012345", "+123456789012345"],
  ]) {
    for (const field of ["phone", "contact"]) {
      assert.deepEqual(parseConsumerContact({ [field]: input }), { ok: true, contact: normalized, type: "phone" });
    }
  }
});

test("unsupported characters do not turn short legacy contacts into international identities", () => {
  for (const input of ["+1abc2345678", "++12345678", "+1234\n5678"]) {
    for (const field of ["phone", "contact"]) {
      assert.deepEqual(parseConsumerContact({ [field]: input }), { ok: true, contact: "12345678", type: "phone" });
    }
  }
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
