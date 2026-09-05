// Local browser fixture: no real tag, capability or production endpoint.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { SunLocaleProvider } from "../../src/app/sun/sun-locale-provider";
import { SunLocationProvider, SunLocationRequestButton, SunLocationSummary, SunLocationOriginHeading } from "../../src/app/sun/sun-location-controller";
import { SunLocationExperience } from "../../src/app/sun/sun-location-experience";

function Fixture() {
  const [event, setEvent] = useState("local-fixture-1");
  const enabled = !new URLSearchParams(location.search).has("disabled");
  return (
    <StrictMode>
      <SunLocaleProvider initialLocale="es-AR">
        <p>PRUEBA LOCAL SIMULADA · sin datos ni validación productivos</p>
        <button id="next-tap" onClick={() => setEvent("local-fixture-2")}>Siguiente fixture</button>
        <SunLocationProvider key={event}>
          <section id="summary">
            <SunLocationSummary>
              <strong>Buenos Aires, AR · estimación de red</strong>
              <SunLocationRequestButton>Compartir ubicación aproximada del teléfono</SunLocationRequestButton>
            </SunLocationSummary>
          </section>
          <SunLocationOriginHeading><h2>Origen y zona estimada por red</h2></SunLocationOriginHeading>
          <SunLocationExperience
            origin={{ id: "fixture-origin", lat: -33.6, lng: -69.1, label: "Origen de muestra", evidence: "Simulado", source: "declared_origin" }}
            tap={{ id: "fixture-network", lat: -34.6, lng: -58.38, label: "Buenos Aires, AR", evidence: "Red simulada", source: "edge_ip_approx" }}
            showRoute={false}
            distanceLabel="Ejemplo"
            telemetry={{ endpoint: "/fixture-context", bid: "local-fixture-batch", uid: "local-fixture-unit", eventId: event, freshToken: "NOT-A-REAL-CAPABILITY", readCounter: 1, enabled }}
          />
        </SunLocationProvider>
      </SunLocaleProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
