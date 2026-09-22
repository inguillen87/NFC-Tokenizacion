import React from "react";
import type { SupportTicketProjection } from "../lib/support-ticket-projection";

export function SupportTicketDetails({ ticket }: { ticket: SupportTicketProjection }) {
  return (
    <div className="min-w-0" data-testid="support-ticket-details" data-detail-format={ticket.detailFormat}>
      <dl className="mt-3 space-y-2 text-xs text-slate-400">
        <div>
          <dt className="font-semibold">Referencia del ticket</dt>
          <dd className="mt-1 select-text break-all font-mono text-slate-200" data-testid="support-ticket-reference">
            {ticket.reference || "Referencia no informada"}
          </dd>
        </div>
        {ticket.batch ? <div><dt className="font-semibold">Lote</dt><dd className="mt-1 break-all text-slate-200">{ticket.batch}</dd></div> : null}
        {ticket.event ? <div><dt className="font-semibold">Evento de lectura</dt><dd className="mt-1 break-all text-slate-200">{ticket.event}</dd></div> : null}
      </dl>
      {ticket.description ? ticket.detailFormat === "legacy" && ticket.description.length > 300 ? (
        <details className="mt-4 rounded-xl border border-white/10 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">Ver detalle completo del ticket</summary>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">{ticket.description}</p>
        </details>
      ) : (
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]" data-testid="support-ticket-description">{ticket.description}</p>
      ) : null}
    </div>
  );
}
