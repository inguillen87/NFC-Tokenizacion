"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type ProofFocusTargetProps = {
  targetId: string;
  returnHref: string;
  returnLabel: string;
};

export function ProofFocusTarget({
  targetId,
  returnHref,
  returnLabel,
}: ProofFocusTargetProps) {
  useEffect(() => {
    if (!targetId) return;

    const focusTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    };

    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(focusTarget));
    const timer = window.setTimeout(focusTarget, 250);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [targetId]);

  if (!targetId) return null;

  return (
    <nav className="proof-focus-return" aria-label="Continuidad de Proof Verify">
      <Link href={returnHref} className="proof-focus-return__link">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>{returnLabel}</span>
      </Link>
    </nav>
  );
}
