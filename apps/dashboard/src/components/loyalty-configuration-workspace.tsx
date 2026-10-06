"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildConfigurationCommand, configurationDate, configurationErrorCopy, configurationReconciliation, configurationState, dateInput, explicitInteger,
  isConfigurationResource, isPublished, parseLoyaltyConfiguration, POST_TAP_SERVICES,
  type ConfigurationAction, type ConfigurationCommand, type ConfigurationKind, type ConfigurationProgram,
  type ConfigurationQuestion, type ConfigurationQuiz, type ConfigurationResource, type LoyaltyConfiguration,
} from "../lib/loyalty-configuration";
import styles from "./loyalty-configuration-workspace.module.css";

const verticals = { wine: "Vinos", spirits: "Destilados", events: "Eventos", cosmetics: "Cosmética", agro: "Agro", pharma: "Farmacéutica", luxury: "Lujo", art: "Arte", documents: "Documentos" };
const serviceCopy = {
  lead: ["Contactar a la marca", "Consultas sobre este producto y sus servicios."],
  feedback: ["Dejar una opinión", "Comentarios dirigidos a esta marca."],
  sommelier: ["Asesor de la marca", "Orientación sobre los productos de esta marca."],
  marketplace: ["Consultar compra", "Requiere además un catálogo publicado y una lectura apta según la política comercial."],
};
type Fields = { name: string; vertical: string; pointsName: string; pointsPerValidTap: string; cooldownSeconds: string; start: string; end: string;
  programId: string; title: string; description: string; pointsPerCorrect: string; completionBonus: string; passThreshold: string; questions: ConfigurationQuestion[]; allowedActions: string[] };
const blank: Fields = { name: "", vertical: "", pointsName: "", pointsPerValidTap: "", cooldownSeconds: "", start: "", end: "", programId: "", title: "", description: "", pointsPerCorrect: "0", completionBonus: "0", passThreshold: "0", questions: [], allowedActions: [] };
function fieldsOf(resource: ConfigurationResource): Fields {
  if ("allowedActions" in resource) return { ...blank, allowedActions: [...resource.allowedActions] };
  if ("pointsName" in resource) return { ...blank, name: resource.name, vertical: resource.vertical, pointsName: resource.pointsName,
    pointsPerValidTap: resource.pointsPerValidTap === null ? "" : String(resource.pointsPerValidTap), cooldownSeconds: resource.cooldownSeconds === null ? "" : String(resource.cooldownSeconds), start: dateInput(resource.startAt), end: dateInput(resource.endAt) };
  return { ...blank, programId: resource.programId, title: resource.title, description: resource.description, vertical: resource.vertical,
    start: dateInput(resource.startsAt), end: dateInput(resource.endsAt), pointsPerCorrect: String(resource.pointsPerCorrect), completionBonus: String(resource.completionBonus), passThreshold: String(resource.passThreshold), questions: resource.questions.map(q => ({ ...q, options: [...q.options] })) };
}
function resourceIn(data: LoyaltyConfiguration, kind: ConfigurationKind, resource: ConfigurationResource) {
  return kind === "profile" ? data.profile : (kind === "program" ? data.programs : data.quizzes).find(r => "id" in resource && r.id === resource.id) || null;
}
function putResource(data: LoyaltyConfiguration, kind: ConfigurationKind, resource: ConfigurationResource): LoyaltyConfiguration {
  if (kind === "profile") return { ...data, profile: resource as LoyaltyConfiguration["profile"] };
  const key = kind === "program" ? "programs" : "quizzes";
  const rows = data[key] as Array<ConfigurationProgram | ConfigurationQuiz>;
  return { ...data, [key]: [...rows.filter(r => "id" in resource && r.id !== resource.id), resource] };
}

