import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

export default async function DocsPage() {
  const { t } = await getWebI18n();

  return (
    <main className="container-shell py-16">
      <SectionHeading
        eyebrow={t.web.sections.docsEyebrow}
        title={t.web.sections.docsTitle}
        description={t.web.sections.docsDescription}
      />

      <Card className="mt-8 p-6">
        <ul className="space-y-2 text-sm text-slate-300">
          {t.web.docsList.map((entry) => (
            <li key={entry}>• {entry}</li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
