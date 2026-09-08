import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { authStartErrorMessage, consumerDeliveryMessage, consumerDeliveryIsSimulation } from "../src/app/login/consumer-login-delivery.ts";

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

for (const [error, expected] of [
  ["twilio_whatsapp_sandbox_forbidden", "WhatsApp todavía no está disponible. Elegí email para recibir tu código."],
  ["consumer_auth_email_provider_invalid", "Este canal todavía no está configurado. Probá el otro medio de acceso."],
  ["twilio_content_sid_invalid", "Este canal todavía no está configurado. Probá el otro medio de acceso."],
  ["twilio_status_callback_url_invalid", "Este canal todavía no está configurado. Probá el otro medio de acceso."],
]) {
  test(`login explains ${error} with an actionable alternative`, () => {
    assert.equal(authStartErrorMessage(error), expected);
    assert.equal(authStartErrorMessage(error).includes(error), false);
  });
}

test("existing login error messages remain unchanged after extraction", () => {
  const groups = [
    [["rate_limited"], "Demasiados intentos. Esperá unos minutos y probá de nuevo."],
    [["resend_api_key_missing", "consumer_auth_from_email_missing", "smtp_credentials_missing"], "No se pudo enviar el email porque falta configurar el proveedor de correo en producción."],
    [["twilio_credentials_missing", "twilio_sender_missing"], "No se pudo enviar el código por teléfono porque falta configurar Twilio."],
    [["twilio_delivery_failed", "resend_delivery_failed", "smtp_delivery_failed"], "No se pudo confirmar el envío. Revisá el contacto o probá el otro canal. Si se repite, contactá a soporte."],
    [[
      "otp_provider_unavailable", "consumer_auth_mode_invalid", "consumer_auth_demo_forbidden",
      "consumer_phone_otp_channel_invalid", "smtp_receipt_invalid", "resend_receipt_invalid", "twilio_receipt_invalid",
      "smtp_delivery_timeout", "resend_delivery_timeout", "twilio_delivery_timeout",
    ], "Este canal no pudo confirmar el envío del código. Probá el otro medio de acceso. Si el mensaje llega más tarde, usá siempre el código más reciente."],
  ];
  for (const [errors, expected] of groups) {
    for (const error of errors) assert.equal(authStartErrorMessage(error), expected, error);
  }
});

test("unknown or absent login errors use a safe message without exposing provider content", () => {
  const privateMessage = "provider-detail recipient@example.test OTP 654321";
  for (const error of [undefined, null, "", false, 0, "unknown_provider_error", privateMessage, new Error(privateMessage), { message: privateMessage }]) {
    assert.equal(authStartErrorMessage(error), "No se pudo iniciar sesión.");
  }
});

test("login panel uses the shared error mapper and has no duplicate implementation", async () => {
  const source = await readFile(new URL("../src/app/login/consumer-login-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /import\s*\{[^}]*\bauthStartErrorMessage\b[^}]*\}\s*from\s*["']\.\/consumer-login-delivery["']/);
  assert.match(source, /setStatus\(authStartErrorMessage\(payload\?\.error\)\)/);
  assert.doesNotMatch(source, /function\s+authStartErrorMessage\b|(?:const|let|var)\s+authStartErrorMessage\s*=/);
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
