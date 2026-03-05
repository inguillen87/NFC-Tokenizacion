import { Card, SectionHeading } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";

export default async function DocsPage() {
  const { locale } = await getWebI18n();
  const content = landingContent[locale];

  return (
    <main className="container-shell py-16 space-y-8">
      <SectionHeading eyebrow={content.api.eyebrow} title={content.api.title} description={content.api.description} />
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{content.nav.docs}</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {content.docsList.map((entry) => <li key={entry}>• {entry}</li>)}
        </ul>
      </Card>
    </main>
  );
}
