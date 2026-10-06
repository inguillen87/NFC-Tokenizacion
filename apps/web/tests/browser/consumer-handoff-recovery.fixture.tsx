// The production React component runs here. Navigation and the TAP are synthetic.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConsumerPassportLink } from "../../src/app/sun/consumer-passport-link";
import { SunLocaleProvider } from "../../src/app/sun/sun-locale-provider";
import passport from "../../src/app/sun/sun-passport-experience.module.css";

const nativeFetch = window.fetch.bind(window);
const state = Object.assign(window, {
  __handoffAborts: 0,
  __handoffBodies: 0,
  __ignoreHandoffAbort: false,
  __handoffPushes: [] as string[],
  __handoffGeoCalls: 0,
});
window.fetch = async (input, init) => {
  if (typeof input !== "string" || input !== "/api/consumer/tap-handoff") throw new Error("unexpected_fixture_fetch");
  init?.signal?.addEventListener("abort", () => { state.__handoffAborts++; }, { once: true });
  // This adversarial case proves the navigation guard even when transport ignores
  // cancellation. All response bytes still come from the intercepted local HTTP.
  const response = await nativeFetch(input, state.__ignoreHandoffAbort ? { ...init, signal: undefined } : init);
  return {
    ok: response.ok,
    status: response.status,
    async json() {
      try { return await response.json(); }
      finally { state.__handoffBodies++; }
    },
  } as Response;
};
Object.defineProperty(navigator, "geolocation", { value: {
  getCurrentPosition() { state.__handoffGeoCalls++; },
  watchPosition() { state.__handoffGeoCalls++; },
  clearWatch() {},
} });

function Fixture() {
  const locale = document.documentElement.lang === "en" ? "en" : document.documentElement.lang === "pt-BR" ? "pt-BR" : "es-AR";
  const [visible, setVisible] = useState(true);
  const [eventId, setEventId] = useState("715");
  useEffect(() => {
    const navigate = () => setVisible(false);
    const change = () => setEventId("716");
    window.addEventListener("fixture-navigate", navigate);
    window.addEventListener("fixture-change-context", change);
    return () => {
      window.removeEventListener("fixture-navigate", navigate);
      window.removeEventListener("fixture-change-context", change);
    };
  }, []);
  return <StrictMode><SunLocaleProvider initialLocale={locale}>
    <main className={`${passport.passport} sun-tap-experience`}>
      <h1>Acceso después de una lectura · ensayo local</h1>
      <p>Referencia sintética. No guarda, reclama ni consulta datos de clientes.</p>
      <button id="leave-reading" className="min-h-11 rounded-lg border px-3 py-2" onClick={() => setVisible(false)}>Salir de esta lectura</button>
      {visible ? <section aria-label="Acceso al portal" className="mt-4" data-testid="fixture-current-reading" data-event-id={eventId}>
        <ConsumerPassportLink href={`/me/products?fromTap=1&eventId=${eventId}&tenant=qa-only&action=products`} eventId={eventId} freshToken={`synthetic-capability-${eventId}`} />
      </section> : <p data-testid="fixture-left-reading">Otra pantalla del ensayo</p>}
    </main>
  </SunLocaleProvider></StrictMode>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
