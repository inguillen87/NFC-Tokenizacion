"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import "./demo-lab-scene.css";
import { BadgeCheck, CheckCircle2, Gift, Nfc, ShieldCheck, Wrench } from "lucide-react";
import { STORY_PRODUCTS, StoryProduct, type StoryProductKey } from "../../../components/story-products";

type SceneLocale = "es-AR" | "en" | "pt-BR";


const PROFILE_TO_PRODUCT: Readonly<Record<string, StoryProductKey>> = {
  wine: "wine",
  perfume: "perfume",
  fragrance: "perfume",
  agro: "seeds",
  agrochem: "jerrycan",
};

const SCREEN_COPY: Record<SceneLocale, { ready: string; readyHint: string; read: string; readHint: string; services: [string, string, string]; done: string; doneHint: string }> = {
  "es-AR": {
    ready: "Acercá el celular",
    readyHint: "Sin instalar una app",
    read: "Sello comprobado",
    readHint: "Lectura nueva y única",
    services: ["Garantía", "Beneficio", "Soporte"],
    done: "Listo",
    doneHint: "La marca recibió la señal",
  },
  en: {
    ready: "Hold your phone close",
    readyHint: "No app to install",
    read: "Seal verified",
    readHint: "Fresh, single-use read",
    services: ["Warranty", "Benefit", "Support"],
    done: "Done",
    doneHint: "The brand received the signal",
  },
  "pt-BR": {
    ready: "Aproxime o celular",
    readyHint: "Sem instalar app",
    read: "Lacre comprovado",
    readHint: "Leitura nova e única",
    services: ["Garantia", "Benefício", "Suporte"],
    done: "Pronto",
    doneHint: "A marca recebeu o sinal",
  },
};

/**
 * Illustrated, unbranded 3D scene for the guided Demo Lab journey.
 * Decorative: the surrounding group carries the accessible label and the
 * live status bubble narrates each step.
 */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function DemoLabScene({ profile, step, locale, orbit = false }: { profile: string; step: number; locale: string; orbit?: boolean }) {
  const [angle, setAngle] = useState({ x: -6, y: -18 });
  const [dragging, setDragging] = useState(false);
  const origin = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!orbit) return;
    origin.current = { px: event.clientX, py: event.clientY, x: angle.x, y: angle.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = origin.current;
    if (!orbit || !start) return;
    setAngle({
      x: clamp(start.x - (event.clientY - start.py) * 0.12, -16, 10),
      y: clamp(start.y + (event.clientX - start.px) * 0.22, -38, 38),
    });
  };
  const onPointerUp = () => {
    origin.current = null;
    setDragging(false);
  };
  const product = PROFILE_TO_PRODUCT[profile] ?? "wine";
  const meta = STORY_PRODUCTS.find((item) => item.key === product) ?? STORY_PRODUCTS[0];
  const copy = SCREEN_COPY[(locale in SCREEN_COPY ? locale : "es-AR") as SceneLocale];
  const style = {
    "--scene-accent": meta.accent,
    "--tag-top": meta.tagTop,
    "--tag-left": meta.tagLeft,
    "--rx": `${orbit ? angle.x : 0}deg`,
    "--ry": `${orbit ? angle.y : 0}deg`,
    "--sheen": `${50 + (orbit ? angle.y : 0) * 1.4}%`,
  } as CSSProperties;

  return (
    <div
      className="demo-lab-scene"
      data-step={step}
      data-product={product}
      data-orbit={orbit ? (dragging ? "dragging" : "idle") : undefined}
      style={style}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="demo-lab-scene__stage">
      <div className="demo-lab-scene__floor" />
      <div className="demo-lab-scene__shadow" />
      <div className="demo-lab-scene__product">
        <StoryProduct product={product} idPrefix="demo-lab-scene-" />
        <span className="demo-lab-scene__tag"><i /><i /><i /></span>
      </div>
      <div className="demo-lab-scene__beam" />
      <div className="demo-lab-scene__phone">
        <div className="demo-lab-scene__screen">
          <span className="demo-lab-scene__notch" />
          {step === 0 ? (
            <div className="demo-lab-scene__view" key="ready">
              <span className="demo-lab-scene__icon demo-lab-scene__icon--pulse"><Nfc /></span>
              <b>{copy.ready}</b>
              <small>{copy.readyHint}</small>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="demo-lab-scene__view" key="read">
              <span className="demo-lab-scene__seal"><ShieldCheck /></span>
              <b>{copy.read}</b>
              <small>{copy.readHint}</small>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="demo-lab-scene__view demo-lab-scene__view--list" key="services">
              <span className="demo-lab-scene__row"><BadgeCheck />{copy.services[0]}</span>
              <span className="demo-lab-scene__row"><Gift />{copy.services[1]}</span>
              <span className="demo-lab-scene__row"><Wrench />{copy.services[2]}</span>
            </div>
          ) : null}
          {step >= 3 ? (
            <div className="demo-lab-scene__view" key="done">
              <span className="demo-lab-scene__seal demo-lab-scene__seal--done"><CheckCircle2 /></span>
              <b>{copy.done}</b>
              <small>{copy.doneHint}</small>
            </div>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}
