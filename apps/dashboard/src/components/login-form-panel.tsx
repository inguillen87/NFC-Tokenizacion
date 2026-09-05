"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@product/ui";
import { ArrowRight, Building2, CheckCircle2, CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";
import type { PublicAccessProfile } from "../lib/access-profiles";
import { ClerkGoogleSuperAdminButton } from "./clerk-google-super-admin-button";
import { normalizeDashboardReturnPath } from "../lib/dashboard-return-path";
import styles from "./login-entry.module.css";

type Props = {
  emailPlaceholder: string;
  passwordPlaceholder: string;
  loginAction: string;
  registerLabel: string;
  forgotLabel: string;
  inviteLabel: string;
  profiles: PublicAccessProfile[];
  bodegaDemoAllowed: boolean;
  clerkEnabled?: boolean;
  clerkRecoveryRequired?: boolean;
  authNotice?: string;
  nextPath?: string;
};

export function LoginFormPanel({
  emailPlaceholder,
  passwordPlaceholder,
  registerLabel,
  forgotLabel,
  inviteLabel,
  profiles,
  bodegaDemoAllowed,
  clerkEnabled,
  clerkRecoveryRequired = false,
  authNotice,
  nextPath = "/",
}: Props) {
  const LOGIN_TIMEOUT_MS = 10_000;
  const hasAvailableProfiles = profiles.some((profile) => profile.available);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profileLabel, setProfileLabel] = useState("");
  const [status, setStatus] = useState("");
  const [opsStatus, setOpsStatus] = useState("");
  const [pending, setPending] = useState(false);
  const requestInFlight = useRef(false);
  const safeNextPath = normalizeDashboardReturnPath(nextPath);
  const accessPaths = [
    {
      label: "Demo interactiva",
      value: bodegaDemoAllowed ? "Disponible" : "Pendiente",
      detail: "Datos ilustrativos, separados de los TAP físicos y de la información de tu empresa.",
      ok: bodegaDemoAllowed,
    },
    {
      label: "Super Admin",
      value: clerkEnabled ? "Google configurado" : "Configuración pendiente",
      detail: "El ingreso requiere una cuenta Google autorizada por nexID. La demo no concede acceso global.",
      ok: Boolean(clerkEnabled),
    },
    {
      label: "Equipo operativo",
      value: "Correo y contraseña",
      detail: "La cuenta debe estar asignada a una empresa. Los atajos de correo no confirman que una cuenta esté activa.",
      ok: hasAvailableProfiles,
    },
  ];

  function formatDiagnostics(input: unknown) {
    if (!input || typeof input !== "object") return "";
    const diagnostics = input as Record<string, unknown>;
    const missingEnvNames = Array.isArray(diagnostics.missingEnvNames)
      ? diagnostics.missingEnvNames.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
    const parts: string[] = [];
    if (diagnostics.apiBaseConfigured === false) parts.push("API base no configurada.");
    if (diagnostics.upstreamReachable === false) parts.push("Upstream auth no disponible.");
    if (diagnostics.demoLoginAllowed === false) parts.push("Acceso temporal deshabilitado.");
    if (missingEnvNames.length) parts.push(`Faltan env: ${missingEnvNames.join(", ")}`);
    return parts.join(" ");
  }

  function useProfile(profile: PublicAccessProfile) {
    setEmail(profile.email);
    setPassword("");
    setProfileLabel(profile.label);
    setStatus("");
    setOpsStatus("");
  }

  async function submit(input?: { email?: string; password?: string }) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setPending(true);
    setStatus("");
    setOpsStatus("");
    const loginEmail = input?.email ?? email;
    const loginPassword = input?.password ?? password;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      const diagnosticsNote = formatDiagnostics(data?.diagnostics);
      if (diagnosticsNote) setOpsStatus(diagnosticsNote);
      if (data?.code === "superadmin_requires_clerk") {
        setStatus("Super Admin ingresa únicamente con Google/Clerk y allowlist server-side.");
      } else if (data?.code === "auth_upstream_not_configured") {
        setStatus("El acceso tenant no está conectado a una API explícita en este entorno.");
      } else if (res?.status === 429) {
        setStatus("Demasiados intentos. Esperá unos minutos antes de volver a ingresar.");
      } else if (res?.status === 502) {
        setStatus("Servicio de autenticación no disponible temporalmente.");
      } else if (res?.status === 403) {
        setStatus("Acceso denegado por política y alcance del entorno.");
      } else if (res?.status === 401) {
        setStatus("Credenciales inválidas.");
      } else if (res?.status && res.status >= 500) {
        setStatus("Error interno al autenticar.");
      } else if (!res) {
        setStatus("El ingreso tardó demasiado o no hubo respuesta. Tus datos siguen aquí; reintentá en unos segundos.");
      } else {
        setStatus(data?.reason || "Credenciales inválidas.");
      }
      setPending(false);
      requestInFlight.current = false;
      return;
    }
    window.location.assign(safeNextPath);
  }

  return (
    <div data-testid="login-enterprise-access-panel" className={`dashboard-auth-access-flow ${styles.accessFlow}`}>
      <form
        id="tenant-credentials"
        aria-labelledby="tenant-login-heading"
        aria-busy={pending}
        className={`dashboard-auth-manual-access ${styles.tenantForm}`}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div data-testid="login-real-tenant-entry" className={styles.formHeading}>
          <span className={styles.accessIcon}><Building2 aria-hidden="true" size={22} /></span>
          <div>
            <p className={styles.eyebrow}>Acceso a tu empresa</p>
            <h2 id="tenant-login-heading">Ingresar a mi empresa</h2>
          </div>
        </div>
        <p id="tenant-access-description" className={styles.formDescription}>
          Consultá tus TAP físicos, productos y CRM con la cuenta que te asignó tu empresa.
        </p>
        <div className={styles.field}>
          <label htmlFor="tenant-email">Correo electrónico</label>
          <input suppressHydrationWarning
            id="tenant-email"
            type="email"
            name="email"
            required
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            disabled={pending}
            className="dashboard-auth-input"
            placeholder={emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="tenant-password">Contraseña</label>
          <div className={styles.passwordField}>
            <input suppressHydrationWarning
              id="tenant-password"
              type={showPassword ? "text" : "password"}
              name="password"
              required
              autoComplete="current-password"
              disabled={pending}
              className="dashboard-auth-input"
              placeholder={passwordPlaceholder}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-controls="tenant-password"
              aria-pressed={showPassword}
              disabled={pending}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
            </button>
          </div>
        </div>
        {profileLabel ? <p className={styles.selectedProfile}>Correo seleccionado: {profileLabel}. Los permisos se verifican al ingresar.</p> : null}
        <Button type="submit" className={styles.submitButton} disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className={styles.spinner} size={18} /> : <LockKeyhole aria-hidden="true" size={18} />}
          {pending ? "Verificando acceso…" : "Ingresar a mi empresa"}
          {!pending ? <ArrowRight aria-hidden="true" size={18} /> : null}
        </Button>
        <div aria-live="polite" aria-atomic="true">
          {status ? <p role="alert" className={styles.errorMessage}>{status}</p> : null}
          {pending ? <p className={styles.pendingMessage}>Estamos verificando tu cuenta. No cierres esta ventana.</p> : null}
        </div>
        {opsStatus ? <details className={styles.diagnostics}><summary>Detalle para soporte</summary><p>{opsStatus}</p></details> : null}
        <p className={styles.accessHint}><KeyRound aria-hidden="true" size={16} /> ¿Todavía no tenés acceso? Pedile una cuenta al administrador de tu empresa.</p>
      </form>

      <div className={styles.alternativeHeading}><span>Otras formas de explorar nexID</span></div>
      <div className="dashboard-auth-primary-actions grid gap-3">
        <div data-testid="login-bodega-demo-card" className={`dashboard-auth-feature-card ${styles.demoCard}`}>
          <div className={styles.demoHeading}>
            <span className={styles.demoIcon}><Building2 aria-hidden="true" size={20} /></span>
            <div><p className={styles.eyebrow}>Sin cuenta · Datos ilustrativos</p><h2>Demo interactiva</h2></div>
          </div>
          <p>Explorá el CRM, el mapa y los eventos de ejemplo. <strong>No muestra tus TAP físicos ni datos de tu empresa.</strong></p>
          {bodegaDemoAllowed ? (
            <form action={`/api/session/demo?role=tenant-admin&next=${encodeURIComponent(safeNextPath)}`} method="post">
              <button type="submit" data-testid="login-bodega-demo-button" className={styles.demoButton}>
                Abrir demo interactiva <ArrowRight aria-hidden="true" size={18} />
              </button>
            </form>
          ) : <p className={styles.unavailable}>La demo no está habilitada en este entorno. El acceso a tu empresa es independiente.</p>}
        </div>

        <details className="dashboard-auth-disclosure rounded-2xl border border-white/10" open={Boolean(authNotice)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black text-white">
            <span>Super Admin</span>
            <span className="text-xs font-semibold text-slate-400">Cuenta Google autorizada</span>
          </summary>
          <div data-testid="login-superadmin-google-card" className={`dashboard-auth-panel ${styles.superAdminContent}`}>
            <p><ShieldCheck aria-hidden="true" size={20} /> Administración global de nexID. Super Admin entra por Google/Clerk; los permisos se verifican en el servidor.</p>
            {authNotice ? <p role="status" className={styles.unavailable}>{authNotice}</p> : null}
            {clerkEnabled ? <>
              <ClerkGoogleSuperAdminButton
                label={clerkRecoveryRequired ? "Reiniciar sesión Google" : "Continuar con Google allowlisted"}
                nextPath={safeNextPath}
                resetSessionOnStart={clerkRecoveryRequired}
              />
              <Link href={`/sign-in?next=${encodeURIComponent(safeNextPath)}`} className={styles.fullscreenLink}>Abrir ingreso seguro en pantalla completa</Link>
            </> : <p data-testid="login-clerk-config-warning" className={styles.unavailable}>El ingreso con Google todavía no está configurado en este entorno. Contactá al equipo de nexID.</p>}
          </div>
        </details>
      </div>

      <details data-testid="login-credentials-panel" className={`dashboard-auth-disclosure ${styles.secondaryDisclosure}`}>
        <summary>Ayuda y opciones de acceso</summary>
        <div className={styles.supportContent}>
          <p>Requiere una cuenta tenant real; conserva aislamiento, permisos y trazabilidad. Una cuenta del portal consumidor no da acceso al dashboard de una empresa.</p>
          <p>Los TAP físicos de Bodega Balmec se consultan con una cuenta asignada a esa empresa, no desde la demo interactiva.</p>
          {hasAvailableProfiles ? <div className={styles.profileList}>
            <p>Atajos de correo configurados. Elegir uno no inicia sesión ni confirma permisos.</p>
            {profiles.filter((profile) => profile.available).map((profile) => (
              <button key={profile.key} type="button" disabled={pending} data-availability="available" className="dashboard-auth-profile-card" onClick={() => useProfile(profile)}>
                <UserCheck aria-hidden="true" size={18} /><span>{profile.label}<small>{profile.email}</small></span>
              </button>
            ))}
          </div> : null}
          <nav aria-label="Opciones de acceso" className={styles.supportLinks}>
            <Link href="/register">{registerLabel}</Link>
            <Link href="/forgot-password">{forgotLabel}</Link>
            <Link href="/invite-user">{inviteLabel}</Link>
          </nav>
          <p className={styles.securityNote}>TOTP nexID está temporalmente bloqueado. Esta pantalla no ofrece ingreso por código de correo ni promete doble factor.</p>
          <a href="https://nexid.lat/login" className={styles.fullscreenLink}>Ir al portal consumidor <ArrowRight aria-hidden="true" size={16} /></a>
        </div>
      </details>
      <details data-testid="login-access-status" className="dashboard-auth-access-status dashboard-auth-disclosure mb-3 rounded-2xl border border-white/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black text-white">
          <span>Estado del entorno</span>
          <span className="text-xs font-semibold text-slate-400">Ver disponibilidad y alcance</span>
        </summary>
        <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-3">
          {accessPaths.map((item) => (
            <div
              key={item.label}
              data-state={item.ok ? "ready" : "attention"}
              className={`rounded-2xl border px-3 py-3 ${
                item.ok
                  ? "border-emerald-300/20 bg-emerald-400/10"
                  : "border-amber-300/24 bg-amber-400/10"
              } dashboard-auth-status-card`}
            >
              <div className="flex items-center gap-2">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
                ) : (
                  <CircleAlert className="h-4 w-4 shrink-0 text-amber-200" />
                )}
                <p className="min-w-0 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{item.label}</p>
              </div>
              <p className="mt-2 text-sm font-black text-white">{item.value}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
