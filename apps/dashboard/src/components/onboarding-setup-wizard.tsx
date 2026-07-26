"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileCheck,
  Gem,
  Globe,
  Loader2,
  MapPin,
  Sprout,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { DashboardSession } from "../lib/session";
import styles from "./onboarding-setup-wizard.module.css";

type Props = {
  session: DashboardSession;
};

type VerticalInfo = {
  key: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  defaultClub: string;
  defaultProduct: string;
  defaultOrigin: string;
  defaultAddress: string;
  defaultLat: number;
  defaultLng: number;
};

const VERTICALS: VerticalInfo[] = [
  {
    key: "wine",
    name: "Bodega y vino",
    description: "Lotes, controles configurables de TT, origen declarado y experiencias para consumidor.",
    Icon: Wine,
    defaultClub: "Club Terroir",
    defaultProduct: "Gran Reserva",
    defaultOrigin: "Valle de Uco, Mendoza, AR",
    defaultAddress: "Ruta Provincial 94, Los Chacayes, Mendoza",
    defaultLat: -33.6267,
    defaultLng: -69.2558,
  },
  {
    key: "pharma",
    name: "Pharma y salud",
    description: "Cadena de frio reportada, controles de empaque configurables y evidencia regulatoria aportada.",
    Icon: Activity,
    defaultClub: "Pharma Trust Program",
    defaultProduct: "Producto termosensible",
    defaultOrigin: "Laboratorio Central, Buenos Aires, AR",
    defaultAddress: "Buenos Aires, Argentina",
    defaultLat: -34.5772,
    defaultLng: -58.4878,
  },
  {
    key: "luxury",
    name: "Lujo y coleccionables",
    description: "Evidencia digital configurable, garantia y titularidad digital transferible segun politica.",
    Icon: Gem,
    defaultClub: "Collectors Club",
    defaultProduct: "Edicion limitada",
    defaultOrigin: "Atelier Central, Madrid, ES",
    defaultAddress: "Madrid, Espana",
    defaultLat: 40.4278,
    defaultLng: -3.6872,
  },
  {
    key: "agro",
    name: "Agroindustrial",
    description: "Trazabilidad de lotes, canal autorizado y verificacion offline.",
    Icon: Sprout,
    defaultClub: "Agro Certificado",
    defaultProduct: "Insumo agricola fiscalizado",
    defaultOrigin: "Pampa Humeda, Cordoba, AR",
    defaultAddress: "Cordoba, Argentina",
    defaultLat: -32.4116,
    defaultLng: -63.2435,
  },
  {
    key: "documents",
    name: "Credenciales y diplomas",
    description: "Emision y verificacion publica de documentos firmados.",
    Icon: FileCheck,
    defaultClub: "Certificaciones Globales",
    defaultProduct: "Credencial verificable",
    defaultOrigin: "Sede emisora",
    defaultAddress: "Direccion de la entidad emisora",
    defaultLat: -33.4429,
    defaultLng: -70.6439,
  },
];

