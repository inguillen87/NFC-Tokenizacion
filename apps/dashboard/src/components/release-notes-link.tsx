import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DASHBOARD_RELEASE, releaseCopy } from "../lib/dashboard-release";
import styles from "./release-notes.module.css";

export function ReleaseNotesLink({ locale }: { locale: string }) {
  return <Link href="/novedades" prefetch={false} className={styles.releaseLink} data-testid="dashboard-release-link">
    <span><strong>{releaseCopy(locale).link}</strong><small>{DASHBOARD_RELEASE}</small></span>
    <ArrowUpRight size={18} aria-hidden="true" />
  </Link>;
}
