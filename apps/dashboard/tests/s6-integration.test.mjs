import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=p=>readFile(new URL(p,import.meta.url),'utf8');
test('integrated batch workbench preserves both pilot report and recall destinations',async()=>{
 const view=await source('../src/components/batch-workbench.tsx');
 const page=await source('../src/app/(app)/batches/page.tsx');
 assert.match(view,/canReport&&/);assert.match(view,/canRecalls&&/);
 assert.match(view,/Informe del piloto/);assert.match(view,/Retiro \/ cuarentena/);
 assert.match(page,/canReport=\{canReadPilotReport\(session\)\}/);
 assert.match(page,/canRecalls=\{canReadRecallWorkspace\(session\)\}/);
 assert.match(view,/Enlaces QR \/ estado NFC/);
});
test('recall motion can be disabled and does not simulate live events',async()=>{
 const css=await source('../src/components/recall-workspace.module.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.dialog\[open\]\{animation:none\}/);
 assert.doesNotMatch(css,/animation:.*infinite/);
});
