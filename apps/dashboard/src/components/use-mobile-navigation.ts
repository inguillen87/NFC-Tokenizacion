"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

/** Modal mobile drawer with keyboard focus management. */
export function useMobileNavigation(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
  navigationRef: RefObject<HTMLElement>,
  triggerRef: RefObject<HTMLButtonElement>,
  contentRef: RefObject<HTMLDivElement>,
) {
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia("(max-width: 1023px)");
    if (!media.matches) { setOpen(false); return; }
    const navigation = navigationRef.current;
    const content = contentRef.current;
    if (!navigation || !content) return;
    const previousOverflow = document.body.style.overflow;
    const previousInert = content.hasAttribute("inert");
    document.body.style.overflow = "hidden";
    content.setAttribute("inert", "");
    const focusable = () => Array.from(navigation.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex="0"]',
    )).filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
    focusable()[0]?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (!navigation.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const resize = () => { if (!media.matches) setOpen(false); };
    document.addEventListener("keydown", keydown);
    media.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", keydown);
      media.removeEventListener("change", resize);
      document.body.style.overflow = previousOverflow;
      if (!previousInert) content.removeAttribute("inert");
      if (media.matches && triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [open, setOpen, navigationRef, triggerRef, contentRef]);
}
