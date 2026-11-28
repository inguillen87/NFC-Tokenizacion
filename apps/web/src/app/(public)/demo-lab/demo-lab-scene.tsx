import type { CSSProperties } from "react";
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
export function DemoLabScene({ profile, step, locale }: { profile: string; step: number; locale: string }) {
  const product = PROFILE_TO_PRODUCT[profile] ?? "wine";
  const meta = STORY_PRODUCTS.find((item) => item.key === product) ?? STORY_PRODUCTS[0];
  const copy = SCREEN_COPY[(locale in SCREEN_COPY ? locale : "es-AR") as SceneLocale];
  const style = { "--scene-accent": meta.accent, "--tag-top": meta.tagTop, "--tag-left": meta.tagLeft } as CSSProperties;

  return (
    <div className="demo-lab-scene" data-step={step} data-product={product} style={style} aria-hidden="true">
      <div className="demo-lab-scene__floor" />
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
  );
}