export default function LoyaltyConfigurationWorkspace({ tenant, canWrite, canSelectTenant, initialData, initialReason = "", isDemo = false }: {
  tenant: string; canWrite: boolean; canSelectTenant: boolean; initialData: LoyaltyConfiguration | null; initialReason?: string; isDemo?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [kind, setKind] = useState<ConfigurationKind>("profile");
  const [resource, setResource] = useState<ConfigurationResource | null>(initialData?.profile || null);
  const [fields, setFields] = useState<Fields>(initialData ? fieldsOf(initialData.profile) : { ...blank });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialReason ? configurationErrorCopy(initialReason) : "");
  const [error, setError] = useState(Boolean(initialReason));
  const [pending, setPending] = useState<ConfigurationCommand | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [reviewed, setReviewed] = useState<ConfigurationResource | null>(null);
  const [didRead, setDidRead] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfigurationAction | null>(null);
  const lock = useRef(false);
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message && error) notice.current?.focus(); }, [message, error]);
  useEffect(() => {
    if (!dirty && !uncertain) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, uncertain]);
  const endpoint = `/api/admin/loyalty/configuration?${new URLSearchParams({ tenant })}`;
  const legacy = kind === "quiz" && resource && "managed" in resource && !resource.managed;
  const bindingMissing = kind === "quiz" && resource && "programId" in resource && resource.revision && !data?.programs.some(p => p.id === resource.programId);
  const published = resource && isPublished(resource);
  const archived = resource?.status === "archived";
  const editable = canWrite && Boolean(data && resource) && !published && !archived && !legacy && !bindingMissing && !busy && !uncertain;
  function inform(text: string, isError = false) { setMessage(text); setError(isError); }
  function adopt(next: ConfigurationResource | null, nextKind = kind) {
    setKind(nextKind); setResource(next); setFields(next ? fieldsOf(next) : { ...blank }); setDirty(false); setPending(null); setUncertain(false); setReviewed(null); setDidRead(false); setConfirmAction(null);
  }
  function choose(nextKind: ConfigurationKind, next: ConfigurationResource | null) {
    if (dirty || uncertain) { inform("Tu formulario sigue aquí. Guardá el borrador o descartá los cambios antes de cambiar de sección.", true); return; }
    adopt(next, nextKind); inform("");
  }
  function change<K extends keyof Fields>(key: K, value: Fields[K]) { if (!editable) return; setFields(f => ({ ...f, [key]: value })); setDirty(true); setConfirmAction(null); }
  function create(nextKind: "program" | "quiz") {
    if (!canWrite || !data || busy || uncertain || dirty) { if (dirty) inform("Guardá o descartá el formulario actual antes de crear otro borrador.", true); return; }
    const common = { id: crypto.randomUUID(), revision: "", lastOperationId: null, vertical: "", status: "draft" };
    const next: ConfigurationResource = nextKind === "program" ? { ...common, name: "", pointsName: "", pointsPerValidTap: null, cooldownSeconds: null, startAt: null, endAt: null }
      : { ...common, programId: "", title: "", description: "", startsAt: null, endsAt: null, questions: [], pointsPerCorrect: 0, completionBonus: 0, passThreshold: 0, managed: true };
    adopt(next, nextKind); inform("Nuevo borrador sin guardar. No se muestra a clientes ni otorga puntos.");
  }
  function commandFields(): Record<string, unknown> {
    if (kind === "profile") return { allowedActions: fields.allowedActions };
    const savedStart = resource && "startAt" in resource ? resource.startAt : resource && "startsAt" in resource ? resource.startsAt : null;
    const savedEnd = resource && "endAt" in resource ? resource.endAt : resource && "endsAt" in resource ? resource.endsAt : null;
    const start = savedStart && fields.start === dateInput(savedStart) ? savedStart : configurationDate(fields.start);
    const end = savedEnd && fields.end === dateInput(savedEnd) ? savedEnd : configurationDate(fields.end);
    if (kind === "program") return { name: fields.name, pointsName: fields.pointsName, vertical: fields.vertical, startAt: start, endAt: end,
      pointsPerValidTap: fields.pointsPerValidTap.trim() ? explicitInteger(fields.pointsPerValidTap) : null, cooldownSeconds: fields.cooldownSeconds.trim() ? explicitInteger(fields.cooldownSeconds) : null };
    return { title: fields.title, description: fields.description, vertical: fields.vertical, programId: fields.programId, startsAt: start, endsAt: end,
      pointsPerCorrect: explicitInteger(fields.pointsPerCorrect), completionBonus: explicitInteger(fields.completionBonus), passThreshold: explicitInteger(fields.passThreshold), questions: fields.questions };
  }
  async function send(action: ConfigurationAction, retry?: ConfigurationCommand) {
    if (!resource || !data || !canWrite || bindingMissing || lock.current || (uncertain && !retry)) return;
    let command: ConfigurationCommand;
    try { command = retry || buildConfigurationCommand(kind, action, resource, crypto.randomUUID(), action === "withdraw" ? {} : commandFields()); }
    catch (e) { inform(configurationErrorCopy(e instanceof Error ? e.message : "configuration_invalid"), true); setConfirmAction(null); return; }
    lock.current = true; setBusy(true); setPending(command); setConfirmAction(null); setDidRead(false); setReviewed(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok === true && body.tenant === tenant && isConfigurationResource(kind, body.resource)
        && (kind === "profile" || body.resource.id === command.id)
        && (kind !== "quiz" || body.resource.programId === (command.programId ?? ("programId" in resource ? resource.programId : undefined)))
        && body.resource.lastOperationId === command.operationId && typeof body.idempotentReplay === "boolean") {
        setData(putResource(data, kind, body.resource)); adopt(body.resource); inform(action === "withdraw" ? "Retiro confirmado. Ahora podés editar; el historial se conserva." : action === "publish" ? "Publicación confirmada. Se aplican además las fechas y políticas de acceso." : "Borrador guardado. Todavía no está publicado.");
      } else if (response.status < 500 && body?.ok === false && typeof body.reason === "string") {
        setPending(null); setUncertain(false); inform(configurationErrorCopy(body.reason), true);
      } else {
        setUncertain(true); inform("No se confirmó la respuesta del guardado. Tu formulario sigue aquí. Consultá el estado guardado para verificar esta operación; no se reenvía automáticamente.", true);
      }
    } catch { setUncertain(true); inform("Se interrumpió la respuesta del guardado. Tu formulario sigue aquí. Consultá el estado guardado antes de continuar.", true); }
    finally { lock.current = false; setBusy(false); }
  }
  async function refresh() {
    if (!tenant || isDemo || lock.current) return;
    lock.current = true; setBusy(true); setConfirmAction(null);
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const body = await response.json().catch(() => null);
      const next = response.ok ? parseLoyaltyConfiguration(body, tenant) : null;
      if (!next) { inform(configurationErrorCopy(body?.reason), true); return; }
      setData(next);
      const saved = resource ? resourceIn(next, kind, resource) : kind === "profile" ? next.profile : null;
      if (uncertain && pending && configurationReconciliation(saved, pending) === "confirmed") {
        adopt(saved); inform("Operación confirmada al consultar el estado guardado. No se volvió a enviar.");
      } else if (dirty || uncertain || resource && saved?.revision !== resource.revision) {
        setReviewed(saved); setDidRead(true); inform(uncertain ? "Consulta completada. Esta operación no quedó confirmada: revisá la versión guardada. El formulario y la operación original se conservan." : "Consulta completada. Tu formulario se conserva; podés compararlo con la versión guardada.");
      } else { adopt(saved); inform("Estado guardado actualizado."); }
    } catch { inform("No pudo consultarse el estado guardado. Tu formulario sigue aquí; reintentá la consulta.", true); }
    finally { lock.current = false; setBusy(false); }
  }
  function questionChange(index: number, update: Partial<ConfigurationQuestion>) { change("questions", fields.questions.map((q, i) => i === index ? { ...q, ...update } : q)); }
  function removeOption(questionIndex: number, optionIndex: number) {
    const q = fields.questions[questionIndex];
    questionChange(questionIndex, { options: q.options.filter((_, i) => i !== optionIndex), correctIndex: q.correctIndex === optionIndex ? 0 : q.correctIndex > optionIndex ? q.correctIndex - 1 : q.correctIndex });
  }
  const zone = "UTC (hora universal)";
  const currentProgram = data?.programs.find(p => p.id === fields.programId);
  return <main className={styles.root} data-testid="loyalty-configuration-workspace" aria-busy={busy}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Configuración de la marca</p><h1>Servicios, puntos y trivias</h1><p>Definí qué ofrece tu marca después de una lectura. Guardar un borrador no lo publica.</p></div><span className={styles.scope}>{tenant || "Empresa sin seleccionar"}</span></header>
    {canSelectTenant && <form action="/loyalty/configuration" method="GET" className={styles.tenantForm}><label>Empresa<input name="tenant" defaultValue={tenant} required pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*" maxLength={128} disabled={busy || dirty || uncertain} placeholder="Identificador de la empresa" /></label><button disabled={busy || dirty || uncertain}>Consultar empresa</button></form>}
    {!tenant ? <p className={styles.note}>Seleccioná una empresa para consultar y editar su configuración. Esta pantalla no realiza cambios globales.</p> : null}
    {isDemo ? <p className={styles.notice}>El entorno de demostración no consulta ni guarda esta configuración de clientes.</p> : !canWrite && tenant ? <p className={styles.notice}>Tenés acceso de consulta. Este perfil no puede guardar, publicar ni retirar configuraciones.</p> : null}
    {message && <div ref={notice} tabIndex={-1} role={error ? "alert" : "status"} className={error ? styles.error : styles.notice}>{message}</div>}
    {tenant && !isDemo && <div className={styles.toolbar}><button type="button" disabled={busy} onClick={() => void refresh()}>Consultar estado guardado</button>{dirty && !uncertain && <button type="button" disabled={busy} onClick={() => { adopt(resource?.revision ? resource : null); inform("Cambios sin guardar descartados."); }}>Descartar cambios sin guardar</button>}</div>}
    {!data ? <p className={styles.note}>La configuración no está disponible. Completá el perfil de marca o reintentá la consulta; no se reemplaza con reglas de ejemplo.</p> : <>
      <nav aria-label="Secciones de configuración" className={styles.tabs}>{(["profile", "program", "quiz"] as const).map((tab, i) => <button key={tab} type="button" aria-pressed={kind === tab} disabled={busy || uncertain} onClick={() => choose(tab, tab === "profile" ? data.profile : null)}>{["Servicios post-tap", "Programa de puntos", "Trivias"][i]}</button>)}</nav>
      {(data.limits?.programsTruncated || data.limits?.quizzesTruncated) && <p className={styles.notice}>Consulta limitada: hay {data.limits.programsTruncated ? "programas" : ""}{data.limits.programsTruncated && data.limits.quizzesTruncated ? " y " : ""}{data.limits.quizzesTruncated ? "trivias" : ""} anteriores fuera de esta lista. Las asociaciones y el historial se conservan.</p>}
      {kind !== "profile" && <p className={styles.note}>Esta consulta incluye hasta 100 programas y 300 trivias recientes. Una configuración anterior puede quedar fuera de la lista; no se elige ni reasigna otro programa por esa ausencia.</p>}
      {kind !== "profile" && <div className={styles.toolbar}><label>{kind === "program" ? "Programa guardado" : "Trivia guardada"}<select aria-label={kind === "program" ? "Programa guardado" : "Trivia guardada"} value={resource && "id" in resource && resource.revision ? resource.id : ""} disabled={busy || uncertain} onChange={e => choose(kind, (kind === "program" ? data.programs : data.quizzes).find(r => r.id === e.target.value) || null)}><option value="">Elegí una configuración</option>{(kind === "program" ? data.programs : data.quizzes).map(r => <option key={r.id} value={r.id}>{("name" in r ? r.name : r.title) || "Sin título"} · {configurationState(r)}</option>)}</select></label>{canWrite && <button type="button" disabled={busy || uncertain} onClick={() => create(kind === "program" ? "program" : "quiz")}>{kind === "program" ? "Crear programa" : "Crear trivia"}</button>}</div>}
      {resource ? <section className={styles.card} aria-label="Editor de configuración"><div className={styles.title}><h2>{kind === "profile" ? "Servicios de esta marca" : kind === "program" ? "Reglas del programa" : "Contenido de la trivia"}</h2><span className={styles.badge}>{resource.revision ? configurationState(resource) : "Borrador sin guardar"}</span></div>
        {published && <p className={styles.notice}>Esta configuración está publicada. Retirala antes de editar; el retiro conserva el historial.</p>}
        {legacy && <p className={styles.notice}>Trivia específica de producto. Esta pantalla la muestra en consulta; conserva prioridad sobre una trivia general que coincida con ese producto.</p>}
        {bindingMissing && <p className={styles.notice}>El programa asociado a esta trivia no está incluido en la consulta. Su vínculo se conserva y la trivia queda sólo para lectura. Solicitá al administrador consultar ese programa antes de editar.</p>}
        {archived && <p className={styles.notice}>Configuración archivada, disponible sólo para consulta.</p>}
        <fieldset disabled={!editable} className={styles.fields}><legend className={styles.srOnly}>Campos de {kind === "profile" ? "servicios" : kind === "program" ? "programa" : "trivia"}</legend>
          {kind === "profile" ? <><p className={styles.note}>Estos servicios pertenecen a tu marca. Las promociones y campañas se administran en sus pantallas.</p><div className={styles.services}>{POST_TAP_SERVICES.map(service => <label key={service} className={styles.checkbox}><input type="checkbox" checked={fields.allowedActions.includes(service)} onChange={e => change("allowedActions", e.target.checked ? [...fields.allowedActions, service] : fields.allowedActions.filter(s => s !== service))} /><span><strong>{serviceCopy[service][0]}</strong><small>{serviceCopy[service][1]}</small></span></label>)}</div></> : <>
            {kind === "quiz" && <><label>Programa de la trivia<select aria-label="Programa de la trivia" value={fields.programId} disabled={!editable || Boolean(resource.revision)} onChange={e => change("programId", e.target.value)}><option value="">Elegí un programa guardado</option>{bindingMissing && <option value={fields.programId}>Programa asociado fuera de esta consulta</option>}{data.programs.map(p => <option key={p.id} value={p.id}>{p.name || "Sin nombre"} · {configurationState(p)}</option>)}</select></label><p className={styles.note}>La trivia permanece ligada a este programa. {currentProgram ? `Estado del programa: ${configurationState(currentProgram)}.` : "Guardá un programa antes de crear su trivia."} Publicar la trivia no activa el programa.</p></>}
            <div className={styles.grid}><label>{kind === "program" ? "Nombre del programa" : "Título de la trivia"}<input value={kind === "program" ? fields.name : fields.title} maxLength={kind === "program" ? 120 : 160} onChange={e => change(kind === "program" ? "name" : "title", e.target.value)} /></label><label>Vertical<select aria-label="Vertical" value={fields.vertical} onChange={e => change("vertical", e.target.value)}><option value="">Elegí la vertical</option>{fields.vertical && !(fields.vertical in verticals) && <option value={fields.vertical}>{fields.vertical} · valor anterior</option>}{Object.entries(verticals).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            {kind === "program" ? <><label>Nombre de los puntos<input value={fields.pointsName} maxLength={60} onChange={e => change("pointsName", e.target.value)} placeholder="Nombre que verá el cliente" /></label><div className={styles.grid}><label>Puntos por lectura válida<input type="number" min="0" max="10000" step="1" value={fields.pointsPerValidTap} onChange={e => change("pointsPerValidTap", e.target.value)} placeholder="Sin configurar" /></label><label>Espera entre lecturas (segundos)<input type="number" min="0" max="604800" step="1" value={fields.cooldownSeconds} onChange={e => change("cooldownSeconds", e.target.value)} placeholder="Sin configurar" /></label></div><p className={styles.note}>{fields.pointsPerValidTap === "0" ? "Cero puntos: las lecturas no otorgan puntos." : "Las reglas vacías pueden guardarse como borrador; para publicar se requieren valores explícitos."} La espera limita la repetición de puntos por lectura. Cero segundos desactiva esa espera.</p></> : <><label>Descripción<textarea aria-label="Descripción" value={fields.description} maxLength={1000} onChange={e => change("description", e.target.value)} /></label><div className={styles.grid}><label>Puntos por respuesta correcta<input type="number" min="0" max="1000000" step="1" value={fields.pointsPerCorrect} onChange={e => change("pointsPerCorrect", e.target.value)} /></label><label>Bonus por alcanzar el umbral<input type="number" min="0" max="1000000" step="1" value={fields.completionBonus} onChange={e => change("completionBonus", e.target.value)} /></label><label>Respuestas correctas para el bonus<input type="number" min="0" max="12" step="1" value={fields.passThreshold} onChange={e => change("passThreshold", e.target.value)} /></label></div><p className={styles.note}>Cero puntos y cero bonus no otorgan puntos. Un umbral de cero concede el bonus al completar la trivia. Ámbito: todos los productos de esta empresa en la vertical elegida, sujeto a una lectura apta y a un programa vigente.</p></>}
            <div className={styles.grid}><label>Inicio<input type="datetime-local" value={fields.start} onChange={e => change("start", e.target.value)} /></label><label>Fin (opcional)<input type="datetime-local" value={fields.end} onChange={e => change("end", e.target.value)} /></label></div><p className={styles.note}>Fechas en {zone}. La disponibilidad también depende de estas fechas; un borrador nunca queda disponible por llegar su fecha de inicio.</p>
            {kind === "quiz" && <div className={styles.questions}><h3>Preguntas · {fields.questions.length}{legacy ? " · sólo consulta" : "/12"}</h3>{fields.questions.map((q, index) => <section key={q.id} className={styles.question} aria-label={`Pregunta ${index + 1}`}><div className={styles.title}><h4>Pregunta {index + 1}</h4><button type="button" onClick={() => change("questions", fields.questions.filter((_, i) => i !== index))}>Quitar pregunta {index + 1}</button></div><label>Enunciado {index + 1}<textarea aria-label={`Enunciado ${index + 1}`} value={q.prompt} maxLength={500} onChange={e => questionChange(index, { prompt: e.target.value })} /></label><fieldset className={styles.options}><legend>Opciones y respuesta correcta · pregunta {index + 1}</legend>{q.options.map((option, optionIndex) => <div key={optionIndex} className={styles.option}><label className={styles.radio}><input type="radio" name={`correct-${q.id}`} checked={q.correctIndex === optionIndex} onChange={() => questionChange(index, { correctIndex: optionIndex })} /><span>Correcta {optionIndex + 1}</span></label><label className={styles.optionText}>Opción {optionIndex + 1}<input value={option} maxLength={240} onChange={e => questionChange(index, { options: q.options.map((o, i) => i === optionIndex ? e.target.value : o) })} /></label><button type="button" disabled={q.correctIndex === optionIndex} aria-label={`Quitar opción ${optionIndex + 1} de pregunta ${index + 1}`} onClick={() => removeOption(index, optionIndex)}>Quitar</button></div>)}<button type="button" disabled={q.options.length >= 6} onClick={() => questionChange(index, { options: [...q.options, ""] })}>Agregar opción a pregunta {index + 1}</button><p className={styles.note}>Para quitar la opción marcada, elegí antes otra respuesta correcta.</p></fieldset><label>Explicación (opcional) · pregunta {index + 1}<textarea aria-label={`Explicación (opcional) · pregunta ${index + 1}`} value={q.explanation || ""} maxLength={1000} onChange={e => questionChange(index, { explanation: e.target.value })} /></label></section>)}<button type="button" disabled={fields.questions.length >= 12} onClick={() => change("questions", [...fields.questions, { id: crypto.randomUUID(), prompt: "", options: ["", ""], correctIndex: 0, explanation: "" }])}>Agregar pregunta</button><p className={styles.note}>El borrador puede estar incompleto. Publicar exige entre 1 y 12 preguntas, de 2 a 6 opciones distintas y una respuesta correcta por pregunta.</p></div>}
          </>}
        </fieldset>
        {canWrite && !legacy && !archived && !bindingMissing && <div className={styles.actions}>{published ? <button type="button" disabled={busy || uncertain} onClick={() => setConfirmAction("withdraw")}>Retirar publicación</button> : <><button type="button" disabled={!editable} onClick={() => void send("save_draft")}>Guardar borrador</button><button type="button" className={styles.primary} disabled={!editable || !resource.revision || dirty} onClick={() => setConfirmAction("publish")}>Publicar configuración guardada</button></>}{dirty && !published && <p className={styles.note}>Guardá los cambios como borrador antes de publicarlos.</p>}</div>}
        {confirmAction && <div className={styles.confirm} role="group" aria-label="Confirmar cambio de publicación"><h3>{confirmAction === "withdraw" ? "Retirar esta publicación" : "Publicar esta configuración"}</h3><p>{confirmAction === "withdraw" ? "Dejará de estar disponible para nuevas acciones. Los puntos, beneficios e intentos anteriores conservan su historial." : kind === "profile" ? `Habilitará ${fields.allowedActions.length} servicio(s) de esta marca. La compra también exige catálogo publicado y política comercial apta.` : kind === "program" ? `${fields.pointsPerValidTap} puntos por lectura válida, con ${fields.cooldownSeconds} segundos de espera; aplican las fechas guardadas.` : `Trivia para la vertical ${verticals[fields.vertical as keyof typeof verticals] || fields.vertical} de esta empresa, con ${fields.pointsPerCorrect} puntos por acierto y ${fields.completionBonus} de bonus. El programa debe estar vigente.`}</p><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy} onClick={() => void send(confirmAction)}>{confirmAction === "withdraw" ? "Confirmar retiro" : "Confirmar publicación"}</button><button type="button" disabled={busy} onClick={() => setConfirmAction(null)}>Cancelar</button></div></div>}
      </section> : <p className={styles.note}>{kind === "program" ? "Elegí un programa guardado o creá un borrador. No se selecciona ni activa uno automáticamente." : "Elegí una trivia guardada o creá un borrador ligado a un programa existente."}</p>}
      {didRead && <section className={styles.compare} aria-label="Versión guardada consultada"><h2>Estado guardado consultado</h2><p>{reviewed ? `${"name" in reviewed ? reviewed.name : "title" in reviewed ? reviewed.title : "Servicios post-tap"} · ${configurationState(reviewed)}` : "Este borrador no figura entre las configuraciones guardadas."}</p>{reviewed && <><p className={styles.note}>Revisión: {reviewed.revision}</p>{"pointsName" in reviewed && <p>Lectura válida: {reviewed.pointsPerValidTap ?? "sin configurar"} puntos · espera {reviewed.cooldownSeconds ?? "sin configurar"} segundos.</p>}<button type="button" disabled={busy} onClick={() => { adopt(reviewed); inform("Versión guardada cargada; el formulario anterior se descartó."); }}>Descartar formulario y usar versión guardada</button></>}{uncertain && pending && configurationReconciliation(reviewed, pending) === "retry_allowed" && <><p className={styles.note}>La revisión consultada permite reintentar exactamente la operación original. No se cambian sus campos ni su identificador.</p><button type="button" disabled={busy} onClick={() => void send(pending.action, pending)}>Reintentar operación original</button></>}</section>}
    </>}
  </main>;
}
