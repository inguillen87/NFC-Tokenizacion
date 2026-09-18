"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileCheck2, PackagePlus, Radio, RefreshCw, ShieldAlert } from "lucide-react";
import { logisticsReceipt, logisticsStatus, type LogisticsReceipt, type LogisticsShipment } from "../lib/logistics-workspace-model";
import styles from "./logistics-workspace.module.css";
type Operation="CREATE"|"APPLY"|"HANDOFF"|"VERIFY";
type Attempt={operation:Operation;tenant:string;shipmentId:string;endpoint:string;payload:Record<string,unknown>};
const MESSAGES:Record<string,string>={
  logistics_idempotency_conflict:"El identificador pertenece a otra solicitud. Revisá el envío antes de iniciar una operación nueva.",
  logistics_reference_conflict:"La referencia del envío ya existe. Abrí su registro; no la vuelvas a crear.",
  logistics_seal_already_assigned:"El precinto está asignado a otro envío.",
  logistics_seal_unassigned:"El precinto todavía no está vinculado. Registrá primero su aplicación.",
  logistics_shipment_not_found:"El envío no pertenece al alcance autorizado o no existe.",
  logistics_seal_not_found:"El UID no está registrado en el inventario de esta empresa.",
  logistics_carrier_not_found:"El transportista no está configurado para esta empresa.",
  logistics_shipment_terminal:"El envío no admite nuevas asignaciones en su estado actual.",
  logistics_seal_voided:"El precinto está anulado.",
  logistics_items_invalid:"Revisá producto y cantidad: se requiere un entero entre 1 y 1.000.000.",
};
export function SecureDeliveryOpsConsole({tenantSlug,role,canWrite=false,shipments=[]}:{tenantSlug?:string|null;role?:string;canWrite?:boolean;shipments?:LogisticsShipment[]}){
  const router=useRouter();const [operation,setOperation]=useState<Operation>("CREATE"),[selected,setSelected]=useState("");
  const [confirmed,setConfirmed]=useState(false),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
  const [receipt,setReceipt]=useState<LogisticsReceipt|null>(null);
  const [created,setCreated]=useState<{id:string;code:string}|null>(null);
  const attempt=useRef<Attempt|null>(null),inflight=useRef<AbortController|null>(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;inflight.current?.abort();};},[]);
  function changeOperation(next:Operation){if(pending||uncertain)return;setOperation(next);setConfirmed(false);setMessage("");setReceipt(null);attempt.current=null;}
  async function send(current:Attempt){
    if(inflight.current||!canWrite)return;const controller=new AbortController();inflight.current=controller;
    const timeout=setTimeout(()=>controller.abort(),20000);setPending(true);setMessage("");
    try {
      const response=await fetch(current.endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(current.payload),signal:controller.signal,cache:"no-store"});
      const data=await response.json().catch(()=>null);if(!mounted.current)return;
      if(!response.ok){setUncertain(response.status>=500);setMessage(response.status>=500?"No se pudo confirmar el resultado. Conservamos el mismo intento; no crees otro envío ni cambies los datos.":MESSAGES[String(data?.reason)]||"El servidor no aprobó la operación. Revisá permisos, datos y estado del envío.");if(response.status<500){attempt.current=null;setConfirmed(false);}return;}
      const accepted=logisticsReceipt(data,current.operation,current.tenant,current.shipmentId);
      if(!accepted){setUncertain(true);setMessage("La respuesta no contiene un comprobante válido de esta operación. Conservamos el intento para reconciliarlo.");return;}
      setReceipt(accepted);if(current.operation==="CREATE")setCreated({id:accepted.shipmentId,code:accepted.shipmentCode});setUncertain(false);setConfirmed(false);setSelected(accepted.shipmentId);attempt.current=null;router.refresh();
    }catch{if(mounted.current){setUncertain(true);setMessage("Conexión interrumpida: el resultado es incierto. Podés repetir el mismo intento identificado, sin generar otra operación.");}}
    finally{clearTimeout(timeout);inflight.current=null;if(mounted.current)setPending(false);}
  }
  function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!canWrite||pending||uncertain||!confirmed||receipt)return;
    const form=new FormData(event.currentTarget),get=(key:string)=>String(form.get(key)||"").trim();
    const tenant=tenantSlug||get("tenant_slug"),shipmentId=operation==="CREATE"?"":selected;
    if(!tenant){setMessage("Seleccioná la empresa del envío.");return;}
    const operation_key=crypto.randomUUID();let payload:Record<string,unknown>;
    if(operation==="CREATE"){
      const quantity=Number(get("quantity"));if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||!get("product_name")){setMessage("Indicá un producto y una cantidad entera válida.");return;}
      payload={operation_key,tenant_slug:tenant,shipment_code:get("shipment_code"),carrier_code:get("carrier_code"),tracking_number:get("tracking_number"),origin_address:get("origin_address"),destination_address:get("destination_address"),items:[{productName:get("product_name"),quantity}]};
    }else{
      if(!/^[a-f0-9-]{36}$/i.test(shipmentId)||!/^[a-f0-9]{14}$/i.test(get("uid_hex"))){setMessage("Seleccioná el envío y revisá el UID NFC de 14 caracteres hexadecimales.");return;}
      payload={operation_key,context:operation,tenant_slug:tenant,shipment_id:shipmentId,uid_hex:get("uid_hex").toUpperCase(),tt_raw:get("tt_raw"),location:get("location"),scanned_by:get("scanned_by"),recipient_name:get("recipient_name"),verification_method:"OPERATOR_DECLARATION"};
    }
    const current={operation,tenant,shipmentId,endpoint:operation==="CREATE"?"/api/admin/logistics/shipments":"/api/admin/logistics/scan",payload};attempt.current=current;void send(current);
  }
  const creation=operation==="CREATE";
  return <section id="secure-delivery-ops" className={styles.card} data-testid="logistics-operations">
    <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Operación autorizada</p><h2>Registrar, vincular y recibir.</h2></div><span className={styles.badge}>{tenantSlug||"Empresa por seleccionar"}</span></div>
    <div className={styles.actions} role="group" aria-label="Tipo de operación logística">{([["CREATE","Crear envío"],["APPLY","Aplicar precinto"],["HANDOFF","Traspaso"],["VERIFY","Recepción"]] as const).map(([key,label])=><button key={key} type="button" className={styles.button} aria-pressed={operation===key} disabled={pending||uncertain} onClick={()=>changeOperation(key)}>{label}</button>)}</div>
    {!canWrite?<p className={styles.notice}>Esta sesión es de consulta o la fuente transaccional no está disponible. Las operaciones requieren un administrador autorizado con logistics:write; no se simulan escrituras.</p>:<form onSubmit={submit}>
      <fieldset disabled={pending||uncertain||Boolean(receipt)} className={styles.formFields} onChange={()=>{setConfirmed(false);setMessage("");}}>
        {!tenantSlug&&<label className={styles.field}>Empresa<input name="tenant_slug" required maxLength={120} placeholder="Identificador de empresa"/></label>}
        {creation?<>
          <label className={styles.field}>Producto o activo<input name="product_name" required maxLength={180} placeholder="Descripción del contenido declarado"/></label>
          <label className={styles.field}>Cantidad<input name="quantity" type="number" required min={1} max={1000000} step={1} defaultValue={1}/></label>
          <label className={styles.field}>Referencia del envío<input name="shipment_code" maxLength={120} placeholder="Se genera si está vacío"/></label>
          <label className={styles.field}>Pedido / tracking<input name="tracking_number" maxLength={180}/></label>
          <label className={styles.field}>Origen declarado<input name="origin_address" maxLength={500}/></label>
          <label className={styles.field}>Destino declarado<input name="destination_address" maxLength={500}/></label>
          <label className={styles.field}>Código del transportista configurado<input name="carrier_code" maxLength={100} placeholder="Opcional"/></label>
        </>:<>
          <label className={styles.field}>Envío<select value={selected} onChange={event=>setSelected(event.target.value)} required><option value="">Seleccionar envío</option>{created&&!shipments.some(row=>row.id===created.id)&&<option value={created.id}>{created.code||created.id}</option>}{shipments.map(row=><option key={row.id} value={row.id}>{row.code} · {logisticsStatus(row.status)}</option>)}</select></label>
          <label className={styles.field}>UID del precinto<input name="uid_hex" required pattern="[a-fA-F0-9]{14}" maxLength={14} autoComplete="off" placeholder="14 caracteres hexadecimales"/></label>
          <label className={styles.field}>Estado reportado del precinto<select name="tt_raw" defaultValue=""><option value="">Sin evidencia · requiere revisión</option><option value="4343">Cerrado reportado · 4343</option><option value="4F4F">Abierto reportado · 4F4F</option><option value="4F43">Apertura reportada · 4F43</option><option value="4949">Estado reportado · 4949</option></select></label>
          <label className={styles.field}>Punto de control declarado<input name="location" maxLength={300} placeholder="No equivale a geolocalización GPS"/></label>
          <label className={styles.field}>Operador<input name="scanned_by" maxLength={180}/></label>
          {operation==="VERIFY"&&<label className={styles.field}>Receptor declarado<input name="recipient_name" maxLength={180}/></label>}
        </>}
      </fieldset>
      {!receipt&&<label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={pending||uncertain} onChange={event=>setConfirmed(event.target.checked)}/><span>Confirmo los datos y la acción {creation?"de creación del envío":"sobre este precinto"}. Es una declaración operativa; no prueba por sí sola autenticidad, contenido o custodia física.</span></label>}
      {!receipt&&!uncertain&&<button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!confirmed||pending}>{creation?<PackagePlus size={16} aria-hidden="true"/>:<Radio size={16} aria-hidden="true"/>}{pending?"Confirmando operación…":creation?"Confirmar creación":"Confirmar declaración"}</button>}
    </form>}
    {message&&<p className={styles.notice} role="status"><ShieldAlert size={18} aria-hidden="true"/>{message}</p>}
    {uncertain&&attempt.current&&<div className={styles.actions}><button type="button" className={styles.button} disabled={pending} onClick={()=>{if(attempt.current)void send(attempt.current);}}><RefreshCw size={16} aria-hidden="true"/>Reintentar el mismo intento identificado</button><Link href="/logistics/shipments" prefetch={false} className={styles.button}>Revisar registros antes de salir</Link></div>}
    {receipt&&<div className={styles.receipt} role="status" data-testid="logistics-transaction-receipt"><CheckCircle2 size={22} aria-hidden="true"/><div><h3>{receipt.replayed?"Operación ya registrada · no se duplicó":"Operación guardada con comprobante"}</h3><p>{receipt.shipmentCode||receipt.shipmentId} · {logisticsStatus(receipt.status)}</p>{receipt.sealStatus&&<p>Precinto: {logisticsStatus(receipt.sealStatus)}. El estado del envío se calcula con todos sus precintos.</p>}<p className={styles.muted}>Comprobante: {receipt.id}. Describe la operación confirmada; el estado actual puede cambiar después.</p><div className={styles.actions}><Link prefetch={false} href={`/logistics/shipments/${encodeURIComponent(receipt.shipmentId)}`} className={styles.button}>Abrir expediente del envío</Link><button type="button" className={styles.button} onClick={()=>changeOperation(creation?"APPLY":operation)}>Preparar siguiente operación</button></div></div></div>}
  </section>;
}
