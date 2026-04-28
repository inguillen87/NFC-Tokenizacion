#!/usr/bin/env node

const baseUrl = process.env.DEMO_SMOKE_BASE_URL || "http://localhost:3003";

async function check(name, path, validate) {
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url, { headers: { accept: "application/json,text/html" } });
    const text = await response.text();
    const ok = validate(response, text);
    console.log(`${ok ? "PASS" : "FAIL"} ${name} -> ${response.status} ${url}`);
    if (!ok) {
      console.log(text.slice(0, 240));
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(`WARN ${name} -> unable to reach ${url} (${error.message})`);
    console.log("Tip: start api with `npm run dev:api` before running demo smoke.");
  }
}

await check("health", "/health", (response, text) => response.ok && /ok|healthy|true/i.test(text));
await check("sun-json", "/sun?view=json", (response, text) => response.status < 500 && /application\/json|\{/.test(response.headers.get("content-type") || "") || text.trim().startsWith("{"));
await check("sun-html", "/sun?view=html", (response, text) => response.status < 500 && /text\/html/.test(response.headers.get("content-type") || "") && /<html/i.test(text));

if (!process.exitCode) {
  console.log("Demo smoke checks completed.");
}
