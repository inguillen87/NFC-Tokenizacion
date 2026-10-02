// Local synthetic media and React prop changes; no product, signed TAP or endpoint.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SunLocaleProvider } from "../../src/app/sun/sun-locale-provider";
import { SunProductImage } from "../../src/app/sun/sun-product-image";

function Fixture() {
  const query = new URLSearchParams(location.search);
  const requested = query.get("locale");
  const locale = requested === "en" || requested === "pt-BR" ? requested : "es-AR";
  const [source, setSource] = useState("/slow-photo.svg");
  const [instance, setInstance] = useState(0);
  const [zoomable, setZoomable] = useState(true);
  useEffect(() => {
    const change = (event: Event) => setSource((event as CustomEvent<string>).detail);
    const remount = () => setInstance((previous) => previous + 1);
    const disable = () => setZoomable(false);
    window.addEventListener("fixture-source", change);
    window.addEventListener("fixture-remount", remount);
    window.addEventListener("fixture-disable-zoom", disable);
    return () => {
      window.removeEventListener("fixture-source", change);
      window.removeEventListener("fixture-remount", remount);
      window.removeEventListener("fixture-disable-zoom", disable);
    };
  }, []);
  return <StrictMode><SunLocaleProvider initialLocale={locale}>
    <p>LOCAL SYNTHETIC IMAGE COMPONENT · no TAP or production data</p>
    <button id="outside">Outside fixture control</button>
    <div className="photo" data-fixture-instance={instance}>
      <SunProductImage key={instance} src={source} alt="Producto de prueba" priority zoomable={zoomable} />
    </div>
  </SunLocaleProvider></StrictMode>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
