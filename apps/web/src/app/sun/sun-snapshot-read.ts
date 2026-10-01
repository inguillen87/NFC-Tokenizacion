/** Read-only bounded handoff: failure never retries a dynamic NFC scan. */
export async function readSunSnapshot(url:string,fetcher:typeof fetch=fetch,timeoutMs=8000):Promise<Record<string,unknown>|null>{
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>8000)return null;
 const controller=new AbortController();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<null>(resolve=>{timer=setTimeout(()=>{controller.abort();void reader?.cancel().catch(()=>{});resolve(null);},timeoutMs);});
 async function read(){
  const response=await fetcher(url,{method:'GET',cache:'no-store',redirect:'error',signal:controller.signal});
  if(controller.signal.aborted||!response.ok||response.redirected||!response.headers.get('content-type')?.includes('application/json')||Number(response.headers.get('content-length'))>1048576||!response.body){void response.body?.cancel().catch(()=>{});return null;}
  reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  for(;;){const part=await reader.read();if(controller.signal.aborted)return null;if(part.done)break;size+=part.value.byteLength;if(size>1048576)return null;chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  return body?.ok===true&&body.contract&&typeof body.contract==='object'&&!Array.isArray(body.contract)?body.contract as Record<string,unknown>:null;
 }
 try{return await Promise.race([read(),deadline]);}catch{return null;}
 finally{clearTimeout(timer);controller.abort();void reader?.cancel().catch(()=>{});try{reader?.releaseLock();}catch{}}
}
