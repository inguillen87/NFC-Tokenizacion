export const RUNTIME_CONSOLE_PROTOCOL = 'nexid.runtime-readiness.v1';
export const RUNTIME_SNAPSHOT_TTL_MS = 60_000;
const M = {
  support: '20260922100000_0112_support_ticket_workflow.sql',
  requests: '20260923120000_0113_supplier_requests.sql', reviews: '20260923150000_0114_supplier_request_reviews.sql',
  operator: '20260923180000_0115_supplier_operator_role_enum.sql', assignment: '20260923180100_0116_supplier_request_assignments.sql',
  cancellation: '20260924010000_0117_supplier_request_cancellation.sql', quotes: '20260924050000_0118_supplier_request_quotes.sql',
  binding: '20260924110000_0119_supplier_request_binding.sql', ack: '20260924150000_0120_supplier_delivery_ack.sql',
  ticketTypes: '20260924163000_0121_support_ticket_status_type_compatibility.sql',
} as const;
export const RUNTIME_CONSOLE_FEATURES = [
  {id:'support', label:'Soporte y tickets', migrations:[M.support], functions:['public.nexid_read_support_ticket_workflow_v1(uuid,uuid,text,bigint)']},
  {id:'requests', label:'Solicitudes y aclaraciones', migrations:[M.requests,M.reviews], functions:['public.nexid_mutate_supplier_request_v1(jsonb)','public.nexid_mutate_supplier_request_review_v1(jsonb)']},
  {id:'assignments', label:'Técnicos y asignaciones', migrations:[M.operator,M.assignment], functions:['public.nexid_supplier_requests_assigned_v1(uuid,uuid,integer)','public.nexid_mutate_supplier_request_assignment_v1(jsonb)']},
  {id:'cancellation', label:'Cancelación comercial', migrations:[M.cancellation], functions:['public.nexid_cancel_supplier_request_v1(jsonb)']},
  {id:'quotations', label:'Cotizaciones y aceptación', migrations:[M.cancellation,M.quotes], functions:['public.nexid_mutate_supplier_quote_v1(jsonb)','public.nexid_supplier_quote_read_v1(uuid,uuid,uuid,uuid,integer)']},
  {id:'supplier_binding', label:'Proveedor y especificación', migrations:[M.quotes,M.binding], functions:['public.nexid_mutate_supplier_binding_v1(jsonb)','public.nexid_supplier_binding_read_v1(uuid,uuid,uuid,uuid,integer)']},
  {id:'documentary_ack', label:'Acuse documental', migrations:[M.binding,M.ack], functions:['public.nexid_mutate_supplier_delivery_ack_v1(jsonb)','public.nexid_supplier_delivery_ack_read_v1(uuid,uuid,uuid,uuid,integer)']},
  {id:'ticket_type_compatibility', label:'Compatibilidad del estado de tickets', migrations:[M.ticketTypes], functions:['public.nexid_transition_support_ticket_v1(uuid,uuid,text,uuid,text,text,text,text,uuid)']},
] as const;
export type RuntimeFeatureId = typeof RUNTIME_CONSOLE_FEATURES[number]['id'];
export type RuntimeRequirementStatus = 'schema_or_ledger_missing' | 'execute_privilege_missing' | 'named_prerequisites_present';
export const RUNTIME_STATUS_LABELS: Record<RuntimeRequirementStatus,string> = {
  schema_or_ledger_missing:'Esquema o registro pendiente', execute_privilege_missing:'Permisos SQL pendientes',
  named_prerequisites_present:'Requisitos nombrados presentes',
};
const FLAG_IDS = ['cancellation','quotations','supplier_binding','documentary_ack'] as const;
const MIGRATIONS = [...new Set(RUNTIME_CONSOLE_FEATURES.flatMap(f=>[...f.migrations]))];
const migrationPattern = /^(?:\d{14}_)?\d{4}[a-z]?_[a-z0-9_]+\.sql$/;
const fail = ():never => { throw new Error('runtime_console_contract_invalid'); };
const object = (v:unknown):Record<string,unknown> => v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : fail();
const boolean = (v:unknown):boolean => typeof v==='boolean' ? v : fail();
const integer = (v:unknown, min=0, max=512):number => Number.isSafeInteger(v) && Number(v)>=min && Number(v)<=max ? Number(v) : fail();
const identifier = (v:unknown):string => typeof v==='string' && /^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/.test(v) ? v : fail();
function list(v:unknown,max:number,allowed:(s:string)=>boolean):string[] {
  if(!Array.isArray(v)||v.length>max||v.some(x=>typeof x!=='string'||!allowed(x))||new Set(v).size!==v.length)return fail();
  return [...v];
}
function same(a:readonly string[],b:readonly string[]) { return a.length===b.length && a.every(x=>b.includes(x)); }
function nullable(v:unknown, pattern:RegExp):string|null { return v===null ? null : typeof v==='string'&&pattern.test(v) ? v : fail(); }
export function parseRuntimeSnapshot(value:unknown, now=Date.now()) {
  const v=object(value);
  if(v.ok!==true||v.protocol!==RUNTIME_CONSOLE_PROTOCOL||v.scope!=='nexid_global_admin'||v.promotionAllowed!==false
    ||v.migrationExecutionAllowed!==false||v.customerRowsRead!==false||v.demo===true||v.demoMode===true||v.dataSource==='demo')return fail();
  const at=typeof v.observedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v.observedAt)?Date.parse(v.observedAt):NaN;
  if(!Number.isFinite(at)||at>now+30_000||now-at>=RUNTIME_SNAPSHOT_TTL_MS)return fail();
  const r=object(v.runtime),d=object(v.database),p=object(v.role),l=object(v.ledger),c=object(v.catalogs);
  if(!['production','preview','development','unverified'].includes(String(r.environment)))return fail();
  const runtime={environment:r.environment as 'production'|'preview'|'development'|'unverified',deploymentId:nullable(r.deploymentId,/^dpl_[A-Za-z0-9]{8,80}$/),commit:nullable(r.commit,/^[a-f0-9]{40}$/)};
  const database={name:identifier(d.name),sessionRole:identifier(d.sessionRole),loginRole:identifier(d.loginRole),endpointId:nullable(d.endpointId,/^ep-[a-z0-9-]{1,100}$/),serverVersionNumber:integer(d.serverVersionNumber,120000,999999),transactionReadOnly:boolean(d.transactionReadOnly)};
  const role={superuser:boolean(p.superuser),bypassRls:boolean(p.bypassRls),createRole:boolean(p.createRole),createDatabase:boolean(p.createDatabase),createInPublicSchema:boolean(p.createInPublicSchema),ownsDatabase:boolean(p.ownsDatabase),ownsPublicObjects:boolean(p.ownsPublicObjects)};
  const privilegedConnection=Object.values(role).some(Boolean);if(v.privilegedConnection!==privilegedConnection)return fail();
  const count=integer(l.count),requiredRuntimeMissing=list(l.requiredRuntimeMissing,128,x=>migrationPattern.test(x));
  if(l.fullRepositoryReconciliation!=='not_performed'||!Array.isArray(l.featureMigrations)||l.featureMigrations.length!==MIGRATIONS.length)return fail();
  const recorded=new Map<string,boolean>();
  for(const raw of l.featureMigrations){const m=object(raw);if(typeof m.id!=='string'||!(MIGRATIONS as readonly string[]).includes(m.id)||recorded.has(m.id))return fail();recorded.set(m.id,boolean(m.recorded));}
  if([...recorded.values()].filter(Boolean).length>count)return fail();
  const featureMigrations=MIGRATIONS.map(id=>({id,recorded:recorded.get(id)!}));
  const missingCarriers=list(c.missingCarriers,128,x=>/^[a-z0-9][a-z0-9_-]{0,100}$/.test(x));
  const missingLedgerProviders=list(c.missingLedgerProviders,3,x=>['none','polygon','iota'].includes(x));
  if(c.valuesOrPricesReturned!==false)return fail();
  const flags=object(v.featureFlags);if(!same(Object.keys(flags),FLAG_IDS))return fail();
  const featureFlags=Object.fromEntries(FLAG_IDS.map(id=>{const f=object(flags[id]),configured=boolean(f.configured),enabled=boolean(f.enabled);if(enabled&&!configured)return fail();return[id,{configured,enabled}];})) as Record<typeof FLAG_IDS[number],{configured:boolean;enabled:boolean}>;
  if(!Array.isArray(v.requirements)||v.requirements.length!==RUNTIME_CONSOLE_FEATURES.length)return fail();
  const source=new Map<string,Record<string,unknown>>();for(const raw of v.requirements){const f=object(raw);if(typeof f.id!=='string'||!RUNTIME_CONSOLE_FEATURES.some(x=>x.id===f.id)||source.has(f.id))return fail();source.set(f.id,f);}
  const requirements=RUNTIME_CONSOLE_FEATURES.map(feature=>{
    const f=source.get(feature.id)!;
    const missingMigrations=list(f.missingMigrations,10,x=>(feature.migrations as readonly string[]).includes(x));
    const missingFunctions=list(f.missingFunctions,4,x=>(feature.functions as readonly string[]).includes(x));
    const unavailableExecute=list(f.unavailableExecute,4,x=>(feature.functions as readonly string[]).includes(x));
    if(!same(missingMigrations,feature.migrations.filter(id=>!recorded.get(id)))||missingFunctions.some(x=>unavailableExecute.includes(x)))return fail();
    const status:RuntimeRequirementStatus=missingMigrations.length||missingFunctions.length?'schema_or_ledger_missing':unavailableExecute.length?'execute_privilege_missing':'named_prerequisites_present';
    if(f.status!==status)return fail();return{id:feature.id,status,missingMigrations,missingFunctions,unavailableExecute};
  });
  const enabledWithoutPrerequisites=requirements.filter(f=>featureFlags[f.id as typeof FLAG_IDS[number]]?.enabled&&f.status!=='named_prerequisites_present').map(f=>f.id);
  if(!same(list(v.enabledWithoutPrerequisites,4,x=>(FLAG_IDS as readonly string[]).includes(x)),enabledWithoutPrerequisites))return fail();
  const readiness=requiredRuntimeMissing.length||missingCarriers.length||missingLedgerProviders.length||requirements.some(f=>f.status!=='named_prerequisites_present')?'blocked_on_named_prerequisites':'further_acceptance_required';
  if(v.readiness!==readiness)return fail();
  return {ok:true as const,protocol:RUNTIME_CONSOLE_PROTOCOL,observedAt:new Date(at).toISOString(),scope:'nexid_global_admin' as const,runtime,database,role,privilegedConnection,
    ledger:{count,requiredRuntimeMissing,featureMigrations,fullRepositoryReconciliation:'not_performed' as const},
    catalogs:{missingCarriers,missingLedgerProviders,valuesOrPricesReturned:false as const},requirements,featureFlags,enabledWithoutPrerequisites,readiness,
    promotionAllowed:false as const,migrationExecutionAllowed:false as const,customerRowsRead:false as const};
}
export type RuntimeSnapshot=ReturnType<typeof parseRuntimeSnapshot>;
export function runtimeNextStep(snapshot:RuntimeSnapshot,id:RuntimeFeatureId):string {
  const f=snapshot.requirements.find(r=>r.id===id)!;
  if(f.status==='schema_or_ledger_missing')return 'Conciliar el esquema y el registro de migraciones antes de preparar un cambio. No ejecutar archivos por diferencia de cantidad.';
  if(f.status==='execute_privilege_missing')return 'Revisar el permiso de ejecución de las funciones indicadas. No ampliar el rol a dueño ni conceder permisos generales.';
  const flag=snapshot.featureFlags[id as typeof FLAG_IDS[number]];
  if(flag&&!flag.enabled)return 'El interruptor observado no está habilitado. Verificar publicación y aceptación antes de habilitar escrituras.';
  return 'Validar el recorrido autenticado y la compatibilidad del panel. Esta lectura no certifica que la funcionalidad esté publicada.';
}
/** Safe sharing excludes database, SQL users, endpoint and deployment identifiers. */
export function runtimeSupportSummary(snapshot:RuntimeSnapshot):string {
  return ['NexID · diagnóstico operativo',`Observación UTC: ${snapshot.observedAt}`,
    `Entorno declarado por la API: ${snapshot.runtime.environment}`,
    'Sólo requisitos nombrados. No autoriza migraciones ni publicación.',
    ...snapshot.requirements.map(f=>`${RUNTIME_CONSOLE_FEATURES.find(x=>x.id===f.id)!.label}: ${RUNTIME_STATUS_LABELS[f.status]}.`),
    `Funciones habilitadas sin requisitos: ${snapshot.enabledWithoutPrerequisites.length}.`,
    `Conexión con indicadores de privilegios amplios: ${snapshot.privilegedConnection?'sí':'no observados'}.`,
    'No incluye nombres de base, usuarios SQL, endpoint, identificadores de despliegue ni datos de clientes.',
  ].join('\n');
}

export function runtimeObservedTime(iso:string):string {
  return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'medium',timeZone:'UTC',hourCycle:'h23'}).format(new Date(iso));
}
export function runtimeSnapshotExpiresAt(iso:string,receivedAt:number):number {
  const at=Date.parse(iso);if(!Number.isFinite(at)||!Number.isFinite(receivedAt))return fail();
  return Math.min(at+RUNTIME_SNAPSHOT_TTL_MS,receivedAt+RUNTIME_SNAPSHOT_TTL_MS);
}