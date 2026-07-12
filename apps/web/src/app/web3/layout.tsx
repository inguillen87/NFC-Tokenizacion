import type { ReactNode } from "react";
import { privateSurfaceMetadata } from "../../lib/private-surface-metadata";

export const metadata = privateSurfaceMetadata;

export default function Web3Layout({ children }: { children: ReactNode }) {
  return children;
}
