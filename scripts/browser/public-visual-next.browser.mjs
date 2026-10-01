// CI lifecycle wrapper: build first; serve isolated Next production with all
// server-side external fetch blocked. An explicit QA_ORIGIN reuses a local server.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
const repo=resolve(fileURLToPath(new URL('../../',import.meta.url))),web=join(repo,'apps/web');
const output=resolve(process.env.QA_OUTPUT||join(repo,'artifacts/public-visual-local'));await mkdir(output,{recursive:true});
let server,serverLog='',test,exitCode=1;
try {
 let origin=process.env.QA_ORIGIN;
 if(!origin){
  const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));origin='http://127.0.0.1:'+port;
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));
  Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
  server=spawn(process.execPath,['--import',pathToFileURL(join(web,'tests/sun-mobile-local-fetch.mjs')).href,join(repo,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:web,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
  let ready=false;
  for(let n=0;n<120;n++){if(server.exitCode!==null)throw Error('isolated_next_server_stopped');try{const r=await fetch(origin+'/release.json',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready)throw Error('isolated_next_server_startup_timeout');
 }
 if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('wrapper_requires_loopback_origin');
 test=spawn(process.execPath,[join(repo,'scripts/browser/public-visual.browser.mjs')],{cwd:repo,env:{...process.env,QA_ORIGIN:origin,QA_OUTPUT:output},windowsHide:true,stdio:'inherit'});
 exitCode=await new Promise((resolve,reject)=>{test.once('error',reject);test.once('exit',code=>resolve(code??1));});
} catch(error){console.error(String(error.message).slice(0,180));}
finally{
 if(test&&test.exitCode===null)test.kill();
 if(server&&server.exitCode===null){server.kill();await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);}
 await writeFile(join(output,'local-server.log'),serverLog);
 await writeFile(join(output,'runner.json'),JSON.stringify({localOnly:true,productionBuildExpected:true,externalServerFetchBlocked:Boolean(server),explicitServerReused:!server,exitCode},null,2));
}
process.exitCode=exitCode;
