"use client";
import type { ReactNode } from "react";
import { ThemeToggle } from "@product/ui";
import { SecureDashboardLogoutButton } from "./secure-dashboard-logout-button";
import styles from "./supplier-operator-shell.module.css";
export function SupplierOperatorShell({ children, label, clerkEnabled }: { children: ReactNode; label: string; clerkEnabled?: boolean }) {
  return <div className={styles.shell} data-testid="supplier-operator-shell"><header className={styles.header}><a href="/supplier-orders/requests" className={styles.brand}>NexID <span>Solicitudes asignadas</span></a><div className={styles.account}><span>{label}<small>Operador interno · acceso limitado</small></span><ThemeToggle /><SecureDashboardLogoutButton clerkEnabled={clerkEnabled} className={styles.logout} label="Cerrar sesión" /></div></header><div className={styles.content}>{children}</div></div>;
}
