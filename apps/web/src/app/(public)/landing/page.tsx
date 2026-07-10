import { redirect } from "next/navigation";

type LegacyLandingPageProps = {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function buildCanonicalLandingHref(params: Record<string, string | string[] | undefined> | undefined) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((entry) => {
      if (entry) query.append(key, entry);
    });
  });

  const suffix = query.toString();
  return suffix ? `/?${suffix}` : "/";
}

export default async function LegacyLandingPage({ searchParams }: LegacyLandingPageProps) {
  const params = await searchParams;
  redirect(buildCanonicalLandingHref(params));
}
