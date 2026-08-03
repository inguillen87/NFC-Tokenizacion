import type { Metadata } from "next";
import { Suspense } from "react";
import { OfflineCertificateClient } from "./offline-certificate-client";

export const metadata: Metadata = {
  title: "Certificado público offline · nexID",
  description: "Verificación local de información pública firmada, separada de SUN/SDM.",
  robots: { index: false, follow: false },
};

export default function OfflineCertificatePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050914] p-6 text-slate-200">Abriendo certificado público…</main>}>
      <OfflineCertificateClient />
    </Suspense>
  );
}
