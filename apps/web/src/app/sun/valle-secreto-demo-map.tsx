"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, RotateCcw } from "lucide-react";
import { SunPassportMap, type SunPassportMapLocation } from "./sun-passport-map";
import { VALLE_SECRETO_DEMO as wine } from "./valle-secreto-demo";
import { MENDOZA_DEMO_POINT, approximateDemoPosition } from "./valle-secreto-demo-location";
import { haversineKm } from "./sun-route-distance";
import { useSunLocale } from "./sun-locale-provider";
import styles from "./valle-secreto-demo-map.module.css";

const COPY = {
  "es-AR": { eyebrow: "CHILE · ARGENTINA", title: "De la viña a tu encuentro", intro: "Valle Secreto en Chile y una lectura de ejemplo en Mendoza. Probá cómo se vería con tu zona aproximada.", request: "Usar mi ubicación en la demo", pending: "Esperando tu ubicación…", reset: "Volver al ejemplo de Mendoza", privacy: "Opcional. Sólo cambia este mapa: no se guarda ni se agrega al CRM de la marca.", idle: "Mendoza es un ejemplo, no un TAP físico.", shared: "Tu zona aproximada está en el mapa. No se creó ninguna lectura.", denied: "No diste permiso. Podés seguir con el ejemplo de Mendoza.", unavailable: "No pudimos obtener tu zona. El ejemplo de Mendoza sigue disponible.", timeout: "La ubicación tardó demasiado. Podés reintentar o seguir con Mendoza.", visitor: "Tu zona aproximada · demo", visitorEvidence: "Ubicación del navegador con permiso, redondeada a dos decimales. Sólo para esta demostración; no es una lectura NFC ni un registro del CRM.", example: "Mendoza, Argentina · ejemplo", exampleEvidence: "Punto de muestra en Mendoza. No representa una persona ni un TAP real.", origin: "Viña Valle Secreto, Chile", originEvidence: "Punto de navegación publicado por Valle Secreto en su enlace Waze. No es una coordenada medida por el chip ni un límite de la propiedad.", source: "Ubicación de la viña: enlace publicado en su sitio oficial.", wineryLink: "Ver fuente de la viña ↗", pinLink: "Abrir punto público en Waze ↗" },
  en: { eyebrow: "CHILE · ARGENTINA", title: "From the vineyard to you", intro: "Valle Secreto in Chile and a sample reading in Mendoza. Try it with your approximate area.", request: "Use my location in the demo", pending: "Waiting for your location…", reset: "Back to the Mendoza example", privacy: "Optional. It only changes this map: it is not saved or added to the brand's CRM.", idle: "Mendoza is an example, not a physical NFC reading.", shared: "Your approximate area is on the map. No reading was created.", denied: "Permission was not granted. You can continue with the Mendoza example.", unavailable: "We could not get your area. The Mendoza example remains available.", timeout: "Location took too long. Try again or continue with Mendoza.", visitor: "Your approximate area · demo", visitorEvidence: "Browser location with permission, rounded to two decimals. For this demo only; not an NFC reading or CRM record.", example: "Mendoza, Argentina · example", exampleEvidence: "Sample point in Mendoza. It does not represent a person or a real NFC reading.", origin: "Valle Secreto vineyard, Chile", originEvidence: "Navigation point published by Valle Secreto in its Waze link. Not a chip measurement or a property boundary.", source: "Vineyard location: link published on its official website.", wineryLink: "View the vineyard source ↗", pinLink: "Open the public point in Waze ↗" },
  "pt-BR": { eyebrow: "CHILE · ARGENTINA", title: "Da vinícola até você", intro: "Valle Secreto no Chile e uma leitura de exemplo em Mendoza. Experimente com sua área aproximada.", request: "Usar minha localização na demo", pending: "Aguardando sua localização…", reset: "Voltar ao exemplo de Mendoza", privacy: "Opcional. Só muda este mapa: não é salvo nem adicionado ao CRM da marca.", idle: "Mendoza é um exemplo, não uma leitura NFC física.", shared: "Sua área aproximada está no mapa. Nenhuma leitura foi criada.", denied: "Permissão não concedida. Você pode continuar com o exemplo de Mendoza.", unavailable: "Não conseguimos obter sua área. O exemplo de Mendoza continua disponível.", timeout: "A localização demorou demais. Tente novamente ou continue com Mendoza.", visitor: "Sua área aproximada · demo", visitorEvidence: "Localização do navegador com permissão, arredondada a duas casas decimais. Apenas para esta demo; não é uma leitura NFC nem um registro do CRM.", example: "Mendoza, Argentina · exemplo", exampleEvidence: "Ponto de exemplo em Mendoza. Não representa uma pessoa nem uma leitura NFC real.", origin: "Vinícola Valle Secreto, Chile", originEvidence: "Ponto de navegação publicado por Valle Secreto no link Waze. Não é uma medição do chip nem um limite da propriedade.", source: "Localização da vinícola: link publicado no site oficial.", wineryLink: "Ver fonte da vinícola ↗", pinLink: "Abrir ponto público no Waze ↗" },
} as const;
type State = "idle" | "pending" | "shared" | "denied" | "unavailable" | "timeout";

