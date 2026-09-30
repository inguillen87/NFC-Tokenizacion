import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_SOURCE, passportPersistenceConfig } from './passport-persistence-safety.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const report = { protocol: 'nexid.passport-persistence-acceptance.v1', ok: false,
  apiSource: API_SOURCE, productionUsed: false, realPostgres: true, realEditorialService: true,
  currentDashboardContracts: true, authenticationSimulated: true, nextBffCovered: false,
  browserCovered: false, fullRepositorySchemaCovered: false, checks: [], migrations: [] };
let pool, undo, activeCheck = 'validate_local_target';
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], {encoding:'utf8'}).trim();
const check = (name, value) => { activeCheck=name; assert.ok(value, name); report.checks.push(name); };
try {
  const config = passportPersistenceConfig();
  const apiRoot = resolve(config.apiRoot);
  check('paired_api_checkout_matches_published_source', git(apiRoot,'rev-parse','HEAD') === API_SOURCE);
  check('paired_api_source_is_unmodified', git(apiRoot,'status','--porcelain') === '');
  report.dashboardSource = git(root,'rev-parse','HEAD');
  report.postgresVersion = config.expectedPostgresVersion;
  const loadApi = path => import(pathToFileURL(join(apiRoot, 'apps/api', path)).href);
  const { assertEmptyEnterpriseE2eDatabase } = await loadApi('scripts/lib/enterprise-ephemeral-e2e-safety.mjs');
  const { default: pg } = await import('pg');
  pool = new pg.Pool({connectionString:config.databaseUrl,max:4,connectionTimeoutMillis:8000,
    statement_timeout:10000,query_timeout:12000,application_name:'nexid-isolated-passport-acceptance'});
  const client = await pool.connect();
  try { await assertEmptyEnterpriseE2eDatabase(client, config); } finally { client.release(); }
  check('dedicated_database_is_empty_and_exact_engine', true);
  activeCheck='install_unmodified_editorial_migrations';
  await pool.query('CREATE TABLE tenants(id uuid PRIMARY KEY,slug text NOT NULL,name text NOT NULL); CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),bid text NOT NULL,sdm_config jsonb NOT NULL)');
  for (const filename of ['20260918120000_0104_passport_editorial.sql','20260918123000_0105_passport_editorial_guards.sql']) {
    const source = (await readFile(join(apiRoot,'apps/api/db/migrations',filename),'utf8')).replaceAll('\r\n','\n');
    await pool.query(source);
    report.migrations.push({filename,sha256:createHash('sha256').update(source).digest('hex')});
  }
  activeCheck='load_real_service_and_dashboard_contracts';
  const { installEphemeralE2eSqlExecutor } = await loadApi('src/lib/db.ts');
  const { readStudio, studioReadView, mutateStudio, studioFailure } = await loadApi('src/lib/passport-editorial-service.ts');
  const { parseStudioEntry } = await import('../../apps/dashboard/src/lib/passport-studio-entry.ts');
  const { prepareEnrollment, confirmEnrollment } = await import('../../apps/dashboard/src/lib/passport-enrollment.ts');
  const { validateStudioReply } = await import('../../apps/dashboard/src/lib/passport-studio-transport.ts');
  const { updateField } = await import('../../apps/dashboard/src/lib/passport-studio-contract.ts');
  undo = installEphemeralE2eSqlExecutor(async (parts,...values) => {
    let text='';for(let i=0;i<parts.length;i++){text+=parts[i];if(i<values.length)text+='$'+(i+1);}
    return (await pool.query(text,values)).rows;
  }, process.env);
  const actors = {
    editor:{actorId:'qa_editor',label:'Editor sintético',canEdit:true,canReview:false,canPublish:false},
    reviewer:{actorId:'qa_reviewer',label:'Revisor sintético',canEdit:false,canReview:true,canPublish:false},
    publisher:{actorId:'qa_publisher',label:'Publicador sintético',canEdit:true,canReview:false,canPublish:true},
    viewer:{actorId:'qa_viewer',label:'Consulta sintética',canEdit:false,canReview:false,canPublish:false},
  };
  const fingerprint = async () => (await pool.query(`SELECT md5(jsonb_build_object(
    'batches',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM batches t),
    'heads',(SELECT jsonb_agg(to_jsonb(t) ORDER BY batch_id) FROM passport_editorial_heads t),
    'history',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM passport_editorial_history t),
    'receipts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM passport_editorial_receipts t))::text) digest`)).rows[0].digest;
  const deny = async (name, operation, reason) => {
    activeCheck=name;const before=await fingerprint();let rejected=false;
    try { await operation(); } catch(error) { const failure=studioFailure(error);rejected=reason.test(failure.reason);if(!rejected)report.unexpectedDenial=failure.reason; }
    check(name,rejected);check(name+'_has_no_persisted_side_effects',await fingerprint()===before);
  };
  const counts = async () => (await pool.query('SELECT (SELECT count(*)::int FROM passport_editorial_history) history,(SELECT count(*)::int FROM passport_editorial_receipts) receipts')).rows[0];
  for(const template of ['general','agro']) {
    const tenant=randomUUID(), foreignTenant=randomUUID(), batch=randomUUID(), foreignBatch=randomUUID();
    const slug='qa-'+template, other='qa-other-'+template, bid='QA-'+template.toUpperCase();
    const seed={product_name:'Producto inicial '+template,sku:'QA-001',winery:'Fabricante sintético',public_lot_label:'L-QA',region:'Origen declarado',
      qa_internal:'QA_PRIVATE_SENTINEL',sun:{security:{sentinel:'QA_PRIVATE_SENTINEL'},counter:77,product:{name:'Producto inicial '+template}},wine:{advanced_preserved:true}};
    if(template==='agro')seed.agro_product_profile={schemaVersion:'agro-dpp-v1',crop:'Maíz',productName:seed.product_name,brand:seed.winery,sku:seed.sku,batchLot:'L-QA'};
    await pool.query('INSERT INTO tenants VALUES($1,$2,$3),($4,$5,$6)',[tenant,slug,'Empresa QA',foreignTenant,other,'Otra empresa QA']);
    await pool.query('INSERT INTO batches(id,tenant_id,bid,sdm_config) VALUES($1,$2,$3,$4),($5,$6,$3,$4)',[batch,tenant,bid,seed,foreignBatch,foreignTenant]);
    const cfg = async id => (await pool.query('SELECT sdm_config FROM batches WHERE id=$1',[id||batch])).rows[0].sdm_config;
    const initialConfig=await cfg(), foreignConfig=await cfg(foreignBatch);
    const view = async actor => {
      const raw=studioReadView(await readStudio(slug,bid),actor);
      check(template+'_projection_never_exposes_technical_fields',!JSON.stringify(raw).includes('QA_PRIVATE_SENTINEL'));
      return parseStudioEntry(raw,{bid,tenantId:tenant});
    };
    const initial=await view(actors.editor);
    check(template+'_read_has_enrollment_but_no_draft',!!initial.enrollment&&!initial.snapshot);
    await deny(template+'_ambiguous_global_bid_refused',()=>readStudio('',bid),/editorial_duplicate_bid/);
    const attempt=prepareEnrollment(initial.enrollment,`/api/admin/batches/${bid}/passport-editorial`,slug,template,'es-AR',randomUUID());
    await deny(template+'_viewer_cannot_start',()=>mutateStudio(slug,bid,actors.viewer,attempt.body,'start'),/forbidden/);
    await deny(template+'_other_tenant_command_refused',()=>mutateStudio(other,bid,actors.editor,attempt.body,'start'),/scope_forbidden/);
    activeCheck=template+'_start';
    const started=await mutateStudio(slug,bid,actors.editor,attempt.body,'start');
    confirmEnrollment(started,attempt);check(template+'_start_receipt_matches_dashboard_contract',true);
    check(template+'_start_does_not_change_public_content',JSON.stringify(await cfg())===JSON.stringify(initialConfig));
    const beforeReplay=await counts();const replay=await mutateStudio(slug,bid,actors.editor,attempt.body,'start');
    confirmEnrollment(replay,attempt);check(template+'_start_retry_is_durable',replay.receipt.replayed&&replay.receipt.id===started.receipt.id);
    check(template+'_retry_does_not_duplicate_history',JSON.stringify(await counts())===JSON.stringify(beforeReplay));
    await deny(template+'_changed_payload_cannot_reuse_receipt',()=>mutateStudio(slug,bid,actors.editor,{...attempt.body,locale:'en'},'start'),/idempotency_conflict/);
    const command = (action,snapshot,extra={}) => ({action,operationId:randomUUID(),draftId:snapshot.draft.id,expectedRevision:snapshot.draft.revision,expectedContentDigest:snapshot.draft.contentDigest,scope:{tenantId:tenant,batchId:batch},...extra});
    const act = async (action,actor,extra={}) => {
      const snapshot=(await view(actor)).snapshot,cmd=command(action,snapshot,extra);
      activeCheck=template+'_'+action;
      const reply=await mutateStudio(slug,bid,actor,cmd,action);
      validateStudioReply(reply,cmd,actor.actorId);check(template+'_'+action+'_receipt_matches_dashboard',true);
      return {reply,cmd};
    };
    const editorSnapshot=(await view(actors.editor)).snapshot;
    const edited=updateField(editorSnapshot.draft.document,'identity.product_name','Versión revisada '+template);
    await act('save',actors.editor,{document:edited});
    await deny(template+'_stale_save_refused',()=>mutateStudio(slug,bid,actors.editor,command('save',editorSnapshot,{document:edited}),'save'),/revision_conflict/);
    check(template+'_save_keeps_public_content',JSON.stringify(await cfg())===JSON.stringify(initialConfig));
    await act('submit',actors.editor);
    const submitted=(await view(actors.editor)).snapshot;
    await deny(template+'_author_cannot_self_approve',()=>mutateStudio(slug,bid,{...actors.editor,canReview:true},command('approve',submitted),'approve'),/independent_review/);
    await deny(template+'_empty_review_note_refused',()=>mutateStudio(slug,bid,actors.reviewer,command('request_changes',submitted,{note:' '}),'request_changes'),/note_required/);
    const changes=await act('request_changes',actors.reviewer,{note:'Corregir nombre según ficha de producto.'});
    check(template+'_review_note_survives_database',changes.reply.snapshot.history.some(h=>h.note==='Corregir nombre según ficha de producto.'));
    const requested=(await view(actors.editor)).snapshot;
    await act('save',actors.editor,{document:updateField(requested.draft.document,'identity.product_name','Producto publicado '+template)});
    await act('submit',actors.editor);await act('approve',actors.reviewer);
    const approved=(await view(actors.reviewer)).snapshot;
    await deny(template+'_reviewer_cannot_publish',()=>mutateStudio(slug,bid,actors.reviewer,command('publish',approved),'publish'),/forbidden/);
    check(template+'_approval_alone_does_not_publish',JSON.stringify(await cfg())===JSON.stringify(initialConfig));
    const published=await act('publish',actors.publisher);
    check(template+'_publication_updates_only_after_confirmed_commit',(await cfg()).product_name==='Producto publicado '+template&&published.reply.snapshot.published.version===1);
    const current=await cfg();check(template+'_technical_and_wine_fields_preserved',current.qa_internal===seed.qa_internal&&JSON.stringify(current.sun.security)===JSON.stringify(seed.sun.security)&&current.sun.counter===77&&JSON.stringify(current.wine)===JSON.stringify(seed.wine));
    const reopened=await act('reopen',actors.publisher);
    check(template+'_reopen_keeps_publication',reopened.reply.snapshot.draft.state==='draft'&&(await cfg()).product_name==='Producto publicado '+template);
    await deny(template+'_old_approval_cannot_publish_reopened_draft',()=>mutateStudio(slug,bid,actors.publisher,command('publish',reopened.reply.snapshot),'publish'),/approval|transition/);
    const originalReceiptCounts=await counts();
    const publicationReplay=await mutateStudio(slug,bid,actors.publisher,published.cmd,'publish');
    validateStudioReply(publicationReplay,published.cmd,actors.publisher.actorId);
    check(template+'_old_publication_receipt_remains_recoverable',publicationReplay.receipt.replayed&&publicationReplay.receipt.id===published.reply.receipt.id);
    check(template+'_historical_receipt_does_not_restore_old_head',JSON.stringify(await counts())===JSON.stringify(originalReceiptCounts)&&(await view(actors.publisher)).snapshot.draft.state==='draft');
    const concurrent=(await view(actors.editor)).snapshot;
    const pending=['Uno','Dos'].map(name=>command('save',concurrent,{document:updateField(concurrent.draft.document,'identity.product_name',name)}));
    const results=await Promise.allSettled(pending.map(cmd=>mutateStudio(slug,bid,actors.editor,cmd,'save')));
    check(template+'_competing_saves_commit_exactly_once',results.filter(r=>r.status==='fulfilled').length===1&&results.filter(r=>r.status==='rejected').every(r=>/revision_conflict/.test(studioFailure(r.reason).reason)));
    check(template+'_other_tenant_untouched',JSON.stringify(await cfg(foreignBatch))===JSON.stringify(foreignConfig));
    await deny(template+'_direct_public_edit_blocked',()=>pool.query("UPDATE batches SET sdm_config=jsonb_set(sdm_config,'{product_name}','\"not-approved\"') WHERE id=$1",[batch]),/managed_use_studio/);
  }
  const totals=await counts();check('each_committed_revision_has_one_durable_receipt',totals.history===totals.receipts);
  report.persistedCounts=totals;report.ok=true;
} catch(error) {
  report.failedAt=activeCheck;report.failure=error?.name||'Error';report.errorCode=String(error?.code||'');process.exitCode=1;
} finally {
  undo?.();if(pool)await pool.end();report.connectionsClosed=true;
  console.log(JSON.stringify(report));
  if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,`### Passport persistence acceptance\nStatus: ${report.ok?'passed':'failed'}\n\nAPI: ${report.apiSource}\nDashboard: ${report.dashboardSource||'unverified'}\nPostgreSQL: ${report.postgresVersion||'unverified'}\nChecks passed: ${report.checks.length}\n\nNo production data. Synthetic actor capabilities; this does not test Next/BFF authentication or physical NFC.\n`,{flag:'a'});
}
