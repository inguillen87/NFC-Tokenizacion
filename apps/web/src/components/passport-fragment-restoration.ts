/** Focus a native initial fragment after its document and font layout are ready. */
export function focusInitialPassportFragment(browser: Window = window) {
  const document = browser.document;
  const hash = "#pasaporte-digital";
  const navigation = browser.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (browser.location.pathname !== "/" || browser.location.hash !== hash || navigation?.type === "back_forward") {
    return () => {};
  }

  let cancelled = false;
  let frame: number | undefined;
  const interruptEvents = ["wheel", "touchstart", "pointerdown", "keydown", "hashchange", "popstate"] as const;

  function cleanup() {
    cancelled = true;
    if (frame !== undefined) browser.cancelAnimationFrame(frame);
    browser.removeEventListener("load", schedule);
    for (const event of interruptEvents) browser.removeEventListener(event, cleanup);
  }

  function focus() {
    frame = undefined;
    if (cancelled) return;
    const section = document.getElementById("pasaporte-digital");
    const heading = section?.querySelector<HTMLElement>("h1, h2, h3") ?? section;
    const active = document.activeElement;
    const eligible = browser.location.pathname === "/" && browser.location.hash === hash
      && heading?.isConnected && heading.getClientRects().length > 0 && !heading.closest("[hidden], [inert]")
      && (!active || active === document.body || active === document.documentElement || active === section || active === heading);
    cleanup();
    if (!eligible || !heading) return;
    if (!heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    }
    heading.focus({ preventScroll: true });
  }

  function schedule() {
    Promise.resolve(document.fonts?.ready).then(() => {
      if (!cancelled) frame = browser.requestAnimationFrame(focus);
    }, cleanup);
  }

  for (const event of interruptEvents) browser.addEventListener(event, cleanup, { passive: true });
  if (document.readyState === "complete") schedule();
  else browser.addEventListener("load", schedule, { once: true });
  return cleanup;
}

/** Recover an initial fragment missed while the passport was in a streamed boundary. */
export function restoreHydratedPassportFragment(target: HTMLElement, browser: Window = window) {
  const document = target.ownerDocument;
  const hash = `#${target.id}`;
  const navigation = browser.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

  // Native scrolling and history restoration take precedence over this fallback.
  if (browser.location.hash !== hash || browser.scrollY > 2 || navigation?.type === "back_forward") {
    return () => {};
  }

  let cancelled = false;
  let frame: number | undefined;
  const interruptEvents = ["wheel", "touchstart", "pointerdown", "keydown", "hashchange", "popstate"] as const;

  function cleanup() {
    cancelled = true;
    if (frame !== undefined) browser.cancelAnimationFrame(frame);
    browser.removeEventListener("load", schedule);
    browser.removeEventListener("scroll", onScroll);
    for (const event of interruptEvents) browser.removeEventListener(event, cleanup);
  }

  function onScroll() {
    if (browser.scrollY > 2) cleanup();
  }

  function restore() {
    frame = undefined;
    if (cancelled) return;
    const eligible = browser.location.hash === hash
      && browser.scrollY <= 2
      && target.isConnected
      && target.getClientRects().length > 0
      && target.getBoundingClientRect().height > 0
      && !target.closest("[hidden], [inert]");
    cleanup();
    // Instant honors the section's scroll-margin without starting a second animation.
    if (eligible) target.scrollIntoView({ block: "start", behavior: "instant" });
  }

  function schedule() {
    Promise.resolve(document.fonts?.ready).then(() => {
      if (!cancelled) frame = browser.requestAnimationFrame(restore);
    }, cleanup);
  }

  for (const event of interruptEvents) browser.addEventListener(event, cleanup, { passive: true });
  browser.addEventListener("scroll", onScroll, { passive: true });
  if (document.readyState === "complete") schedule();
  else browser.addEventListener("load", schedule, { once: true });

  return cleanup;
}
