"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Building2, LocateFixed, MapPin, RotateCcw } from "lucide-react";
import { SunPassportMap, type SunPassportMapLocation } from "./sun-passport-map";
import { MENDOZA_DEMO_POINT, approximateDemoPosition } from "./valle-secreto-demo-location";
import { SYNGENTA_DEMO } from "./syngenta-demo";
import type { SunLocale } from "./sun-locale";
import styles from "./syngenta-demo-map.module.css";

// The office address is a public contact reference from the safety data sheet.
// Waze's public place record supplies a navigation reference, never a lot origin.
const OFFICE_ADDRESS = "Av. del Libertador 1855, Vicente López, Buenos Aires, Argentina";
const OFFICE_MAP = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Syngenta ${OFFICE_ADDRESS}`)}`;
const OFFICE_WAZE = "https://www.waze.com/es-419/live-map/directions/ar/provincia-de-buenos-aires/caba/syngenta?to=place.ChIJCxOfkU-xvJURBLeYsOQvcxs";
const OFFICE_POINT = { lat: -34.5152755, lng: -58.4756685 } as const;
const COPY = {
  "es-AR": {
    eyebrow: "EXPERIENCIA EN EL MAPA", title: "El producto, cerca tuyo", intro: "Ubicá la sede de referencia de Syngenta Argentina y una zona de ejemplo en Mendoza, o probá con tu ubicación aproximada.",
    request: "Usar mi ubicación en la demo", pending: "Esperando tu ubicación…", reset: "Volver al ejemplo de Mendoza",
    privacy: "Opcional. Tu zona sólo se muestra en este mapa; no se guarda ni se agrega al CRM de la marca.",
    idle: "Mendoza es un ejemplo, no una lectura NFC real.", shared: "Tu zona aproximada está en el mapa. No se creó ninguna lectura.",
    denied: "No diste permiso. Podés seguir con el ejemplo de Mendoza.", unavailable: "No pudimos obtener tu zona. El ejemplo de Mendoza sigue disponible.", timeout: "La ubicación tardó demasiado. Podés reintentar o seguir con Mendoza.",
    visitor: "Tu zona aproximada · demo", visitorEvidence: "Ubicación del navegador con permiso, redondeada a dos decimales. Sólo para esta demostración; no es una lectura NFC ni un registro del CRM.",
    example: "Mendoza, Argentina · ejemplo", exampleEvidence: "Punto de muestra en Mendoza. No representa una persona, un envase ni una lectura NFC real.",
    office: "Syngenta Argentina", reference: "Sede de referencia", officeEvidence: "Punto público de navegación en Waze para el domicilio de Av. del Libertador 1855. Referencia comercial, no origen de fabricación de este lote.", address: "Domicilio publicado en la hoja de seguridad. No indica dónde se fabricó este bidón.", officeLink: "Buscar la dirección en Google Maps", sourceLink: "Ver la fuente oficial", pointLink: "Ver el punto de referencia en Waze",
  },
  en: {
    eyebrow: "EXPLORE THE MAP", title: "The product, closer to you", intro: "Find Syngenta Argentina's office reference and a sample area in Mendoza, or try your approximate location.",
    request: "Use my location in the demo", pending: "Waiting for your location…", reset: "Back to the Mendoza example",
    privacy: "Optional. Your area is only shown on this map; it is not saved or added to the brand's CRM.",
    idle: "Mendoza is an example, not a real NFC reading.", shared: "Your approximate area is on the map. No reading was created.",
    denied: "Permission was not granted. You can continue with the Mendoza example.", unavailable: "We could not get your area. The Mendoza example remains available.", timeout: "Location took too long. Try again or continue with Mendoza.",
    visitor: "Your approximate area · demo", visitorEvidence: "Browser location with permission, rounded to two decimals. For this demo only; not an NFC reading or a CRM record.",
    example: "Mendoza, Argentina · example", exampleEvidence: "Sample point in Mendoza. It does not represent a person, a container or a real NFC reading.",
    office: "Syngenta Argentina", reference: "Office reference", officeEvidence: "Public Waze navigation point for Av. del Libertador 1855. A commercial reference, not the manufacturing origin of this lot.", address: "Address published in the safety data sheet. It does not identify where this container was manufactured.", officeLink: "Find the address in Google Maps", sourceLink: "View the official source", pointLink: "View the reference point in Waze",
  },
  "pt-BR": {
    eyebrow: "EXPERIÊNCIA NO MAPA", title: "O produto, perto de você", intro: "Veja a sede de referência da Syngenta Argentina e uma área de exemplo em Mendoza, ou experimente sua localização aproximada.",
    request: "Usar minha localização na demo", pending: "Aguardando sua localização…", reset: "Voltar ao exemplo de Mendoza",
    privacy: "Opcional. Sua área só aparece neste mapa; não é salva nem adicionada ao CRM da marca.",
    idle: "Mendoza é um exemplo, não uma leitura NFC real.", shared: "Sua área aproximada está no mapa. Nenhuma leitura foi criada.",
    denied: "Permissão não concedida. Você pode continuar com o exemplo de Mendoza.", unavailable: "Não conseguimos obter sua área. O exemplo de Mendoza continua disponível.", timeout: "A localização demorou demais. Tente novamente ou continue com Mendoza.",
    visitor: "Sua área aproximada · demo", visitorEvidence: "Localização do navegador com permissão, arredondada a duas casas decimais. Apenas para esta demo; não é uma leitura NFC nem um registro do CRM.",
    example: "Mendoza, Argentina · exemplo", exampleEvidence: "Ponto de exemplo em Mendoza. Não representa uma pessoa, uma embalagem ou uma leitura NFC real.",
    office: "Syngenta Argentina", reference: "Sede de referência", officeEvidence: "Ponto público de navegação no Waze para Av. del Libertador 1855. Referência comercial, não a origem de fabricação deste lote.", address: "Endereço publicado na ficha de segurança. Não indica onde esta embalagem foi fabricada.", officeLink: "Buscar o endereço no Google Maps", sourceLink: "Ver a fonte oficial", pointLink: "Ver o ponto de referência no Waze",
  },
} as const;

