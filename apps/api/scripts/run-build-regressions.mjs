import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const systemKeys=/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|LANG|LC_ALL|CI)$/i;
/** Build-time fixtures receive no deployment credentials or application flags.
 * Next compilation is a separate parent command and retains its real environment. */
export function regressionEnvironment(source) {
  const safe=Object.fromEntries(Object.entries(source).filter(([key,value])=>systemKeys.test(key)&&typeof value==='string'));
  return {...safe,NODE_ENV:'test',VERCEL_ENV:'test',NEXT_TELEMETRY_DISABLED:'1'};
}
export function regressionCommand(platform) {
  return platform==='win32'
    ? {file:'cmd.exe',args:['/d','/s','/c','npm run build:regressions']}
    : {file:'npm',args:['run','build:regressions']};
}
export async function runBuildRegressions({environment=process.env,platform=process.platform,cwd=process.cwd(),spawnProcess=spawn}={}) {
  const command=regressionCommand(platform);
  return new Promise(resolveExit=>{
    const child=spawnProcess(command.file,command.args,{cwd,env:regressionEnvironment(environment),stdio:'inherit',windowsHide:true});
    child.once('error',()=>resolveExit(1));
    child.once('close',(code,signal)=>resolveExit(signal||code===null?1:code));
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.exitCode=await runBuildRegressions();}
  catch{console.error('API build regression process failed');process.exitCode=1;}
}
