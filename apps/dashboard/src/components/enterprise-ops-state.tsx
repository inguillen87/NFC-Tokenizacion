import type { ReactNode } from "react";
import { CircleAlert, CircleOff, LoaderCircle, TriangleAlert } from "lucide-react";

export type EnterpriseOpsStateVariant = "loading" | "empty" | "warning" | "error";

const VARIANT_STYLES: Record<EnterpriseOpsStateVariant, { border: string; surface: string; icon: string; bullet: string }> = {
  loading: {
    border: "border-cyan-300/25",
    surface: "bg-cyan-400/[0.06]",
    icon: "text-cyan-300",
    bullet: "bg-cyan-300",
  },
  empty: {
    border: "border-slate-600/70",
    surface: "bg-slate-900/70",
    icon: "text-slate-300",
    bullet: "bg-slate-300",
  },
  warning: {
    border: "border-amber-300/30",
    surface: "bg-amber-400/[0.07]",
    icon: "text-amber-200",
    bullet: "bg-amber-200",
  },
  error: {
    border: "border-rose-300/35",
    surface: "bg-rose-400/[0.07]",
    icon: "text-rose-200",
    bullet: "bg-rose-200",
  },
};

function StateIcon({ variant, className }: { variant: EnterpriseOpsStateVariant; className: string }) {
  if (variant === "loading") return <LoaderCircle className={`${className} animate-spin motion-reduce:animate-none`} aria-hidden="true" />;
  if (variant === "empty") return <CircleOff className={className} aria-hidden="true" />;
  if (variant === "warning") return <TriangleAlert className={className} aria-hidden="true" />;
  return <CircleAlert className={className} aria-hidden="true" />;
}

export function EnterpriseOpsState({
  variant,
  title,
  description,
  checklist = [],
  action,
  compact = false,
  testId,
}: {
  variant: EnterpriseOpsStateVariant;
  title: string;
  description: string;
  checklist?: string[];
  action?: ReactNode;
  compact?: boolean;
  testId?: string;
}) {
  const style = VARIANT_STYLES[variant];
  const isError = variant === "error";

  return (
    <section
      aria-atomic="true"
      aria-busy={variant === "loading"}
      aria-live={isError ? "assertive" : "polite"}
      className={`rounded-2xl border ${style.border} ${style.surface} ${compact ? "p-3" : "p-5 sm:p-6"}`}
      data-testid={testId || `enterprise-ops-state-${variant}`}
      role={isError ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        <span className={`grid shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-950/60 ${compact ? "h-9 w-9" : "h-11 w-11"}`}>
          <StateIcon variant={variant} className={`${compact ? "h-4 w-4" : "h-5 w-5"} ${style.icon}`} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`${compact ? "text-sm" : "text-base"} font-black text-white`}>{title}</h2>
          <p className={`${compact ? "mt-1 text-xs" : "mt-2 text-sm"} max-w-3xl leading-6 text-slate-300`}>{description}</p>
          {checklist.length ? (
            <ul className={`${compact ? "mt-2" : "mt-3"} grid gap-1 text-xs text-slate-400 sm:grid-cols-2`}>
              {checklist.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.bullet}`} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {action ? <div className={`${compact ? "mt-2" : "mt-4"} flex flex-wrap gap-2`}>{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
