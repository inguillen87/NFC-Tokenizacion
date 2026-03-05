import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

export default async function DocsPage() {
  const { t } = await getWebI18n();
  return (
    <main className="container-shell py-16">
      <SectionHeading eyebrow={t.web.sections.docs} title="Implementation quickstart" description="Deployed API contracts and onboarding flow for secure NFC operations." />
      <Card className="mt-8 p-6"><ul className="space-y-2 text-sm text-slate-300"><li>• /health/</li><li>• /sun/</li><li>• /admin/tenants/</li><li>• /admin/batches/:bid/import-manifest/</li><li>• /admin/tags/activate/</li></ul></Card>
    </main>
  );
}
