import type { ReactNode } from "react";
import { privateSurfaceMetadata } from "../../lib/private-surface-metadata";

export const metadata = privateSurfaceMetadata;

export default function ConsumerPortalLayout({ children }: { children: ReactNode }) {
  return children;
}
