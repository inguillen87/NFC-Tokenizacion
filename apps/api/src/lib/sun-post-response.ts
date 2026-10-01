export type SunAfterResponse=(task:()=>Promise<void>)=>void;
/** The server supplies a supported lifecycle hook. Persistence is never deferred. */
export async function runSunProjection(task:()=>Promise<void>,schedule?:SunAfterResponse):Promise<void>{
 if(schedule){try{schedule(task);return;}catch{/* Keep original behavior outside a supported request context. */}}
 await task();
}
