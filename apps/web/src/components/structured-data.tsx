import type { AppLocale } from "@product/config";

const structuredCopy: Record<AppLocale, { description: string; category: string; contactType: string }> = {
  "es-AR": {
    description: "Plataforma empresarial de identidad y evidencia digital para productos conectados.",
    category: "Software empresarial",
    contactType: "atención comercial",
  },
  en: {
    description: "Enterprise digital identity and evidence platform for connected products.",
    category: "Enterprise software",
    contactType: "sales",
  },
  "pt-BR": {
    description: "Plataforma empresarial de identidade e evidência digital para produtos conectados.",
    category: "Software empresarial",
    contactType: "atendimento comercial",
  },
};

export function StructuredData({ locale }: { locale: AppLocale }) {
  const copy = structuredCopy[locale];
  const orgData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "nexID",
    "url": "https://nexid.lat",
    "logo": "https://nexid.lat/nexid-mark-256.png",
    "description": copy.description,
    "parentOrganization": {
      "@type": "Organization",
      "name": "Inmovar Latam SAS"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": copy.contactType,
      "email": "support@nexid.lat"
    }
  };

  const productData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "nexID",
    "description": copy.description,
    "brand": {
      "@type": "Brand",
      "name": "nexID"
    },
    "category": copy.category
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productData) }}
      />
    </>
  );
}
