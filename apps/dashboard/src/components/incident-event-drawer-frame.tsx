"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import styles from "./incident-event-drawer-frame.module.css";

export type IncidentEventDrawerNavigation = {
  position: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
};

export function IncidentEventDrawerFrame({
  eventKey,
  title,
  description,
  navigation,
  navigationDisabled = false,
  onClose,
  children,
}: {
  eventKey: string;
  title: string;
  description: string;
  navigation?: IncidentEventDrawerNavigation;
  navigationDisabled?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => setPortalTarget(document.body), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!portalTarget || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rootOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });

    return () => {
      dialog.close();
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
      window.requestAnimationFrame(() => {
        // A next/previous transition mounts another dialog. Only closing the
        // final detail should return focus to its row in the background list.
        if (document.querySelector('dialog[data-testid="incident-event-drawer"][open]')) return;
        const selectedRow = Array.from(document.querySelectorAll<HTMLElement>("[data-incident-event-key]"))
          .find((element) => element.dataset.incidentEventKey === eventKey);
        const returnTarget = selectedRow || (previousFocus?.isConnected ? previousFocus : null)
          || document.querySelector<HTMLElement>("[data-incident-event-list]");
        returnTarget?.focus({ preventScroll: true });
      });
    };
  }, [eventKey, portalTarget]);

  if (!portalTarget) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      data-testid="incident-event-drawer"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.getClientRects().length > 0 && !element.closest("[inert]"));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.panel}>
        <header className={styles.header} data-testid="incident-drawer-header">
          <div className={styles.heading}>
            <p className={styles.eyebrow}>Detalle de la lectura</p>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId} className={styles.description}>{description}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className={styles.closeButton} aria-label="Cerrar detalle">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={styles.content} data-testid="incident-drawer-content">{children}</div>

        <footer className={styles.footer}>
          {navigation && navigation.total > 1 ? (
            <nav className={styles.navigation} aria-label="Lecturas de la lista abierta">
              <button type="button" onClick={navigation.onPrevious} disabled={navigationDisabled || !navigation.onPrevious}>
                <ChevronLeft aria-hidden="true" /> Anterior
              </button>
              <span role="status" aria-live="polite">{navigation.position} de {navigation.total}</span>
              <button type="button" onClick={navigation.onNext} disabled={navigationDisabled || !navigation.onNext}>
                Siguiente <ChevronRight aria-hidden="true" />
              </button>
            </nav>
          ) : null}
          <button type="button" onClick={onClose} className={styles.returnButton}>
            <ArrowLeft aria-hidden="true" /> Volver a últimos eventos
          </button>
        </footer>
      </div>
    </dialog>,
    portalTarget,
  );
}
