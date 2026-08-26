export function StructuredData() {
  const orgData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "nexID Platform",
    "url": "https://nexid.lat",
    "logo": "https://nexid.lat/nexid-mark-256.png",
    "description": "Digital identity and source-labelled evidence for connected products using NFC or QR.",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "info@nexid.lat"
    }
  };

  const softwareData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "nexID Platform",
    "description": "Business platform for connected-product identity, declared traceability, digital passports and policy-controlled services. Digital evidence does not by itself prove a physical object.",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "url": "https://nexid.lat"
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareData) }}
      />
    </>
  );
}
