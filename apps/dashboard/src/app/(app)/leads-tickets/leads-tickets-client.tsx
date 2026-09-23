"use client";

import React, { useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AssistantRecords } from "../../../components/assistant-records";
import { CustomerInboxNotice } from "../../../components/customer-inbox-notice";
import { buildAssistantLedger } from "../../../lib/assistant-records";
import { confirmCustomerInbox, customerRecordText, customerRecordDate, customerRecordQuantity } from "../../../lib/customer-inbox-state";
import { customerInboxCopy } from "../../../lib/customer-inbox-copy";
import inboxStyles from "../../../components/customer-inbox.module.css";
import { CustomerActivitySummary } from "../../../components/customer-activity-summary";
import { buildCustomerActivitySummary, customerActivityDestination, type CustomerActivityKind } from "../../../lib/customer-activity-summary";
import { CustomerMemberTimeline } from "../../../components/customer-member-timeline";
import { CustomerSignalTimeline } from "../../../components/customer-signal-timeline";
import { DataTable } from "../../../components/data-table";
import { TicketReferenceLookup, type TicketReferenceLookupHandle } from "../../../components/ticket-reference-lookup";
import { ticketEntryReference, ticketEntryCopy } from "../../../lib/ticket-entry";
import type { TicketLookupLocale } from "../../../lib/ticket-reference-lookup";
import { SUPPORT_TICKET_COLUMNS, supportTicketTableRow, supportTicketRowMatchesQuery } from "../../../lib/support-ticket-projection";
import type {
  CustomerMember,
  CustomerMemberDirectoryState,
  CustomerMemberTimelineState,
} from "../../../lib/customer-member-timeline";
import {
  authoritativeLeadTenant,
  buildCustomerSignalTimeline,
  type CustomerLeadRecord,
  type CustomerOrderRecord,
  type CustomerSignalCollections,
  type CustomerTicketRecord,
} from "../../../lib/customer-signal-timeline";
import { Search } from "lucide-react";

type Lead = CustomerLeadRecord;
type Ticket = CustomerTicketRecord;
type Order = CustomerOrderRecord;

interface LeadsTicketsClientProps {
  initialLeads: Lead[];
  initialTickets: Ticket[];
  initialOrders: Order[];
  filteredOpportunities: any[];
  tenantScope: string;
  sessionFilter: string;
  tenantFilter: string;
  copy: any;
  labels: any;
  demoMode: boolean;
  locale?: TicketLookupLocale;
  canLookupTickets?: boolean;
  leadsSource: "production" | "demo" | "unavailable";
  signalCollections: CustomerSignalCollections;
  members: CustomerMember[];
  memberDirectory: CustomerMemberDirectoryState;
  selectedMemberId: string;
  memberTimeline: CustomerMemberTimelineState;
}

