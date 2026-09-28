import { OnboardingSetupWizard } from '../../../components/onboarding-setup-wizard';
import { PilotLaunchpad } from '../../../components/pilot-launchpad';
import { requireDashboardSession } from '../../../lib/session';
import { createAdminPageContext, fetchAdminPage } from '../../../lib/admin-page-access';
import { resolvePilotScope, buildPilotLaunchpad, type PilotSource } from '../../../lib/pilot-launchpad-model';
import { readPilotSource } from '../../../lib/pilot-launchpad-read';

export default async function OnboardingPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
 const session = await requireDashboardSession();
 const query = searchParams ? await searchParams : {};
 const scope = resolvePilotScope(session, query.tenant);
 let source: PilotSource | undefined;
 if (scope.state === 'selected') {
  const context = await createAdminPageContext(session, scope.tenant);
  source = await readPilotSource(signal => fetchAdminPage(context, 'batches', { method: 'GET', redirect: 'error', signal }), scope.tenant);
 }
 const model = buildPilotLaunchpad(session, scope, source);
 return <main className="space-y-6" data-testid="pilot-onboarding-page">
  {session.role === 'tenant-admin' && scope.state === 'selected' && session.setupCompleted === false ? <OnboardingSetupWizard session={session} /> : null}
  <PilotLaunchpad key={`${session.id}:${scope.tenant}`} model={model} />
 </main>;
}
