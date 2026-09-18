import Link from "next/link";
import { ArrowUpRight, Boxes, FileCheck2, PackageCheck, Smartphone } from "lucide-react";
import { RollManifestIntake } from "./roll-manifest-intake";
import styles from "./operations-workspace.module.css";
type RollFacts = { bid:string; productName:string; tenantSlug:string; imported:number; active:number; expected:number; canConfigure:boolean; canImport:boolean; canSupplier:boolean; canMap:boolean; isDemo:boolean };
export function BatchRollWorkspace(facts: RollFacts) {
  const { bid, productName, tenantSlug, imported, active, expected, canConfigure, canImport, canSupplier, canMap, isDemo } = facts;
  const steps = [
    { title:"Una ficha para todo el rollo", text:"Configurá la identidad comercial del producto una vez. Las etiquetas conservan su identificador individual.", state:productName ? "Producto identificado" : "Completar ficha", href:canConfigure ? "#roll-product" : "#roll-product-summary", action:canConfigure ? "Editar ficha de producto" : "Ver ficha", icon:Boxes },
    { title:"Recibir las unidades", text:"Cargá el manifiesto del proveedor. Primero se valida; la importación requiere tu confirmación explícita.", state:imported>0 ? `${imported.toLocaleString("es-AR")} UIDs registrados` : "Archivo pendiente", href:"#roll-manifest", action:"Revisar recepción", icon:FileCheck2 },
    { title:"Probar una muestra física", text:"Verificá el chip y el pasaporte. Un estado activo no demuestra que se haya aprobado el protocolo de calidad.", state:"Calidad: consultar evidencia", href:canSupplier ? "/batches/supplier#supplier-order-console" : "#roll-physical-check", action:canSupplier ? "Abrir protocolo de calidad" : "Abrir verificador", icon:Smartphone },
    { title:"Operar y seguir el producto", text:"La activación conserva sus permisos y controles. Luego analizá las lecturas del lote, sin inventar ubicaciones.", state:`${active.toLocaleString("es-AR")} etiquetas activas`, href:canMap ? `/analytics/map?tenant=${encodeURIComponent(tenantSlug)}&bid=${encodeURIComponent(bid)}` : "#roll-physical-check", action:canMap ? "Ver lecturas en el mapa" : "Revisar evidencia", icon:PackageCheck },
  ];
  return <section className={styles.workspace} data-testid="batch-roll-workspace">
    <div className={styles.hero}><div><p className={styles.eyebrow}>Operación de rollos · {isDemo ? "entorno demo" : "empresa y lote identificados"}</p><h2 className={styles.title}>De rollo recibido a producto conectado.</h2><p className={styles.description}>Cada paso tiene una función y un responsable. Sin mezclar la ficha del producto con las claves del chip, ni activar etiquetas por completar un formulario.</p></div><span className={styles.badge}>{expected>0 ? `${expected.toLocaleString("es-AR")} unidades declaradas` : "Cantidad esperada: no declarada"}</span></div>
    <div className={styles.steps}>{steps.map((step,index) => <article className={styles.step} key={step.title}><div className={styles.links}><step.icon size={22}/><span className={styles.badge}>0{index+1}</span></div><h3>{step.title}</h3><span className={styles.badge}>{step.state}</span><p>{step.text}</p><Link href={step.href} prefetch={false} className={styles.link}>{step.action}<ArrowUpRight size={15}/></Link></article>)}</div>
    <RollManifestIntake key={bid} bid={bid} canImport={canImport && !isDemo} alreadyRegistered={imported>0} />
    <p className={styles.note}>Este asistente conecta las operaciones existentes. La provisión industrial del chip, la custodia de claves y la aprobación de calidad mantienen sus actores autorizados; no se declaran completadas por estas tarjetas.</p>
  </section>;
}
