import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

export default async function ResellersPage() {
  const { t } = await getWebI18n();

  return (
    <main className="container-shell py-16">
      <SectionHeading
        eyebrow={t.web.sections.resellerEyebrow}
        title={t.web.sections.resellerTitle}
        description={t.web.sections.resellerDescription}
      />

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {t.web.resellerCards.map((item) => (
          <Card key={item.title} className="p-6">
            <h3 className="text-white">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{item.body}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
