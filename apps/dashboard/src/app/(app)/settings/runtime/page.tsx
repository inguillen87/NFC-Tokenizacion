import { notFound } from 'next/navigation';
import { requireDashboardSession } from '../../../../lib/session';
import { canReadRuntimeConsole } from '../../../../lib/runtime-readiness-access';
import { RuntimeAccessNotice } from '../../../../components/runtime-access-notice';
import { RuntimeReadinessPanel } from '../../../../components/runtime-readiness-panel';
export const dynamic='force-dynamic';
export default async function RuntimeReadinessPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const session=await requireDashboardSession();
  if(Object.keys(await searchParams).length)notFound();
  if(!canReadRuntimeConsole(session))return <RuntimeAccessNotice reason={session.tenantId || session.tenantSlug ? 'tenant' : 'restricted'}/>;
  return <RuntimeReadinessPanel access={{id:session.id,role:session.role,tenantId:session.tenantId,tenantSlug:session.tenantSlug,isDemo:session.isDemo,deniedPermissions:session.deniedPermissions}}/>;
}
