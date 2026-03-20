import { productUrls } from "@product/config";

const DASHBOARD_BASE = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || productUrls.app;

type SearchParamsLike = Record<string, string | string[] | undefined>;

export function buildDashboardDemoUrl(pathname: string, searchParams?: SearchParamsLike) {
  const url = new URL(pathname, DASHBOARD_BASE);

  if (!searchParams) return url.toString();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "undefined") return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
      return;
    }
    url.searchParams.set(key, value);
  });

  return url.toString();
}
