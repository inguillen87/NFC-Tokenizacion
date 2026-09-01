import { ThemeToggle } from "@product/ui";
import { resolveThemePreference, THEME_PREFERENCE_VERSION_COOKIE } from "@product/ui/theme-preference";
import { cookies } from "next/headers";

export async function AuthThemeControl({ locale = "es-AR" }: { locale?: string }) {
  const cookieStore = await cookies();
  const initialTheme = resolveThemePreference(
    cookieStore.get("theme")?.value,
    cookieStore.get(THEME_PREFERENCE_VERSION_COOKIE)?.value,
  );

  return (
    <div className="dashboard-auth-theme-control" data-testid="dashboard-auth-theme-control">
      <span className="dashboard-auth-theme-label">Apariencia</span>
      <ThemeToggle initialTheme={initialTheme} locale={locale} />
    </div>
  );
}
