import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type PublicLinkChipProps = {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  variant?: "slate" | "cyan" | "indigo" | "emerald" | "amber" | "violet";
  size?: "sm" | "md";
  trailingArrow?: boolean;
};

const variantClasses = {
  slate: "border-white/10 bg-white/5 text-slate-100 hover:border-white/20",
  cyan: "border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300/45",
  indigo: "border-indigo-300/30 bg-indigo-500/10 text-indigo-100 hover:border-indigo-300/45",
  emerald: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/45",
  amber: "border-amber-300/30 bg-amber-500/10 text-amber-100 hover:border-amber-300/45",
  violet: "border-violet-300/30 bg-violet-500/10 text-violet-100 hover:border-violet-300/45",
} as const;

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export function PublicLinkChip({
  href,
  children,
  icon,
  className = "",
  variant = "slate",
  size = "sm",
  trailingArrow = false,
}: PublicLinkChipProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border font-medium transition-transform duration-200 hover:-translate-y-0.5 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
    >
      {icon}
      <span>{children}</span>
      {trailingArrow ? <ArrowRight className="h-4 w-4" /> : null}
    </Link>
  );
}
