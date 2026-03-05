import { SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../components/admin-action-forms";

export default function BatchesPage() {
  return (
    <main>
      <SectionHeading eyebrow="Batch ops" title="Create, import, activate and revoke" description="Run the full lifecycle for basic and secure NFC batches." />
      <div className="mt-8">
        <AdminActionForms />
      </div>
    </main>
  );
}
