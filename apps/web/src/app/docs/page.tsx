import { Card, SectionHeading } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";

export default async function DocsPage() {
  const { locale } = await getWebI18n();
  const content = landingContent[locale];

  return (
    <main className="container-shell py-16">
      <SectionHeading eyebrow={content.api.eyebrow} title={content.api.title} description={content.api.description} />
      <Card className="mt-8 p-6">
        <ul className="space-y-2 text-sm text-slate-300">
          {content.docsList.map((entry) => <li key={entry}>• {entry}</li>)}
        </ul>
      </Card>
    </main>
  );
}
