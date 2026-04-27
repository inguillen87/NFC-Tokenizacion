import { Badge, Card, SectionHeading, WorldMapRealtime } from "@product/ui";

type ProofSummary = {
  tapsToday: number;
  validRate: number;
  riskBlocked: number;
  activeRegions: number;
  demoMode: boolean;
  latestPublicEvents: Array<{ city: string; country: string; verdict: string; tenant: string; occurredAt: string; uidMasked: string }>;
};

export function LandingProofSection({ proof }: { proof: ProofSummary }) {
  const mapPoints = proof.latestPublicEvents
    .slice(0, 8)
    .map((event, index) => ({
      city: event.city,
      country: event.country,
      lat: [40.7128, -34.6037, -23.5505, 48.8566, 40.4168, 37.7749, -33.8688, 19.4326][index % 8],
      lng: [-74.006, -58.3816, -46.6333, 2.3522, -3.7038, -122.4194, 151.2093, -99.1332][index % 8],
      scans: 1,
      risk: ["REPLAY_SUSPECT", "DUPLICATE", "TAMPER", "TAMPERED", "INVALID"].includes(event.verdict) ? 1 : 0,
      lastSeen: event.occurredAt,
      status: event.verdict,
      source: event.tenant,
    }));

  return (
    <section className="container-shell py-14">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading
          eyebrow="Live proof system"
          title="Physical identity infrastructure, running now"
          description="Live operational proof from anonymized events: trust posture, risk blocks and regional activity."
        />
        {proof.demoMode ? <Badge tone="amber">Demo data</Badge> : <Badge tone="green">Production aggregate</Badge>}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-400">Taps today</p><p className="text-2xl font-semibold text-white">{proof.tapsToday}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-400">Valid rate</p><p className="text-2xl font-semibold text-emerald-300">{proof.validRate.toFixed(1)}%</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-400">Risk blocked</p><p className="text-2xl font-semibold text-amber-200">{proof.riskBlocked}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-400">Active regions</p><p className="text-2xl font-semibold text-cyan-200">{proof.activeRegions}</p></Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <WorldMapRealtime
          title="Mini global operations view"
          subtitle="Anonymized nodes from recent public-safe events."
          points={mapPoints}
          initialExpanded={false}
        />
        <Card className="p-4">
          <p className="text-sm font-semibold text-white">Latest anonymized events</p>
          <div className="mt-3 space-y-2 text-xs text-slate-300">
            {proof.latestPublicEvents.slice(0, 6).map((event) => (
              <div key={`${event.occurredAt}-${event.uidMasked}`} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
                <p><b>{event.verdict}</b> · {event.city}, {event.country}</p>
                <p className="text-slate-400">{event.uidMasked} · {event.tenant} · {new Date(event.occurredAt).toLocaleString("es-AR")}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
