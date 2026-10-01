import "../globals.css";
import type { ReactNode } from "react";

// Full site styles stay on non-SUN routes; public passport entry uses its smaller bundle.
export default function SiteStylesLayout({ children }: { children: ReactNode }) { return children; }