type State = "idle" | "pending" | "shared" | "denied" | "unavailable" | "timeout";

export function SyngentaDemoMap({ locale }: { locale: SunLocale }) {
  const copy = COPY[locale];
  const privacyId = useId();
  const titleId = useId();
  const [state, setState] = useState<State>("idle");
  const [position, setPosition] = useState<ReturnType<typeof approximateDemoPosition>>(null);
  const requestRef = useRef({ sequence: 0, pending: false, timer: 0 });

  useEffect(() => () => {
    requestRef.current.sequence++;
    requestRef.current.pending = false;
    window.clearTimeout(requestRef.current.timer);
  }, []);

  const reset = () => {
    requestRef.current.sequence++;
    requestRef.current.pending = false;
    window.clearTimeout(requestRef.current.timer);
    setPosition(null);
    setState("idle");
  };

  const request = () => {
    if (requestRef.current.pending) return;
    const sequence = ++requestRef.current.sequence;
    setPosition(null);
    if (!navigator.geolocation) { setState("unavailable"); return; }
    requestRef.current.pending = true;
    setState("pending");
    const finish = (next: State, value: ReturnType<typeof approximateDemoPosition> = null) => {
      if (sequence !== requestRef.current.sequence || !requestRef.current.pending) return;
      window.clearTimeout(requestRef.current.timer);
      requestRef.current.pending = false;
      setPosition(value);
      setState(next);
    };
    requestRef.current.timer = window.setTimeout(() => finish("timeout"), 8_500);
    try {
      navigator.geolocation.getCurrentPosition(result => {
        const value = approximateDemoPosition(result.coords);
        finish(value ? "shared" : "unavailable", value);
      }, error => finish(error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable"),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 });
    } catch { finish("unavailable"); }
  };

  const tap: SunPassportMapLocation = position
    ? { id: "syngenta-demo-visitor", ...position, label: copy.visitor, evidence: copy.visitorEvidence, source: "demo_browser_approximate_consent" }
    : { id: "syngenta-demo-mendoza", ...MENDOZA_DEMO_POINT, label: copy.example, evidence: copy.exampleEvidence, source: "demo" };
  const origin: SunPassportMapLocation = { id: "syngenta-public-office-reference", ...OFFICE_POINT, label: `${copy.office} · ${copy.reference}`, evidence: copy.officeEvidence, source: "public_producer_reference" };

  return <section className={styles.shell} data-testid="syngenta-demo-map" data-demo-location-state={state} aria-labelledby={titleId}>
    <div className={styles.intro} data-sun-dock-avoid>
      <span className={styles.eyebrow}><MapPin size={17} aria-hidden="true" />{copy.eyebrow}</span>
      <h3 id={titleId}>{copy.title}</h3><p>{copy.intro}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} data-testid="syngenta-demo-location-request" onClick={request} disabled={state === "pending"} aria-busy={state === "pending"} aria-describedby={privacyId}><LocateFixed size={19} aria-hidden="true" />{state === "pending" ? copy.pending : copy.request}</button>
        {state !== "idle" ? <button type="button" className={styles.secondary} data-testid="syngenta-demo-location-reset" onClick={reset}><RotateCcw size={17} aria-hidden="true" />{copy.reset}</button> : null}
      </div>
      <p id={privacyId} className={styles.note}>{copy.privacy}</p>
      <p className={styles.status} data-testid="syngenta-demo-location-status" data-error={["denied", "unavailable", "timeout"].includes(state)} role="status" aria-live="polite">{copy[state]}</p>
    </div>
    <SunPassportMap origin={origin} tap={tap} showRoute={false} distanceLabel="" cartography="reference" referenceContext="agro" locale={locale} />
    <aside className={styles.office} data-testid="syngenta-office-reference" aria-label={copy.reference}>
      <Building2 size={20} aria-hidden="true" /><div><span className={styles.reference}>{copy.reference}</span><h4>{copy.office}</h4><p>{OFFICE_ADDRESS}</p><p className={styles.note}>{copy.address}</p>
        <div className={styles.links}><a href={OFFICE_MAP} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-testid="syngenta-office-map-link">{copy.officeLink}<ArrowUpRight size={16} aria-hidden="true" /></a><a href={SYNGENTA_DEMO.safetySheet} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{copy.sourceLink}<ArrowUpRight size={16} aria-hidden="true" /></a><a href={OFFICE_WAZE} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-testid="syngenta-office-reference-source">{copy.pointLink}<ArrowUpRight size={16} aria-hidden="true" /></a></div>
      </div>
    </aside>
  </section>;
}
