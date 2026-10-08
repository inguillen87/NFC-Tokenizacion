// Production map components in an isolated browser fixture; no customer or provider actions.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SunLocaleProvider } from "../../src/app/sun/sun-locale-provider";
import { isSunLocale, type SunLocale } from "../../src/app/sun/sun-locale";
import { ValleSecretoDemoMap } from "../../src/app/sun/valle-secreto-demo-map";

const params = new URLSearchParams(location.search);
const requestedLocale = params.get("locale");
const initialLocale: SunLocale = isSunLocale(requestedLocale) ? requestedLocale : "es-AR";
const fixtureWindow = window as unknown as {
  __qaRemount: (locale?: SunLocale) => void;
  __qaUnmount: () => void;
};

function Fixture() {
  const [locale, setLocale] = useState<SunLocale>(initialLocale);
  const [instance, setInstance] = useState(0);
  // Remounting exercises cleanup without the real locale-preference POST endpoint.
  fixtureWindow.__qaRemount = (nextLocale) => {
    if (nextLocale) setLocale(nextLocale);
    setInstance((value) => value + 1);
  };
  return (
    <SunLocaleProvider key={instance} initialLocale={locale}>
      <main className="sun-tap-experience sun-tap-shell" style={{ maxWidth: 1100, margin: "0 auto", padding: 12 }}>
        <h1 style={{ fontSize: 20 }}>SUN map · local QA</h1>
        <ValleSecretoDemoMap />
      </main>
    </SunLocaleProvider>
  );
}

const mount = document.getElementById("app");
if (!mount) throw new Error("QA fixture mount is missing");
const root = createRoot(mount);
fixtureWindow.__qaUnmount = () => root.unmount();
root.render(<Fixture />);