export function OnboardingSetupWizard({ session }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [selectedVertical, setSelectedVertical] = useState(VERTICALS[0]);
  const [tenantName, setTenantName] = useState("");
  const [clubName, setClubName] = useState(selectedVertical.defaultClub);
  const [productLabel, setProductLabel] = useState(selectedVertical.defaultProduct);
  const [originLabel, setOriginLabel] = useState(selectedVertical.defaultOrigin);
  const [originAddress, setOriginAddress] = useState(selectedVertical.defaultAddress);
  const [originLat, setOriginLat] = useState(String(selectedVertical.defaultLat));
  const [originLng, setOriginLng] = useState(String(selectedVertical.defaultLng));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (step === 2) stepHeadingRef.current?.focus();
  }, [step]);

  function selectVertical(vertical: VerticalInfo) {
    setSelectedVertical(vertical);
    setClubName(vertical.defaultClub);
    setProductLabel(vertical.defaultProduct);
    setOriginLabel(vertical.defaultOrigin);
    setOriginAddress(vertical.defaultAddress);
    setOriginLat(String(vertical.defaultLat));
    setOriginLng(String(vertical.defaultLng));
  }

  async function submitSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantName.trim()) {
      setError("Ingresa el nombre legal o comercial del tenant.");
      return;
    }
    const latitude = originLat.trim() === "" ? Number.NaN : Number(originLat);
    const longitude = originLng.trim() === "" ? Number.NaN : Number(originLng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError("Ingresa una latitud valida entre -90 y 90.");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError("Ingresa una longitud valida entre -180 y 180.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/tenant/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName: tenantName.trim(),
          vertical: selectedVertical.key,
          clubName: clubName.trim(),
          productLabel: productLabel.trim(),
          originLabel: originLabel.trim(),
          originAddress: originAddress.trim(),
          originLat: latitude,
          originLng: longitude,
        }),
      });
      const data = await response.json().catch(() => ({})) as { reason?: string };
      if (!response.ok) throw new Error(data.reason || "No se pudo guardar la configuracion.");
      setSuccess(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la configuracion.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <section className={styles.setupPanel} data-testid="tenant-setup-panel" aria-live="polite">
        <div className={styles.successIcon}><Check aria-hidden="true" /></div>
        <div>
          <span className={styles.eyebrow}>Workspace configurado</span>
          <h2>La identidad base del tenant quedo guardada.</h2>
          <p>La lectura operativa se actualizara con las nuevas politicas y defaults.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.setupPanel} data-testid="tenant-setup-panel" aria-labelledby="tenant-setup-title">
      <header className={styles.setupHeader}>
        <div>
          <span className={styles.eyebrow}>Setup obligatorio del workspace</span>
          <h2 id="tenant-setup-title">Define el contexto antes de emitir el primer lote.</h2>
          <p>
            Tenant <strong>{session.tenantSlug || "sin scope"}</strong>. Esta configuracion determina politica SUN,
            claim, manifest, origen declarado y experiencia por defecto. Gobierna evidencia y controles digitales; no
            certifica estado, autenticidad ni propiedad fisica.
          </p>
        </div>
        <div className={styles.stepCounter} aria-label={`Paso ${step} de 2`}>
          <span data-active={step === 1}>1</span>
          <i aria-hidden="true" />
          <span data-active={step === 2}>2</span>
        </div>
      </header>

      {step === 1 ? (
        <div className={styles.verticalStep}>
          <div className={styles.stepIntro}>
            <span>01</span>
            <div><h3>Selecciona la vertical</h3><p>Aplicamos una politica inicial que luego puede auditarse desde Settings y SDK.</p></div>
          </div>
          <div className={styles.verticalGrid} role="radiogroup" aria-label="Vertical del tenant">
            {VERTICALS.map((vertical) => {
              const selected = selectedVertical.key === vertical.key;
              return (
                <button
                  key={vertical.key}
                  type="button"
                  role="radio"
                  className={styles.verticalOption}
                  data-selected={selected}
                  aria-checked={selected}
                  onClick={() => selectVertical(vertical)}
                >
                  <vertical.Icon aria-hidden="true" />
                  <span><strong>{vertical.name}</strong><small>{vertical.description}</small></span>
                  {selected ? <Check aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={() => setStep(2)}>
              Continuar con datos base
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <form className={styles.detailsStep} onSubmit={submitSetup}>
          <div className={styles.stepIntro}>
            <span>02</span>
            <div><h3 ref={stepHeadingRef} tabIndex={-1}>Identidad, producto y origen</h3><p>Son defaults del tenant, no datos finales de cada unidad.</p></div>
          </div>
          <div className={styles.formGrid}>
            <Field id="tenant-name" label="Marca o empresa" value={tenantName} onChange={setTenantName} required Icon={Building2} />
            <Field id="product-label" label="Producto por defecto" value={productLabel} onChange={setProductLabel} />
            <Field id="club-name" label="Programa o club" value={clubName} onChange={setClubName} />
            <Field id="origin-label" label="Region de origen" value={originLabel} onChange={setOriginLabel} Icon={Globe} />
            <Field id="origin-address" label="Direccion operativa" value={originAddress} onChange={setOriginAddress} Icon={MapPin} wide />
            <Field id="origin-lat" label="Latitud" value={originLat} onChange={setOriginLat} type="number" required min={-90} max={90} />
            <Field id="origin-lng" label="Longitud" value={originLng} onChange={setOriginLng} type="number" required min={-180} max={180} />
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setStep(1)} disabled={pending}>
              <ArrowLeft aria-hidden="true" />
              Volver
            </button>
            <button type="submit" className={styles.primaryButton} disabled={pending}>
              {pending ? <Loader2 className={styles.spinner} aria-hidden="true" /> : <Check aria-hidden="true" />}
              {pending ? "Guardando..." : "Guardar configuracion"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required = false,
  type = "text",
  min,
  max,
  wide = false,
  Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "number";
  min?: number;
  max?: number;
  wide?: boolean;
  Icon?: LucideIcon;
}) {
  return (
    <label htmlFor={id} className={wide ? styles.wideField : undefined}>
      <span>{Icon ? <Icon aria-hidden="true" /> : null}{label}{required ? " *" : ""}</span>
      <input
        id={id}
        type={type}
        step={type === "number" ? "any" : undefined}
        min={min}
        max={max}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={id === "tenant-name" ? "organization" : "off"}
      />
    </label>
  );
}
