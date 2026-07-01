import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { gtin: string; lot: string; serial: string } }
) {
  const { gtin, lot, serial } = params;

  // Search for the batchId associated with this GS1 combination
  const cert = await prisma.offlinePublicCertificate.findFirst({
    where: {
      gtin,
      lot,
      serial,
    },
    select: {
      batchId: true,
    },
  });

  if (!cert || !cert.batchId) {
    return NextResponse.json(
      { error: "Product not found for the given GS1 digital link." },
      { status: 404 }
    );
  }

  // Extract base url to redirect to /sun
  const url = new URL(req.url);
  url.pathname = "/sun";
  url.searchParams.set("bid", cert.batchId);
  url.searchParams.set("source", "gs1_qr");

  return NextResponse.redirect(url.toString());
}
