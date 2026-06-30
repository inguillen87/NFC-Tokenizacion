import type { Metadata } from "next";
import { getWebI18n } from "../../lib/locale";
import { DemoLabClient } from "./demo-lab-client";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return {
    title: "Demo Lab · nexID",
    openGraph: {
      title: "Demo Lab · nexID",
      images: [{ url: `/opengraph-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Demo Lab · nexID",
      images: [`/twitter-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`],
    },
  };
}

type DemoLabPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DemoLabPage({ searchParams }: DemoLabPageProps) {
  const { locale } = await getWebI18n();
  const params = searchParams ? await searchParams : {};
  const initialVertical = firstParam(params.vertical || params.rubro || params.industry || params.useCase);
  const initialScenario = firstParam(params.scenario || params.proof || params.layer);
  return <DemoLabClient locale={locale} initialVertical={initialVertical} initialScenario={initialScenario} />;
}
