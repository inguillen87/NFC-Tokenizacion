import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const json=async(path)=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const candidate=()=>json('../../../docs/releases/2026-09-21-dashboard.28.candidate.json');
test('S6 marker and candidate declare one dashboard-only release with compatible source versions',async()=>{
 const [m,c]=await Promise.all([json('../public/release.json'),candidate()]);
 assert.equal(m.release,c.release);assert.equal(c.release,'2026.09.21-dashboard.28');
 assert.equal(m.requiredApiRelease,c.compatibleSources.api.release);
 assert.equal(m.requiredWebRelease,c.compatibleSources.web.release);
 assert.equal(m.apiChangesIncluded,false);assert.equal(m.databaseMigrationsIncluded,false);
 assert.equal(c.application,'dashboard');
});
test('passing CI and static images cannot be mislabeled as production promotion',async()=>{
 const c=await candidate();assert.equal(c.status,'candidate-not-deployed');
 assert.equal(c.deploymentId,null);assert.equal(c.currentProductionVerified,false);
 assert.ok(c.remainingGates.includes('explicit-promotion'));
 assert.ok(c.remainingGates.includes('canonical-domain-postchecks'));
 assert.equal(c.runtimeAcceptance.syntheticData,true);
 assert.equal(c.included.physicalTapCertification,false);
});
test('review evidence is tied to the verified S6 source and four exact captures',async()=>{
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
test('public notes present the right release and preserve recall evidence boundaries',async()=>{
 const s=await readFile(new URL('../src/lib/dashboard-release.ts',import.meta.url),'utf8');
 assert.match(s,/DASHBOARD_RELEASE='2026.09.21-dashboard.28'/);
 assert.match(s,/no levanta el aviso/);
 assert.match(s,/otra cuenta autorizada/);
 assert.doesNotMatch(s,/team_BV|VERCEL_TOKEN|DATABASE_URL|dpl_/);
});
