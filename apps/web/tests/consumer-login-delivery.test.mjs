import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { consumerDeliveryMessage, consumerDeliveryIsSimulation } from "../src/app/login/consumer-login-delivery.ts";

for (const channel of ["whatsapp", "sms", "email"]) {
  test(`OTP ${channel} reports provider acceptance, not handset delivery`, () => {
    const message = consumerDeliveryMessage({ delivery: { channel, status: "accepted" } });
    assert.match(message, /aceptó el envío/);
    assert.match(message, /no confirma todavía su entrega/);
    assert.match(message.toLowerCase(), new RegExp(channel));
  });
}
test("old API responses cannot claim receipt or MFA", () => {
  assert.match(consumerDeliveryMessage({}), /entrega todavía no está confirmada/);
  assert.match(consumerDeliveryMessage({ deliveryChannel: "email_and_phone_same_challenge" }), /no constituye MFA/);
  assert.equal(consumerDeliveryIsSimulation({ mode: '"demo"' }), true);
  assert.equal(consumerDeliveryIsSimulation({ deliveryChannel: "demo" }), true);
  assert.equal(consumerDeliveryIsSimulation({ mode: "smart" }), false);
});
test("secondary failure remains visible", () => {
  assert.match(consumerDeliveryMessage({ delivery: { channel: "email", status: "accepted" }, secondaryDelivery: { status: "failed" } }), /canal adicional no pudo/);
});
test("changing contact resets challenge and login offers retry without reloading", async () => {
  const source = await readFile(new URL("../src/app/login/consumer-login-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /function changeContact[\s\S]*?setStep\("start"\);[\s\S]*?setCode\(""\)/);
  assert.match(source, /Reenviar código/);
  assert.match(source, /Probar con email/);
  assert.match(source, /role="status"/);
  assert.match(source, /session\?\.ok && session\?\.authenticated/);
  assert.doesNotMatch(source, /Código enviado\./);
});
