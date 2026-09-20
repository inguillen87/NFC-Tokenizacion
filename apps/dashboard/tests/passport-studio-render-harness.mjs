// Renders the production presenter with an explicitly volatile QA adapter. Not imported by application code.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export async function renderStudioHarness(){
 const ts=process.env.STUDIO_TYPESCRIPT_MODULE?require(process.env.STUDIO_TYPESCRIPT_MODULE):require('typescript');
 async function compile(path){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022},reportDiagnostics:true});
  if(result.diagnostics.length)throw new Error('studio_harness_transpile_failed');
  return result.outputText.replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
 }
 const contract=await compile('../src/lib/passport-studio-contract.ts');
 const comparison=await compile('../src/lib/passport-studio-comparison.ts');
 const reuse=await compile('../src/lib/passport-reuse.ts');
 const transport=await compile('../src/lib/passport-studio-transport.ts');
 const view=await compile('../src/components/passport-studio/passport-studio-view.ts');
 const fixture=(await readFile(new URL('./passport-studio-fixtures.mjs',import.meta.url),'utf8')).replace(/^export /gm,'');
 const adapter=await readFile(new URL('./passport-studio-browser-port.fixture.mjs',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/components/passport-studio/passport-studio.css',import.meta.url),'utf8');
 const contractNames=['STUDIO_CONTRACT','STUDIO_FIELDS','readStudioDocument','parseStudioSnapshot','getField','updateField','documentDiff','documentChanged','reviewIssues','canStudioAction','studioStateLabel'];
 const comparisonNames=['comparisonSources','comparisonSource','compareEditorialDocuments','filterEditorialDifferences','COMPARISON_GROUPS','COMPARISON_KINDS'];
 const transportNames=['StudioRequestError','validateStudioReply','studioHTTPTransport'];
 const js=`const SContract=(()=>{${contract}\nreturn {${contractNames.join(',')}};})();\nconst STransport=(()=>{const {parseStudioSnapshot}=SContract;${transport}\nreturn {${transportNames.join(',')}};})();\nconst SCompare=(()=>{const {${contractNames.join(',')}}=SContract;${comparison}\nreturn {${comparisonNames.join(',')}};})();\nconst SReuse=(()=>{const {${contractNames.join(',')}}=SContract;${reuse}\nreturn {preparePublishedReuse,reuseReference};})();\nconst SView=(()=>{const {preparePublishedReuse,reuseReference}=SReuse;const {${comparisonNames.join(',')}}=SCompare;const {${contractNames.join(',')}}=SContract;const {${transportNames.join(',')}}=STransport;${view}\nreturn {mountPassportStudio};})();\n${fixture}\n${adapter}`;
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Passport Studio · implementación en prueba local</title><style>${css}\nbody{margin:0;padding:24px;background:#edf3f7;font-family:system-ui}.qa-note{display:flex;justify-content:space-between;gap:15px;margin:0 auto 16px;max-width:1380px;font-size:11px;color:#496274;line-height:1.7}.qa-note strong{color:#0a6471}.qa-note button{font:inherit;border:1px solid #b8cdd7;border-radius:8px;background:white;color:#375264;padding:8px 12px;cursor:pointer}#app{max-width:1380px;margin:auto}html[data-theme=dark] body{background:#05101b}html[data-theme=dark] .qa-note{color:#a4b7c5}html[data-theme=dark] .qa-note strong{color:#7fd2de}@media(max-width:600px){body{padding:12px}.qa-note{font-size:10px;display:block}.qa-note button{margin-top:7px}}</style></head><body><div class="qa-note"><div><strong>IMPLEMENTACIÓN EN PRUEBA LOCAL</strong><br>Datos sintéticos · respuestas en memoria · no modifica ni publica contenido en NexID.</div><button id="theme">Cambiar claro / oscuro</button></div><div id="app"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`;
}
