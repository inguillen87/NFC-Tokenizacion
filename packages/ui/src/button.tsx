import * as React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function buttonClassName(variant: ButtonVariant = "primary", className = "") {
  const base = "ui-btn inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 motion-reduce:transform-none motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-55";
  const styles = {
    primary: "ui-btn--primary border border-cyan-300/35 bg-[linear-gradient(120deg,#22d3ee_0%,#06b6d4_48%,#0891b2_100%)] text-slate-950 hover:brightness-110 shadow-[0_0_24px_rgba(6,182,212,0.28)]",
    secondary: "ui-btn--secondary border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:shadow-[0_10px_28px_rgba(15,23,42,0.35)]",
    ghost: "ui-btn--ghost text-slate-200 hover:bg-white/5",
  } satisfies Record<ButtonVariant, string>;
  return `${base} ${styles[variant]} ${className}`;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button {...props} suppressHydrationWarning={props.suppressHydrationWarning ?? true} className={buttonClassName(variant, className)} />;
}
