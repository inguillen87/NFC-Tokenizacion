import Link from "next/link";
import type { ReactNode } from "react";

export const productExitHref = {
  demoLab: "/demo-lab",
  investorSnapshot: "/investor-snapshot",
} as const;

type ProductExitKind = keyof typeof productExitHref;

type ProductExitLinkProps = {
  kind: ProductExitKind;
  children: ReactNode;
  className?: string;
};

export function ProductExitLink({ kind, children, className = "" }: ProductExitLinkProps) {
  return (
    <Link href={productExitHref[kind]} className={className}>
      {children}
    </Link>
  );
}