export function ValleSecretoDemoMap() {
  const { locale } = useSunLocale();
  const copy = COPY[locale];
  const [state, setState] = useState<State>("idle");
  const [position, setPosition] = useState<ReturnType<typeof approximateDemoPosition>>(null);
  const requestRef = useRef({ sequence: 0, pending: false, timer: 0 });
  useEffect(() => () => { requestRef.current.sequence++; requestRef.current.pending = false; window.clearTimeout(requestRef.current.timer); }, []);

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
      if (value) setPosition(value);
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
  const origin: SunPassportMapLocation = { id: "valle-public-navigation", ...wine.coordinates, label: copy.origin, evidence: copy.originEvidence, source: "public_producer_reference" };
  const tap: SunPassportMapLocation = position
    ? { id: "demo-visitor", ...position, label: copy.visitor, evidence: copy.visitorEvidence, source: "demo_browser_approximate_consent" }
    : { id: "demo-mendoza", ...MENDOZA_DEMO_POINT, label: copy.example, evidence: copy.exampleEvidence, source: "demo" };
  const distance = haversineKm(origin.lat, origin.lng, tap.lat, tap.lng);
  const separation = distance === null ? "N/D" : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(distance);
  return <div data-testid="valle-secreto-demo-map" data-demo-location-state={state}>
    <div className={styles.intro} data-sun-dock-avoid>
      <div><span className={styles.eyebrow}><MapPin size={18} aria-hidden="true" />{copy.eyebrow}</span><h3>{copy.title}</h3><p>{copy.intro}</p></div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} data-testid="demo-location-request" onClick={request} disabled={state === "pending"} aria-busy={state === "pending"} aria-describedby="demo-location-privacy"><LocateFixed size={20} aria-hidden="true" />{state === "pending" ? copy.pending : copy.request}</button>
        {state !== "idle" || position ? <button type="button" className={styles.secondary} data-testid="demo-location-reset" onClick={reset}><RotateCcw size={18} aria-hidden="true" />{copy.reset}</button> : null}
      </div>
      <p id="demo-location-privacy">{copy.privacy}</p>
      <p className={styles.status} data-testid="demo-location-status" data-error={["denied", "unavailable", "timeout"].includes(state)} role="status" aria-live="polite">{copy[state === "pending" ? "pending" : state]}</p>
    </div>
    <div id="geo-trace"><SunPassportMap origin={origin} tap={tap} showRoute={!position} distanceLabel={`${separation} km`} cartography="reference" locale={locale} /></div>
    <p className={styles.source}><span>{copy.source}</span><a href={wine.estate} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{copy.wineryLink}</a><a href={wine.navigationSource} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{copy.pinLink}</a></p>
  </div>;
}
