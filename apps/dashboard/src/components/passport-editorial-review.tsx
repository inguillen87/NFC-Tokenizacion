"use client";
import * as React from "react";
import { Component } from "react";
import { EDITORIAL_REVIEW_SCHEMA, REVIEW_GROUPS, editorialChangeCounts, visibleEditorialChanges, editorialComparisonReport, type EditorialReview, type EditorialValue, type EditorialGroup } from "../lib/passport-editorial-review";
import styles from "./passport-editorial-review.module.css";

type Props={model:EditorialReview};
type State={query:string;onlyChanged:boolean;group:EditorialGroup|"all";mobileView:"compare"|"preview";message:string};
const initial=():State=>({query:"",onlyChanged:true,group:"all",mobileView:"compare",message:""});
const STATES={draft:"Borrador",in_review:"En revisión",changes_requested:"Correcciones solicitadas",approved:"Aprobación declarada"};
const CHANGE={added:"Agregado",removed:"Retirado",changed:"Modificado",same:"Sin cambios"};
function Content({value}:{value:EditorialValue}){
  if(value===null||(Array.isArray(value)&&!value.length))return <span className={styles.emptyValue}>No informado</span>;
  if(Array.isArray(value))return <ol className={styles.valueList}>{value.map((item,index)=><li key={index}>{item}</li>)}</ol>;
  return <p className={styles.value}>{value}</p>;
}
function Eye(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;}
/** Read-only review surface. No draft persistence or approval/publication callback is implied. */
export class PassportEditorialReview extends Component<Props,State>{
  state:State=initial();
  private reportUrl:string|null=null;
  private releaseTimer:ReturnType<typeof setTimeout>|null=null;
  componentDidUpdate(previous:Props){
    const a=previous.model,b=this.props.model;
    if(a.tenantId!==b.tenantId||a.batchId!==b.batchId||a.revision!==b.revision||a.observedAt!==b.observedAt){this.releaseReport();this.setState(initial());}
  }
  componentWillUnmount(){this.releaseReport();}
  private releaseReport(){if(this.releaseTimer)clearTimeout(this.releaseTimer);this.releaseTimer=null;if(this.reportUrl)URL.revokeObjectURL(this.reportUrl);this.reportUrl=null;}
  private download=()=>{
    try{
      const report=editorialComparisonReport(this.props.model);this.releaseReport();
      this.reportUrl=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
      const anchor=document.createElement("a");anchor.href=this.reportUrl;anchor.download=`nexid-revision-${this.props.model.revision}.json`;
      anchor.style.display="none";document.body.appendChild(anchor);anchor.click();anchor.remove();
      this.releaseTimer=setTimeout(()=>this.releaseReport(),2000);
      this.setState({message:"Informe de comparación preparado. No es un comprobante de aprobación ni publica cambios."});
    }catch{this.releaseReport();this.setState({message:"No se pudo preparar el informe. No se guardó ni publicó ningún cambio."});}
  };
  render(){
    const {model}=this.props;
    if(model.schemaVersion!==EDITORIAL_REVIEW_SCHEMA)return <p role="alert">El comparador necesita una respuesta editorial válida.</p>;
    const counts=editorialChangeCounts(model),changes=visibleEditorialChanges(model,this.state);
    const sections=Object.entries(REVIEW_GROUPS).map(([key,label])=>({key,label,rows:changes.filter(row=>row.group===key)})).filter(group=>group.rows.length);
    const total=counts.added+counts.changed+counts.removed;
    const value=(key:string)=>{const item=model.candidate.values[key];return typeof item==="string"?item:"";};
    const documents=["agro_product_profile.technicalSheetUrl","agro_product_profile.safetySheetUrl"].filter(key=>Boolean(value(key)));
    return <section className={styles.root} data-testid="passport-editorial-review" data-mobile-view={this.state.mobileView}>
      <div className={styles.breadcrumb}><span className={styles.wordmark}>nex<span>ID</span></span><span>Passport Studio</span><span className={styles.breadcrumbDivider}>/</span><span>Revisión editorial</span></div>
      <header className={styles.heading}>
        <div><p className={styles.eyebrow}>Control de contenido · {model.batchLabel}</p><h1>Revisar antes de publicar.</h1><p className={styles.subtitle}>Compará la versión de referencia con el borrador. Cada modificación conserva su contexto.</p></div>
        <div className={styles.version}><span className={styles.state}>{STATES[model.status]}</span><strong>Revisión {model.revision}</strong><small>Consulta {new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"UTC"}).format(new Date(model.observedAt))} UTC</small></div>
      </header>
      <div className={styles.notice}><span className={styles.noticeDot} aria-hidden="true"/><p><strong>Revisión de contenido, no de autenticidad.</strong> Esta vista es de solo lectura. No verifica NFC, no modifica precintos y no publica el pasaporte.</p></div>
      {model.metadataChanges.length>0&&<div className={styles.warning} role="status">{model.metadataChanges.map(text=><p key={text}>{text} Revisá también el alcance del contenido.</p>)}</div>}
      <div className={styles.summary} aria-label="Resumen de diferencias">{[[String(total),"Campos con cambios","total"],[String(counts.added),"Agregados","added"],[String(counts.changed),"Modificados","changed"],[String(counts.removed),"Retirados","removed"]].map(([count,label,kind])=><div key={kind} data-kind={kind}><strong>{count}</strong><span>{label}</span></div>)}</div>
      <div className={styles.mobileSwitch} role="group" aria-label="Vista en el celular"><button type="button" aria-pressed={this.state.mobileView==="compare"} onClick={()=>this.setState({mobileView:"compare"})}>Comparación</button><button type="button" aria-pressed={this.state.mobileView==="preview"} onClick={()=>this.setState({mobileView:"preview"})}><Eye/>Vista móvil</button></div>
      <div className={styles.layout}>
        <div className={styles.comparison}>
          <div className={styles.toolbar}>
            <label className={styles.search}>Buscar en los cambios<input type="search" maxLength={120} placeholder="Producto, documento o contenido…" value={this.state.query} onChange={event=>this.setState({query:event.target.value})}/></label>
            <label className={styles.select}>Sección<select aria-label="Sección" value={this.state.group} onChange={event=>this.setState({group:event.target.value as EditorialGroup|"all"})}><option value="all">Todas las secciones</option>{Object.entries(REVIEW_GROUPS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
            <label className={styles.check}><input type="checkbox" checked={this.state.onlyChanged} onChange={event=>this.setState({onlyChanged:event.target.checked})}/>Solo cambios</label>
          </div>
          <p className={styles.resultCount} role="status" aria-live="polite">{changes.length} campos en esta vista. Los filtros no consultan ningún servicio.</p>
          {!model.published&&<p className={styles.warning}>No se proporcionó una versión publicada de referencia. Los valores presentes se muestran como nuevos; esto no confirma que el producto nunca haya sido publicado.</p>}
          <div className={styles.columnLabels} aria-hidden="true"><span>Campo</span><span>Referencia publicada</span><span>Borrador propuesto</span></div>
          {sections.map(group=><section key={group.key} className={styles.group} aria-labelledby={`editorial-group-${group.key}`}><h2 id={`editorial-group-${group.key}`}>{group.label}<span>{group.rows.length} {group.rows.length===1?"campo":"campos"}</span></h2>{group.rows.map(row=><article key={row.path} className={styles.change} data-kind={row.state} data-field={row.path}>
            <div className={styles.fieldName}><h3>{row.label}</h3><span className={styles.changeBadge}>{CHANGE[row.state]}</span></div>
            <div className={styles.before}><span className={styles.valueLabel}>Referencia publicada</span><Content value={row.before}/></div>
            <div className={styles.after}><span className={styles.valueLabel}>Borrador propuesto</span><Content value={row.after}/></div>
          </article>)}</section>)}
          {!sections.length&&<div className={styles.noMatches}><h2>{total===0?"No hay diferencias de campos.":"Sin coincidencias en este filtro."}</h2><p>{total===0?"Esto no equivale a una aprobación. Revisá los cambios de idioma o plantilla, si están indicados.":"Probá otra búsqueda o mostrá las secciones sin cambios."}</p>{total>0&&<button type="button" className={styles.button} onClick={()=>this.setState({query:"",group:"all",onlyChanged:true})}>Restablecer filtros</button>}</div>}
          <footer className={styles.footer}><p>Los enlaces se comparan como texto: esta revisión no descarga imágenes ni documentos externos.</p>{model.canExport&&<button type="button" className={styles.button} onClick={this.download}>Descargar comparación JSON</button>}</footer>
          {this.state.message&&<p role="status" className={styles.exportMessage}>{this.state.message}</p>}
        </div>
        <aside className={styles.preview} aria-label="Vista móvil del borrador">
          <div className={styles.previewHeading}><span><Eye/>Vista móvil</span><small>Borrador · sin publicar</small></div>
          <div className={styles.phone}>
            <div className={styles.phoneTop}><span className={styles.wordmark}>nex<span>ID</span></span><span>{model.candidate.locale}</span></div>
            <div className={styles.previewBanner}>VISTA PREVIA EDITORIAL</div>
            <div className={styles.productVisual} aria-hidden="true"><svg viewBox="0 0 80 100" fill="none"><path d="M19 22h42l8 65H11l8-65Z"/><path d="M24 22V11h32v11M18 41h44"/>{model.candidate.template==="agro"?<path d="M40 58v20M40 66c-13 0-12-12-12-12s12 0 12 12ZM40 70c13 0 12-12 12-12s-12 0-12 12Z"/>:<path d="M25 56h30M25 64h30M25 72h20"/>}</svg></div>
            <p className={styles.visualCaption}>Representación esquemática · no es una foto del producto</p>
            <div className={styles.phoneContent}><p className={styles.phoneBrand}>{value("identity.winery")||"Marca no informada"}</p><h2>{value("identity.product_name")||"Nombre del producto pendiente"}</h2><p className={styles.phoneLot}>Lote {value("identity.public_lot_label")||"no informado"}</p>
              <dl>{[["Cultivo",value("agro_product_profile.crop")],["Variedad",value("agro_product_profile.seedVariety")],["Ingrediente activo",value("agro_product_profile.activeIngredient")],["Vencimiento",value("agro_product_profile.expirationDate")],["SKU",value("identity.sku")]].filter(([,text])=>text).map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
              {documents.length>0&&<section className={styles.previewDocuments}><h3>Documentación declarada</h3>{documents.map(key=><p key={key}><span aria-hidden="true">↗</span>{key.endsWith("technicalSheetUrl")?"Ficha técnica":"Ficha de seguridad"}</p>)}</section>}
              <p className={styles.phoneDisclaimer}>Vista parcial del contenido propuesto. La verificación del chip y el estado del precinto aparecen solo en una lectura real autorizada.</p>
            </div>
          </div>
          <p className={styles.previewNote}>La vista previa no solicita ubicación, no simula un TAP y no registra actividad de un cliente.</p>
        </aside>
      </div>
    </section>;
  }
}
