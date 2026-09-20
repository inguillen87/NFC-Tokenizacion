import {boundedJSON} from './passport-studio-transport';
import {parsePublishedLibrary,type PublishedChoice} from './passport-reuse';
import type {StudioSnapshot} from './passport-studio-contract';
export function publishedLibraryTransport(endpoint:string,tenant:string){
 if(!/^\/api\/admin\/batches\/[^/?#]+\/passport-editorial$/.test(endpoint)||endpoint.includes('..')||tenant&&!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant))throw Error('studio_library_endpoint_invalid');
 const base=endpoint.replace(/passport-editorial$/,'passport-library');
 return async(target:StudioSnapshot,q:string,choice:PublishedChoice|undefined,signal:AbortSignal)=>{
  const query=new URLSearchParams(tenant?{tenant}:{});if(choice){query.set('sourceId',choice.id);query.set('version',String(choice.version));query.set('digest',choice.digest);}else query.set('q',q.trim());
  const response=await fetch(base+'?'+query,{cache:'no-store',credentials:'same-origin',signal});
  if(!response.ok)throw Error(response.status===409?'La fuente o la revisión cambiaron. Volvé a buscar; tus campos no se modificaron.':response.status===403?'La cuenta no tiene permiso para reutilizar contenido de esta empresa.':'No se pudo confirmar el contenido publicado. No se aplicaron cambios.');
  return parsePublishedLibrary(await boundedJSON(response),target,choice?'':q.trim(),choice);
 };
}
