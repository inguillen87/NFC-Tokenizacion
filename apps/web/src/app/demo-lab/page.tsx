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

export default async function DemoLabPage() {
  const { locale } = await getWebI18n();
  return <DemoLabClient locale={locale} />;
}
