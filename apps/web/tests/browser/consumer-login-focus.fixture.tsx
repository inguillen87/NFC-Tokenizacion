// Actual login/contact components; every request stays in this synthetic fixture.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConsumerLoginPanel } from "../../src/app/login/consumer-login-panel";

const state = Object.assign(window, {
  __loginFocusCalls: [] as { path: string; method: string }[],
  __loginFocusPending: null as string | null,
  __loginFocusResolve: null as ((status: number, payload: unknown) => void) | null,
  __loginFocusNavigation: [] as string[],
});
window.fetch = async (input, init) => {
  if (typeof input !== "string" || !["/api/consumer/auth/logout", "/api/consumer/auth/start", "/api/consumer/auth/verify"].includes(input)) throw Error("unexpected_fixture_request");
  state.__loginFocusCalls.push({ path: input, method: init?.method || "GET" });
  if (input === "/api/consumer/auth/logout") return new Response(JSON.stringify({ ok: true }), { status: 200 });
  state.__loginFocusPending = input;
  return new Promise<Response>((resolve, reject) => {
    state.__loginFocusResolve = (status, payload) => {
      state.__loginFocusPending = null;
      state.__loginFocusResolve = null;
      resolve(new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } }));
    };
    init?.signal?.addEventListener("abort", () => { state.__loginFocusPending = null; reject(Error("synthetic_request_aborted")); }, { once: true });
  });
};
function Fixture() {
  const [visible, setVisible] = useState(true);
  return <main><h1>Acceso · ensayo local de foco</h1>
    <button id="read-elsewhere" className="outside-control" type="button">Seguir leyendo</button>
    <button id="close-login" className="outside-control" type="button" onClick={() => setVisible(false)}>Cerrar acceso del ensayo</button>
    {visible ? <ConsumerLoginPanel nextPath="/me/products?fromTap=1&eventId=715&tenant=qa-only&action=products" /> : <p id="closed-login">Acceso cerrado</p>}
    <section aria-label="Lectura fuera del formulario" className="reading"><h2>Información de la experiencia</h2><p>Texto de ensayo para desplazarse mientras responde el formulario. No usa una cuenta ni una lectura real.</p></section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
