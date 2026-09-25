// Synthetic fixture projected by the deployed API source at c21a0a77. No live database was queried.
const BASE={
  "ok": true,
  "protocol": "nexid.runtime-readiness.v1",
  "observedAt": "2026-09-24T12:00:00.000Z",
  "scope": "nexid_global_admin",
  "runtime": {
    "environment": "production",
    "deploymentId": "dpl_Synthetic0000001",
    "commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "database": {
    "name": "qa_runtime_console",
    "sessionRole": "qa_effective_role",
    "loginRole": "qa_login_role",
    "endpointId": "ep-synthetic-only",
    "serverVersionNumber": 170010,
    "transactionReadOnly": false
  },
  "role": {
    "superuser": false,
    "bypassRls": false,
    "createRole": false,
    "createDatabase": false,
    "createInPublicSchema": false,
    "ownsDatabase": false,
    "ownsPublicObjects": false
  },
  "privilegedConnection": false,
  "ledger": {
    "count": 58,
    "requiredRuntimeMissing": [],
    "featureMigrations": [
      {
        "id": "20260922100000_0112_support_ticket_workflow.sql",
        "recorded": true
      },
      {
        "id": "20260923120000_0113_supplier_requests.sql",
        "recorded": true
      },
      {
        "id": "20260923150000_0114_supplier_request_reviews.sql",
        "recorded": true
      },
      {
        "id": "20260923180000_0115_supplier_operator_role_enum.sql",
        "recorded": true
      },
      {
        "id": "20260923180100_0116_supplier_request_assignments.sql",
        "recorded": true
      },
      {
        "id": "20260924010000_0117_supplier_request_cancellation.sql",
        "recorded": true
      },
      {
        "id": "20260924050000_0118_supplier_request_quotes.sql",
        "recorded": true
      },
      {
        "id": "20260924110000_0119_supplier_request_binding.sql",
        "recorded": true
      },
      {
        "id": "20260924150000_0120_supplier_delivery_ack.sql",
        "recorded": true
      },
      {
        "id": "20260924163000_0121_support_ticket_status_type_compatibility.sql",
        "recorded": true
      }
    ],
    "fullRepositoryReconciliation": "not_performed"
  },
  "catalogs": {
    "missingCarriers": [],
    "missingLedgerProviders": [],
    "valuesOrPricesReturned": false
  },
  "requirements": [
    {
      "id": "support",
      "status": "named_prerequisites_present",
      "missingMigrations": [],
      "missingFunctions": [],
      "unavailableExecute": []
    },
    {
      "id": "requests",
      "status": "named_prerequisites_present",
      "missingMigrations": [],
      "missingFunctions": [],
      "unavailableExecute": []
    },
    {
      "id": "assignments",
      "status": "named_prerequisites_present",
      "missingMigrations": [],
      "missingFunctions": [],
      "unavailableExecute": []
    },
    {
      "id": "cancellation",
      "status": "named_prerequisites_present",
      "missingMigrations": [],
      "missingFunctions": [],
      "unavailableExecute": []
    },
    {
      "id": "quotations",
      "status": "named_prerequisites_present",
      "missingMigrations": [],
      "missingFunctions": [],
      "unavailableExecute": []
    },
    {
      "id": "supplier_binding",
      "status": "named_prerequisites_present",
      "missingMigrations": [],
      "missingFunctions": [],
      "unavailableExecute": []
    },
    {
      "id": "documentary_ack",
      "status": "named_prerequisites_present",
      "missingMigrations": [],
      "missingFunctions": [],
      "unavailableExecute": []
    },
    {
      "id": "ticket_type_compatibility",
      "status": "named_prerequisites_present",
      "missingMigrations": [],
      "missingFunctions": [],
      "unavailableExecute": []
    }
  ],
  "featureFlags": {
    "cancellation": {
      "configured": false,
      "enabled": false
    },
    "quotations": {
      "configured": false,
      "enabled": false
    },
    "supplier_binding": {
      "configured": false,
      "enabled": false
    },
    "documentary_ack": {
      "configured": false,
      "enabled": false
    }
  },
  "enabledWithoutPrerequisites": [],
  "readiness": "further_acceptance_required",
  "promotionAllowed": false,
  "migrationExecutionAllowed": false,
  "customerRowsRead": false,
  "unverified": [
    "control_plane_branch_mapping",
    "deployed_dashboard_compatibility",
    "function_bodies_constraints_and_effective_table_acl",
    "migration_checksums_and_historical_bootstrap",
    "physical_or_supplier_acceptance"
  ]
};

export function runtimeFixture(now=Date.now(),{blocked=[],denied=[],enabled=[],broad=false,extra={}}={}) {
 const out=structuredClone(BASE);out.observedAt=new Date(now).toISOString();
 const missing=new Set(out.requirements.filter(f=>blocked.includes(f.id)).flatMap(f=>f.missingMigrations));
 const map={support:['0112'],requests:['0113','0114'],assignments:['0115','0116'],cancellation:['0117'],quotations:['0117','0118'],supplier_binding:['0118','0119'],documentary_ack:['0119','0120'],ticket_type_compatibility:['0121']};
 for(const m of out.ledger.featureMigrations)if(blocked.some(id=>map[id]?.some(n=>m.id.includes('_'+n+'_'))))m.recorded=false;
 for(const f of out.requirements){f.missingMigrations=out.ledger.featureMigrations.filter(m=>!m.recorded&&map[f.id].some(n=>m.id.includes('_'+n+'_'))).map(m=>m.id);if(denied.includes(f.id))f.unavailableExecute=FUNCTIONS[f.id];f.status=f.missingMigrations.length?'schema_or_ledger_missing':f.unavailableExecute.length?'execute_privilege_missing':'named_prerequisites_present';}
 for(const [id,flag]of Object.entries(out.featureFlags)){flag.configured=enabled.includes(id);flag.enabled=enabled.includes(id);}
 out.enabledWithoutPrerequisites=out.requirements.filter(f=>out.featureFlags[f.id]?.enabled&&f.status!=='named_prerequisites_present').map(f=>f.id);
 out.readiness=out.requirements.some(f=>f.status!=='named_prerequisites_present')?'blocked_on_named_prerequisites':'further_acceptance_required';
 if(broad){out.role.ownsDatabase=true;out.privilegedConnection=true;}
 return Object.assign(out,extra);
}

const FUNCTIONS={"support":["public.nexid_read_support_ticket_workflow_v1(uuid,uuid,text,bigint)"],"requests":["public.nexid_mutate_supplier_request_v1(jsonb)","public.nexid_mutate_supplier_request_review_v1(jsonb)"],"assignments":["public.nexid_supplier_requests_assigned_v1(uuid,uuid,integer)","public.nexid_mutate_supplier_request_assignment_v1(jsonb)"],"cancellation":["public.nexid_cancel_supplier_request_v1(jsonb)"],"quotations":["public.nexid_mutate_supplier_quote_v1(jsonb)","public.nexid_supplier_quote_read_v1(uuid,uuid,uuid,uuid,integer)"],"supplier_binding":["public.nexid_mutate_supplier_binding_v1(jsonb)","public.nexid_supplier_binding_read_v1(uuid,uuid,uuid,uuid,integer)"],"documentary_ack":["public.nexid_mutate_supplier_delivery_ack_v1(jsonb)","public.nexid_supplier_delivery_ack_read_v1(uuid,uuid,uuid,uuid,integer)"],"ticket_type_compatibility":["public.nexid_transition_support_ticket_v1(uuid,uuid,text,uuid,text,text,text,text,uuid)"]};
