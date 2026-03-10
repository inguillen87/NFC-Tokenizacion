import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base = "ui-btn inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70";
  const styles = {
    primary: "ui-btn--primary border border-cyan-300/35 bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]",
    secondary: "ui-btn--secondary border border-white/15 bg-white/5 text-white hover:bg-white/10",
    ghost: "ui-btn--ghost text-slate-200 hover:bg-white/5",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}
