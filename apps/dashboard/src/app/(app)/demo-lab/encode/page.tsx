"use client";

import { useMemo, useState } from "react";
import { Card, SectionHeading } from "@product/ui";

export default function EncodeStationPage() {
  const [template, setTemplate] = useState("wine-secure");
  const [uid, setUid] = useState("04B7723401E2A0");

  const encodedUrl = useMemo(() => `https://nexid.lat/sun?tpl=${template}&uid=${uid}`, [template, uid]);
  const hardwareUnavailableReason = "Vista previa solamente: esta pantalla no está conectada a un lector/escritor NFC autorizado.";

  return (
    <main className="space-y-4">
      <SectionHeading eyebrow="Encode" title="Encode Station" description="Vista previa del payload NDEF para demos; la escritura física requiere una estación autorizada" />
      <Card className="p-4">
        <label className="text-xs text-slate-400">Template</label>
        <select suppressHydrationWarning className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-white" value={template} onChange={(event) => setTemplate(event.target.value)}>
          <option value="wine-secure">wine-secure</option>
          <option value="events-basic">events-basic</option>
          <option value="docs-presence">docs-presence</option>
          <option value="cosmetics-secure">cosmetics-secure</option>
        </select>
        <label className="mt-3 block text-xs text-slate-400">UID</label>
        <input suppressHydrationWarning value={uid} onChange={(event) => setUid(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-white" />
      </Card>

      <Card className="p-4 text-xs text-slate-300">
        <div id="encode-hardware-status" role="status" className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-amber-100">
          <b>Vista previa · sin acceso al hardware.</b> {hardwareUnavailableReason}
        </div>
        <p className="mt-3"><b>NDEF URL preview</b></p>
        <p className="mt-1 break-all rounded-lg border border-white/10 bg-slate-900 p-2">{encodedUrl}</p>
        <p className="mt-2 text-slate-400">Este valor todavía no es un payload firmado ni confirma que una etiqueta haya sido escrita o leída.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <button type="button" disabled aria-describedby="encode-hardware-status" title={hardwareUnavailableReason} className="cursor-not-allowed rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-500">Write test · no disponible</button>
          <button type="button" disabled aria-describedby="encode-hardware-status" title={hardwareUnavailableReason} className="cursor-not-allowed rounded-lg border border-white/10 bg-slate-900 p-2 text-slate-500">Verify readback · requiere lector</button>
          <button type="button" disabled aria-describedby="encode-hardware-status" title="makeReadOnly es irreversible y solo se habilita en una estación autorizada." className="cursor-not-allowed rounded-lg border border-amber-300/20 bg-amber-500/5 p-2 text-amber-200/50">Advanced makeReadOnly · bloqueado</button>
        </div>
      </Card>
    </main>
  );
}
