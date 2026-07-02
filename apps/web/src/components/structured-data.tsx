export function StructuredData() {
  const orgData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "nexID Platform",
    "url": "https://nexid.lat",
    "logo": "https://nexid.lat/nexid-mark-256.png",
    "description": "Enterprise Supply Chain and Product Authentication via NFC and Tokenization",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "support@nexid.lat"
    }
  };

  const productData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "nexID Platform",
    "description": "NFC and Tokenization platform for Enterprise Supply Chain and Product Authentication.",
    "brand": {
      "@type": "Brand",
      "name": "nexID"
    },
    "category": "Enterprise Software"
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
