export const REPORT_PROBLEM_FRAGMENT = "#report-problem";

export function revealReportProblem(activate = false) {
  const section = document.getElementById(REPORT_PROBLEM_FRAGMENT.slice(1));
  const details = section?.querySelector<HTMLDetailsElement>(":scope > details");
  if (!section || !details) return false;

  details.open = true;
  if (activate && window.location.hash !== REPORT_PROBLEM_FRAGMENT) {
    window.location.hash = REPORT_PROBLEM_FRAGMENT;
  }
  section.scrollIntoView({ block: "start" });
  if (activate) details.querySelector<HTMLElement>(":scope > summary")?.focus({ preventScroll: true });
  return true;
}
