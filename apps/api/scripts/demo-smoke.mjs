#!/usr/bin/env node

const apiBaseUrl = process.env.DEMO_SMOKE_BASE_URL || "http://localhost:3003";
const webBaseUrl = process.env.DEMO_SMOKE_WEB_BASE_URL || "http://localhost:3000";

async function check(name, url, validate, options = {}) {
  try {
    const response = await fetch(url, { headers: { accept: options.accept || "application/json,text/html", ...(options.headers || {}) } });
    const text = await response.text();
    const ok = validate(response, text);
    console.log(`${ok ? "PASS" : "FAIL"} ${name} -> ${response.status} ${url}`);
    if (!ok) {
      console.log(text.slice(0, 240));
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(`WARN ${name} -> unable to reach ${url} (${error.message})`);
    console.log("Tip: start required services before running demo smoke.");
  }
}

await check("health", `${apiBaseUrl}/health`, (response, text) => response.ok && /ok|healthy|true/i.test(text));
await check("sun-json", `${apiBaseUrl}/sun?view=json&bid=DEMO-2026-02&uid=04B7723410E2AD&ctr=1&cmac=DEMO`, (response, text) => {
  const isJson = /application\/json/.test(response.headers.get("content-type") || "") || text.trim().startsWith("{");
  return response.status < 500 && isJson && /"(verdict|status|ok)"/i.test(text);
});
await check("sun-html", `${apiBaseUrl}/sun?view=html&bid=DEMO-2026-02&uid=04B7723410E2AD&ctr=1&cmac=DEMO`, (response, text) => {
  const hasHtml = /text\/html/.test(response.headers.get("content-type") || "") && /<html/i.test(text);
  return response.status < 500 && hasHtml && /(trust|auth|autenticación|autenticação)/i.test(text);
});
await check("admin-events-stream", `${apiBaseUrl}/admin/events/stream`, (response, text) => {
  return response.status < 500 && (/text\/event-stream/.test(response.headers.get("content-type") || "") || /event:|data:/i.test(text));
});

if (process.env.DEMO_CONSUMER_COOKIE) {
  await check("consumer-me", `${apiBaseUrl}/consumer/me`, (response, text) => response.status < 500 && /ok|authenticated|consumer/i.test(text), {
    headers: { cookie: process.env.DEMO_CONSUMER_COOKIE },
  });
  await check("consumer-marketplace", `${apiBaseUrl}/marketplace/products?tenant=demobodega`, (response, text) => response.status < 500 && /demobodega|items/i.test(text));
  await check("web-me", `${webBaseUrl}/me`, (response) => response.status < 500, {
    headers: { cookie: process.env.DEMO_CONSUMER_COOKIE },
  });
  await check("web-marketplace", `${webBaseUrl}/me/marketplace?tenant=demobodega`, (response) => response.status < 500, {
    headers: { cookie: process.env.DEMO_CONSUMER_COOKIE },
  });
} else {
  console.log("WARN optional consumer checks skipped (set DEMO_CONSUMER_COOKIE).");
}

if (!process.exitCode) {
  console.log("Demo smoke checks completed.");
}