export default function LeadsTicketsClient({
  initialLeads: leadsInput,
  initialTickets: ticketsInput,
  initialOrders: ordersInput,
  filteredOpportunities: opportunitiesInput,
  tenantScope,
  sessionFilter,
  tenantFilter,
  copy,
  labels,
  demoMode,
  locale = "es-AR",
  canLookupTickets = false,
  leadsSource,
  signalCollections: inputCollections,
  members,
  memberDirectory,
  selectedMemberId,
  memberTimeline,
}: LeadsTicketsClientProps) {
  const [activeTab, setActiveTab] = useState<"signals" | "opportunities" | "prospects" | "tickets" | "orders" | "ai_queries">("signals");
  const [searchTerm, setSearchTerm] = useState("");
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const ticketLookup = useRef<TicketReferenceLookupHandle>(null);
  const ticketContext = JSON.stringify([tenantScope, demoMode, canLookupTickets]);
  const [ticketLock, setTicketLock] = useState({ context: ticketContext, locked: false });
  const ticketNavigationLocked = ticketLock.context === ticketContext && ticketLock.locked;
  const entryCopy = ticketEntryCopy[locale];
  const navigationBlocked = () => ticketLookup.current?.isNavigationLocked() === true;
  const ui = customerInboxCopy[locale];
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const retry = () => { if (!navigationBlocked()) startRefresh(() => router.refresh()); };
  const context = useMemo(() => ({ tenantScope, demoMode }), [tenantScope, demoMode]);
  const inboxes = useMemo(() => ({
    leads: confirmCustomerInbox<Lead>("leads", leadsInput, inputCollections.leads.availability !== "ready" || inputCollections.leads.source === leadsSource ? inputCollections.leads : { availability: "invalid_payload", source: "unavailable" }, context),
    tickets: confirmCustomerInbox<Ticket>("tickets", ticketsInput, inputCollections.tickets, context),
    orders: confirmCustomerInbox<Order>("orders", ordersInput, inputCollections.orders, context),
  }), [leadsInput, ticketsInput, ordersInput, inputCollections, leadsSource, context]);
  const initialLeads = inboxes.leads.rows, initialTickets = inboxes.tickets.rows, initialOrders = inboxes.orders.rows;
  const signalCollections = inboxes;
  const entryReference = (value: unknown) => ticketEntryReference(value, inboxes.tickets, tenantScope, demoMode, canLookupTickets);
  function openTicket(value: string) {
    const reference = entryReference(value);
    if (!reference || navigationBlocked() || !ticketLookup.current?.open(reference)) return;
    setActiveTab("tickets");
  }
  const filteredOpportunities = useMemo(() => {
    const valid = new Map(initialLeads.map(row => [JSON.stringify([authoritativeLeadTenant(row), row.id]), row]));
    return opportunitiesInput.flatMap(item => {
      if (!item?.lead || typeof item.lead.id !== "string") return [];
      const lead = valid.get(JSON.stringify([authoritativeLeadTenant(item.lead), item.lead.id]));
      return lead ? [{ ...item, lead }] : [];
    });
  }, [initialLeads, opportunitiesInput]);
  const ledger = useMemo(() => buildAssistantLedger(initialLeads, inboxes.leads, context), [initialLeads, inboxes.leads, context]);

  const activitySummary = useMemo(() => buildCustomerActivitySummary({
    leads: initialLeads, tickets: initialTickets, orders: initialOrders,
    collections: signalCollections, tenantScope, demoMode,
  }), [initialLeads, initialTickets, initialOrders, signalCollections, tenantScope, demoMode]);
  function openActivity(kind: CustomerActivityKind) {
    if (navigationBlocked()) return;
    if (activitySummary.cards.find(card => card.kind === kind)?.count == null) return;
    setSearchTerm("");
    setActiveTab(customerActivityDestination(kind));
    // Focus stays within the existing workspace. No URL, fetch, or write is needed.
    contentRef.current?.focus();
  }

  const customerSignals = useMemo(() => buildCustomerSignalTimeline({
    leads: initialLeads,
    tickets: initialTickets,
    orders: initialOrders,
    collections: signalCollections,
  }), [initialLeads, initialOrders, initialTickets, signalCollections]);

  const tabs = ["signals", "opportunities", "prospects", "tickets", "orders", "ai_queries"] as const;
  const countFor = (tab: typeof activeTab): number | null => {
    if (tab === "ai_queries") return ledger.loadedCount;
    if (tab === "signals") return Object.values(inboxes).every(state => state.availability === "ready") ? customerSignals.length : null;
    const state = tab === "tickets" ? inboxes.tickets : tab === "orders" ? inboxes.orders : inboxes.leads;
    return state.availability === "ready" ? (tab === "opportunities" ? filteredOpportunities.length : state.rows.length) : null;
  };
  const tabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: typeof activeTab) => {
    if (navigationBlocked()) { event.preventDefault(); return; }
    const index = tabs.indexOf(tab);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
      : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setActiveTab(tabs[next]);
    document.getElementById(`${contentId}-${tabs[next]}`)?.focus();
  };

  return (
    <div className="space-y-6">
      <CustomerActivitySummary summary={activitySummary} locale={locale} onOpen={openActivity} controls={contentId} disabled={ticketNavigationLocked} />

      <div className={`${inboxStyles.root} ${inboxStyles.navigation}`}>
        <div className={inboxStyles.tabs} role="tablist" aria-label={ui.tabs}>
          {tabs.map(tab => <button key={tab} id={`${contentId}-${tab}`} type="button" role="tab"
            aria-selected={activeTab === tab} aria-controls={contentId} tabIndex={activeTab === tab ? 0 : -1}
            disabled={ticketNavigationLocked && activeTab !== tab} className={inboxStyles.tab} onClick={() => { if (!navigationBlocked()) setActiveTab(tab); }} onKeyDown={event => tabKeyDown(event, tab)}>
            {ui[tab]} <span aria-label={countFor(tab) === null ? ui.unknownCount : undefined}>({countFor(tab) ?? "—"})</span>
          </button>)}
        </div>
        <label className={inboxStyles.search}>
          <Search aria-hidden="true" size={16} />
          <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)}
            aria-label={ui.search} placeholder={ui.searchPlaceholder} />
        </label>
      </div>
      {ticketNavigationLocked ? <p role="status" data-testid="ticket-entry-lock-notice" className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm leading-6 text-slate-200">{entryCopy.locked}</p> : null}

      {/* Tab Contents */}
      {activeTab === "tickets" || activeTab === "signals" ? (
        <p className="px-2 text-xs leading-5 text-slate-400">
          {activeTab === "tickets"
            ? ui.ticketHint
            : ui.signalHint}
        </p>
      ) : null}
      <div id={contentId} ref={contentRef} role="tabpanel" aria-labelledby={`${contentId}-${activeTab}`} tabIndex={-1} className="animate-in fade-in slide-in-from-top-1 duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500">
        {((activeTab === "opportunities" || activeTab === "prospects") && inboxes.leads.availability !== "ready") || (activeTab === "orders" && inboxes.orders.availability !== "ready") ? (
          <CustomerInboxNotice state={activeTab === "orders" ? inboxes.orders : inboxes.leads} locale={locale} onRetry={retry} pending={refreshing} />
        ) : null}
        {activeTab === "signals" && (
          <div className="space-y-6">
            <CustomerMemberTimeline
              tenantScope={tenantScope}
              members={members}
              directory={memberDirectory}
              selectedMemberId={selectedMemberId}
              timeline={memberTimeline}
            />
            <CustomerSignalTimeline
              signals={customerSignals}
              collections={signalCollections}
              query={searchTerm}
              ticketEntry={{ label: entryCopy.open, available: value => Boolean(entryReference(value)), disabled: ticketNavigationLocked, onOpen: openTicket }}
            />
          </div>
        )}

        {activeTab === "opportunities" && inboxes.leads.availability === "ready" && (
          <DataTable
            title={ui.opportunities}
            columns={[
              { key: "created_at", label: "Fecha" },
              { key: "tenant", label: "Tenant" },
              { key: "session", label: "Sesión Demo" },
              { key: "interest", label: "Interés" },
              { key: "source", label: "Fuente" },
              { key: "status", label: "Estado" },
            ]}
            rows={filteredOpportunities
              .filter(item => {
                const searchStr = `${item.tenant || ""} ${item.session || ""} ${item.interest || ""} ${item.source || ""}`.toLowerCase();
                return searchStr.includes(searchTerm.toLowerCase());
              })
              .map((item) => ({
                created_at: customerRecordDate(item.lead.created_at, ui.missing),
                tenant: item.tenant || "-",
                session: item.session || "-",
                interest: item.interest || "-",
                source: item.source,
                status: customerRecordText(item.lead.status, ui.missing),
              }))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay oportunidades comerciales con los filtros aplicados"
            searchPlaceholder="Filtrar por columna..."
            allFilterLabel={copy.shell.all}
            refreshLabel={copy.shell.refresh}
            statusMap={copy.statuses}
          />
        )}

        {activeTab === "prospects" && inboxes.leads.availability === "ready" && (
          <DataTable
            title={ui.prospects}
            columns={[
              { key: "name", label: "Nombre" },
              { key: "contact", label: "Contacto" },
              { key: "company", label: "Empresa" },
              { key: "vertical", label: "Vertical" },
              { key: "status", label: "Estado" },
              { key: "source", label: "Fuente" },
              { key: "estimated", label: "Vol. Estimado" }
            ]}
            rows={initialLeads
              .filter(l => {
                const searchStr = `${l.name || ""} ${l.contact || ""} ${l.company || ""} ${l.vertical || ""} ${l.notes || ""}`.toLowerCase();
                return searchStr.includes(searchTerm.toLowerCase());
              })
              .map((item) => ({
                name: item.name || "-",
                contact: item.contact || item.email || item.phone || "-",
                company: item.company || "-",
                vertical: item.vertical || "-",
                status: customerRecordText(item.status, ui.missing),
                source: customerRecordText(item.source, ui.missing),
                estimated: item.estimated_volume || "-",
              }))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay prospectos registrados"
            searchPlaceholder="Filtrar..."
            allFilterLabel={copy.shell.all}
            refreshLabel={copy.shell.refresh}
            statusMap={copy.statuses}
          />
        )}

          <div hidden={activeTab !== "tickets"} className="space-y-6">
          <TicketReferenceLookup key={ticketContext} ref={ticketLookup} tenantScope={tenantScope} locale={locale} isDemo={demoMode} canLookup={canLookupTickets}
            onNavigationLockChange={locked => setTicketLock({ context: ticketContext, locked })} />
          {activeTab === "tickets" && (inboxes.tickets.availability !== "ready" ? <CustomerInboxNotice state={inboxes.tickets} locale={locale} onRetry={retry} pending={refreshing} /> : <DataTable
            title={ui.tickets}
            columns={SUPPORT_TICKET_COLUMNS}
            rows={initialTickets
              .map(supportTicketTableRow)
              .filter(row => supportTicketRowMatchesQuery(row, searchTerm))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay tickets de soporte para este filtro"
            searchPlaceholder="Referencia, lote o detalle"
            allFilterLabel={copy.shell.all}
            refreshLabel={copy.shell.refresh}
            statusMap={copy.statuses}
            refreshDisabled={ticketNavigationLocked}
            rowAction={{ label: entryCopy.open, heading: entryCopy.actions, testId: "ticket-entry-row", available: row => Boolean(entryReference(row.reference)), disabled: ticketNavigationLocked, onClick: row => openTicket(row.reference) }}
          />)}
          </div>

        {activeTab === "orders" && inboxes.orders.availability === "ready" && (
          <DataTable
            title={ui.orders}
            columns={[
              { key: "created_at", label: "Fecha" },
              { key: "contact", label: "Contacto" },
              { key: "company", label: "Empresa" },
              { key: "tag_type", label: "Tipo Tag" },
              { key: "volume", label: "Cantidad" },
              { key: "status", label: "Estado" }
            ]}
            rows={initialOrders
              .filter(o => {
                const searchStr = `${o.contact || ""} ${o.company || ""} ${o.tag_type || ""} ${o.notes || ""}`.toLowerCase();
                return searchStr.includes(searchTerm.toLowerCase());
              })
              .map((item) => ({
                created_at: customerRecordDate(item.created_at, ui.missing),
                contact: item.contact,
                company: item.company || "-",
                tag_type: item.tag_type || "-",
                volume: customerRecordQuantity(item.volume, ui.missing),
                status: customerRecordText(item.status, ui.missing),
              }))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay pedidos de muestras registrados"
            searchPlaceholder="Filtrar..."
            allFilterLabel={copy.shell.all}
            refreshLabel={copy.shell.refresh}
            statusMap={copy.statuses}
          />
        )}

        {activeTab === "ai_queries" && (
          <AssistantRecords key={`${tenantScope}|${demoMode}`} ledger={ledger} query={searchTerm} locale={locale}
            onRetry={retry} pending={refreshing} onClear={() => setSearchTerm("")} />
        )}
      </div>
    </div>
  );
}
