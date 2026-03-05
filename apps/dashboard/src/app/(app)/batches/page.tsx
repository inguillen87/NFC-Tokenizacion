import { SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../components/admin-action-forms";

export default function BatchesPage() {
  return <main><SectionHeading eyebrow="Batches" title="Batch lifecycle" description="Create, import CSV manifest, activate tags and revoke compromised lots." /><div className="mt-8"><AdminActionForms title="Batch operations" /></div></main>;
}
