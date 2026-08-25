export const NEXID_NAVIGATION_V4_CATEGORY_IDS = [
  "product",
  "solutions",
  "demo",
  "resources",
  "developers",
] as const;

export type NexidNavigationV4CategoryId =
  (typeof NEXID_NAVIGATION_V4_CATEGORY_IDS)[number];

export type NexidNavigationV4Theme = "dark" | "light";

export type NexidNavigationV4Link = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
};

export type NexidNavigationV4Category = {
  label: string;
  href: string;
  summary: string;
  overviewLabel: string;
  links: readonly NexidNavigationV4Link[];
};

export type NexidNavigationV4Content = {
  aria: {
    home: string;
    primaryNavigation: string;
    openMenu: string;
    closeMenu: string;
    mobileDialog: string;
    mobileNavigation: string;
    actions: string;
    preferences: string;
    opensNewWindow: string;
  };
  mobileEyebrow: string;
  categories: Record<NexidNavigationV4CategoryId, NexidNavigationV4Category>;
  actions: {
    demo: NexidNavigationV4Link;
    sales: NexidNavigationV4Link;
    loginLabel: string;
  };
};

/**
 * This component may be rendered by a Server Component. Keep every prop
 * JSON-serializable so the App Router boundary remains safe.
 */
export type NexidNavigationV4Props = {
  locale: string;
  loginHref: string;
  initialTheme?: NexidNavigationV4Theme;
  locales?: readonly string[];
  className?: string;
};
