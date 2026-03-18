"use client";

import { useMemo, useState } from "react";
import { Card, SectionHeading } from "@product/ui";

export default function EncodeStationPage() {
  const [template, setTemplate] = useState("wine-secure");
  const [uid, setUid] = useState("04B7723401E2A0");
  const [readOnlyConfirm, setReadOnlyConfirm] = useState(false);

  const encodedUrl = useMemo(() => `https://nexid.lat/sun?tpl=${template}&uid=${uid}`, [template, uid]);

  return (
    <main className="space-y-4">
      <SectionHeading eyebrow="Encode" title="Encode Station" description="Builder NDEF + verificación para demos y pruebas" />
      <Card className="p-4">
        <label className="text-xs text-slate-400">Template</label>
        <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-white" value={template} onChange={(event) => setTemplate(event.target.value)}>
          <option value="wine-secure">wine-secure</option>
          <option value="events-basic">events-basic</option>
          <option value="docs-presence">docs-presence</option>
          <option value="cosmetics-secure">cosmetics-secure</option>
        </select>
        <label className="mt-3 block text-xs text-slate-400">UID</label>
        <input value={uid} onChange={(event) => setUid(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-white" />
      </Card>

      <Card className="p-4 text-xs text-slate-300">
        <p><b>NDEF URL preview</b></p>
        <p className="mt-1 break-all rounded-lg border border-white/10 bg-slate-900 p-2">{encodedUrl}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <button className="rounded-lg border border-white/10 bg-slate-900 p-2 text-white">Write test</button>
          <button className="rounded-lg border border-white/10 bg-slate-900 p-2 text-white">Verify readback</button>
          <button className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-2 text-amber-200" onClick={() => setReadOnlyConfirm((v) => !v)}>Advanced makeReadOnly</button>
        </div>
        {readOnlyConfirm ? <p className="mt-2 text-rose-300">Confirmación extrema: irreversible. Solo modo avanzado.</p> : null}
      </Card>
    </main>
  );
}
