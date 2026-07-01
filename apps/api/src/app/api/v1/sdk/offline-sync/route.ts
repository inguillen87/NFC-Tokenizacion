import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeOfflineLocalVerdict, normalizeOfflineObservedAt } from "@/lib/offline-verifier";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { events } = body;

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: "Invalid payload, 'events' array required." },
        { status: 400 }
      );
    }

    const insertedEvents = [];

    for (const event of events) {
      const {
        localId,
        operatorId,
        tenantId,
        capturedUrl,
        capturedAt,
        approximateLocation,
        deviceId,
        status,
      } = event;

      // Validate required fields
      if (!localId || !operatorId || !tenantId || !capturedUrl || !deviceId) {
        continue;
      }

      const normalizedStatus = status ? normalizeOfflineLocalVerdict(status) : "SYNC_PENDING";
      const normalizedCapturedAt = normalizeOfflineObservedAt(capturedAt);

      let dbStatus = "PENDING_BACKEND_VERIFICATION";
      if (normalizedStatus === "OFFLINE_LOCAL_PASS") dbStatus = "SYNCED_VALID";
      if (normalizedStatus === "OFFLINE_LOCAL_FAIL") dbStatus = "SYNCED_INVALID";

      const createdEvent = await prisma.offlineScanEvent.create({
        data: {
          localId: String(localId),
          operatorId: String(operatorId),
          tenantId: String(tenantId),
          capturedUrl: String(capturedUrl),
          capturedAt: new Date(normalizedCapturedAt),
          approximateLocation: approximateLocation ? approximateLocation : undefined,
          deviceId: String(deviceId),
          status: dbStatus,
        },
      });

      insertedEvents.push(createdEvent);
    }

    return NextResponse.json(
      { success: true, count: insertedEvents.length, synced: insertedEvents.map(e => e.localId) },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Offline sync error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
