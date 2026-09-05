"use client";

import { useEffect, useRef } from "react";
import { restoreHydratedPassportFragment } from "./passport-fragment-restoration";

export function PassportFragmentTarget() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = marker.current?.closest<HTMLElement>("section#pasaporte-digital");
    if (section) return restoreHydratedPassportFragment(section);
  }, []);

  return <span ref={marker} hidden aria-hidden="true" />;
}
