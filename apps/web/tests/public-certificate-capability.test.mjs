import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("SUN and certificate pages preserve the signed certificate capability", async () => {
  const [sunPage, certificatePage] = await Promise.all([
    readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/certificado/[eventId]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(sunPage, /certificate\?: \{ shareToken\?: string \| null; url\?: string \| null \}/);
  assert.match(sunPage, /certificateShareToken = String\(result\.certificate\?\.shareToken/);
  assert.match(sunPage, /\?share=\$\{encodeURIComponent\(certificateShareToken\)\}/);

  assert.match(certificatePage, /firstParam\(query\.share\)/);
  assert.match(certificatePage, /fetchCertificate\(eventId, shareToken\)/);
  assert.match(certificatePage, /\?share=\$\{encodeURIComponent\(shareToken\)\}/);
  assert.match(certificatePage, /cache: "no-store"/);
});

