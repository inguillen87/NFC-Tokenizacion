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
