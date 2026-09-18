import { parseHealthSnapshot, parseSdkUsage, type HealthSnapshot, type HealthWindow, type Reading, type SdkUsage } from "./usage-health-model";
export type AdminReader = (path:string,init:RequestInit)=>Promise<Response>;
const MAX_BODY_BYTES=262144;
async function boundedJson(response:Response):Promise<unknown> {
  if(Number(response.headers.get("content-length"))>MAX_BODY_BYTES)throw new Error("body_limit");
  if(!response.body)throw new Error("empty_body");
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>MAX_BODY_BYTES)throw new Error("body_limit");chunks.push(part.value);}
  }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const joined=new Uint8Array(size);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(joined));
}
async function read<T>(fetcher:AdminReader,path:string,parse:(value:unknown)=>T|null):Promise<Reading<T>> {
  const checkedAt=()=>new Date().toISOString();
  try {
    const response=await fetcher(path,{method:"GET",cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(response.status===401||response.status===403)return {state:"forbidden",data:null,checkedAt:checkedAt()};
    if(!response.ok)return {state:"unavailable",data:null,checkedAt:checkedAt()};
    if(response.headers.get("x-nexid-data-mode")==="demo")return {state:"demo",data:null,checkedAt:checkedAt()};
    const data=parse(await boundedJson(response));
    return data ? {state:"ready",data,checkedAt:checkedAt()} : {state:"invalid",data:null,checkedAt:checkedAt()};
  }catch(error){return {state:error instanceof Error && ["TimeoutError","AbortError"].includes(error.name)?"timeout":"invalid",data:null,checkedAt:checkedAt()};}
}
export async function loadUsageHealth(input:{fetcher:AdminReader;window:HealthWindow;tenant:string;demo:boolean;includeSdk:boolean;canReadSdk:boolean}) {
  const {fetcher,window,tenant,demo,includeSdk,canReadSdk}=input;const checkedAt=new Date().toISOString();
  const empty=<T>(state:"demo"|"not_requested"|"forbidden"):Reading<T>=>({state,data:null,checkedAt});
  if(demo)return {health:empty<HealthSnapshot>("demo"),sdk:empty<SdkUsage>("demo")};
  const [health,sdk]=await Promise.all([read(fetcher,`observability/service-levels?window=${window}`,value=>parseHealthSnapshot(value,tenant?"tenant":"global",window)),!includeSdk?Promise.resolve(empty<SdkUsage>("not_requested")):!canReadSdk?Promise.resolve(empty<SdkUsage>("forbidden")):read(fetcher,"sdk/api-keys",value=>parseSdkUsage(value,tenant))]);
  return {health,sdk};
}
