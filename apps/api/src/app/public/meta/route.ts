export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return Response.json({
    category: "verifiable_physical_identity_platform",
    narrativeOrder: ["verify", "passport", "rights"],
    carriers: ["nfc", "qr"],
    productLines: [
      { key: "basic", chip: "NTAG215", focus: "interaction_and_scale" },
      { key: "secure", chip: "NTAG_424_DNA_TT", focus: "high_trust_authenticity" },
    ],
    routes: {
      docs: "/docs",
      faq: "/docs#faq",
      stack: "/stack",
      audiences: "/audiences",
      glossary: "/glossary",
    },
  });
}
