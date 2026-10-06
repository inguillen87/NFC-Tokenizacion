import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {DASHBOARD_RELEASE,releaseCopy} from '../src/lib/dashboard-release.ts';
const json=async(path)=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const candidate=()=>json('../../../docs/releases/2026-09-21-dashboard.28.candidate.json');
test('marketplace release retains immutable S6 evidence and identifies its paired API',async()=>{
 const [m,c]=await Promise.all([json('../public/release.json'),candidate()]);
 assert.equal(c.release,'2026.09.21-dashboard.28');
 assert.equal(createHash('sha256').update(JSON.stringify(c)).digest('hex'),'9be2d2d515dfcd3e43780c713dc51b2fb4f56a8e3a7f33df0f17d41532e11259');
 assert.equal(m.release,'2026.10.06-dashboard-tenant-marketplace.1');
 assert.equal(m.reconciliationBaseRelease,c.release);
 assert.equal(m.baseCommit,'2958f8cac3f06ff23dd43782d49f9e15310e0806');
 assert.equal(m.scope,'tenant-durable-catalog-editor-and-explicit-network-publication');
 assert.equal(m.realTapCertification,'not-included');
 assert.equal(m.requiredApiRelease,'2026.10.06-api-tenant-marketplace.1');
 assert.equal(m.tenantMarketplaceProtocol,'nexid.tenant-marketplace-catalog.v1');
 assert.equal(m.tenantActionConfigurationProtocol,'nexid.tenant-actions.v1');
 assert.equal(m.supplierRequestAssignmentProtocol,'nexid.supplier-request-assignment.v1');
 assert.equal(m.supplierRequestReviewProtocol,'nexid.supplier-request-review.v1');
 assert.equal(m.requiredWebRelease,'2026.09.21-web-support.1');
 assert.equal(m.apiChangesIncluded,false);assert.equal(m.databaseMigrationsIncluded,false);
 assert.equal(c.application,'dashboard');
});
test('marketplace public marker preserves every unrelated production-baseline contract',async()=>{
 const text=await readFile(new URL('./fixtures/tenant-sync-public-release-baseline.json',import.meta.url),'utf8');
 assert.equal(createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex'),'cd7f96a7c92cce2f1ec4ba527c880a8671704fab108bb58024e99af93e676f73');
 const baseline=JSON.parse(text),marker=await json('../public/release.json');
 assert.equal(baseline.release,'2026.09.23-dashboard.42');
 const changed=['release','scope','baseCommit','requiredApiRelease','tenantActionConfigurationProtocol','tenantMarketplaceProtocol'];
 const unchanged=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!changed.includes(key)));
 assert.deepEqual(unchanged(marker),unchanged(baseline));
 for(const field of ['apiChangesIncluded','databaseMigrationsIncluded','campaignDeliveryIncluded'])assert.throws(()=>assert.deepEqual(unchanged({...marker,[field]:true}),unchanged(baseline)));
});
test('historical S6 review records no production promotion at capture time',async()=>{
 const c=await candidate();assert.equal(c.status,'candidate-not-deployed');
 assert.equal(c.deploymentId,null);assert.equal(c.currentProductionVerified,false);
 assert.ok(c.remainingGates.includes('explicit-promotion'));
 assert.ok(c.remainingGates.includes('canonical-domain-postchecks'));
 assert.equal(c.runtimeAcceptance.syntheticData,true);
 assert.equal(c.included.physicalTapCertification,false);
});
test('historical review evidence remains tied to the verified S6 source and four exact captures',async()=>{
 const c=await candidate();assert.equal(c.runtimeCandidate,'c60b233924db262a73e0ef0704501662642ff602');
 assert.equal(c.runtimeAcceptance.runId,35557122467);
 assert.equal(c.runtimeAcceptance.archiveSha256,'a1ca77beb6cb3be895da996c414c8021fbc6bd24ac7de2696d0fbb301448e372');
 assert.equal(c.visualReview.captures.length,4);
 assert.equal(new Set(c.visualReview.captures.map(x=>x.path)).size,4);
 for(const image of c.visualReview.captures)assert.match(image.sha256,/^[a-f0-9]{64}$/);
});
test('candidate does not request infrastructure spending or unrelated runtime changes',async()=>{
 const c=await candidate();
 for(const value of Object.values(c.included))assert.equal(value,false);
 assert.equal(c.compatibleSources.api.sha,'a3e51ffdc324631640734b4b246f23c1ac1f5842');
 assert.equal(c.compatibleSources.web.sha,'b6c054bcc59c4eb10ff01f1ff38aa2ad05c4df19');
 assert.ok(c.remainingGates.includes('reconfirm-production-api-web-dashboard-combination'));
});
test('current public notes match the marker and retain origin, cryptographic and recall boundaries in every locale',async()=>{
 const [m,s]=await Promise.all([json('../public/release.json'),readFile(new URL('../src/lib/dashboard-release.ts',import.meta.url),'utf8')]);
 assert.equal(DASHBOARD_RELEASE,m.release);
 const requirements={
  'es-AR':{origin:/origen real/,excluded:/importaciones/,results:/inválidos o repetidos/,crypto:/no certifica el soporte físico, el estado TT ni la autenticidad criptográfica/,recall:/no levanta el aviso/,review:/otra cuenta autorizada/},
  en:{origin:/real-origin|origin is explicitly real/,excluded:/imports/i,results:/invalid or replayed/,crypto:/does not certify the physical carrier, TT state or cryptographic authenticity/,recall:/does not lift the product notice/,review:/another authorized account/},
  'pt-BR':{origin:/origem real|origem é explicitamente real/,excluded:/importações/i,results:/inválidos ou repetidos/,crypto:/não certifica o suporte físico, o estado TT nem a autenticidade criptográfica/,recall:/não retira o aviso/,review:/outra conta autorizada/},
 };
 for(const [locale,patterns] of Object.entries(requirements)){
  const copy=releaseCopy(locale),text=JSON.stringify(copy);
  assert.equal(copy.cards.length,10);assert.equal(copy.steps.length,4);
  for(const pattern of Object.values(patterns))assert.match(text,pattern,locale);
  assert.match(text,/\.28/,locale);
 }
 assert.doesNotMatch(s,/team_BV|VERCEL_TOKEN|DATABASE_URL|dpl_/);
});
