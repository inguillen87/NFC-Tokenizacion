import "../globals.css";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkPublishableKey } from "../../lib/clerk-env";
import { privateSurfaceMetadata } from "../../lib/private-surface-metadata";

export const metadata = privateSurfaceMetadata;

export default function Web3Layout({ children }: { children: ReactNode }) {
  const clerkKey = getClerkPublishableKey();
  return clerkKey ? <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider> : children;
}
