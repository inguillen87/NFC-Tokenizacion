import postcss from 'postcss';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
import {splitPublicStyles} from './public-style-split.mjs';
export async function sourceFiles(folder){const list=[];for(const item of await readdir(folder,{withFileTypes:true})){const path=join(folder,item.name);if(item.isDirectory())list.push(...await sourceFiles(path));else if(/\.(ts|tsx)$/.test(item.name))list.push(path);}return list;}
export async function preparePublicStyles(){
 const web=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(web,'../..');
 const shared=['contextual-helpbot','pwa-install-prompt','pwa-setup','misconfiguration-banner','wallet-extension-guard','structured-data','brand-home-link'];
 const paths=[...await sourceFiles(join(web,'src/app/sun')),...await sourceFiles(join(web,'src/lib')),...await sourceFiles(join(repo,'packages/ui/src')),join(web,'src/app/layout.tsx'),...shared.map(name=>join(web,'src/components',name+'.tsx'))];
 const sunSources=(await Promise.all(paths.map(path=>readFile(path,'utf8')))).join('\n');
 const input=await readFile(join(web,'src/app/globals.css'),'utf8');
 const result=splitPublicStyles(input,sunSources),folder=join(web,'src/app/generated');await mkdir(folder,{recursive:true});
 const original=postcss.parse(input),base=postcss.root();
 for(const node of original.nodes)if(node.type==='atrule'&&((node.name==='tailwind'&&node.params==='base')||(node.name==='layer'&&node.params==='base')))base.append(node.clone());
 await writeFile(join(folder,'root-base.css'),base.toString());
 const hash=createHash('sha256').update(input).digest('hex');
 await writeFile(join(folder,'sun-root.css'),'/* Generated from globals.css; do not edit. Full source remains on all non-SUN page routes. */\n'+result.css);
 const report={schema:'nexid.public-css-split.v1',sourceHash:hash,sourceBytes:Buffer.byteLength(input),commonBytes:Buffer.byteLength(result.css),sourceGzip:gzipSync(input).length,commonGzip:gzipSync(result.css).length,rootBaseBytes:Buffer.byteLength(base.toString()),rootBaseGzip:gzipSync(base.toString()).length,removedRules:result.removed.length,excludedFamilies:result.families,conservativelyRetainedFamilies:result.retainedFamilies};
 await writeFile(join(folder,'manifest.json'),JSON.stringify(report,null,2)+'\n');
 return {...result,report,paths};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const {report}=await preparePublicStyles();console.log(JSON.stringify(report,null,2));}
