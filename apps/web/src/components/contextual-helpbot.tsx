"use client";

import { HelpBot } from "@product/ui";
import type { AppLocale } from "@product/config";
import { usePathname } from "next/navigation";

export function ContextualHelpBot({ locale }: { locale: AppLocale }) {
  const pathname = usePathname() || "";

  if (pathname.startsWith("/sun") || pathname.startsWith("/me") || pathname.startsWith("/demo-lab")) {
    return null;
  }

  return <HelpBot locale={locale} mode="sales" />;
}
