import { Card } from "@product/ui";

export default function EventsPage() {
  return (
    <main>
      <Card className="p-8">
        <div className="text-2xl font-bold text-white">Events</div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Logs, deteccion de duplicados, replays y fraud scoring.</p>
      </Card>
    </main>
  );
}
