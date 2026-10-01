/** Independent presentation reads only, after the canonical validation. */
export async function readSunPresentation<P,T,S>(tasks:{passport:()=>Promise<P|null>;fallback:()=>Promise<P|null>;timeline:()=>Promise<T>;sensors:(passport:P|null)=>Promise<S>;actions:()=>Promise<boolean>}) {
 const passport=Promise.resolve().then(tasks.passport).then(value=>value??tasks.fallback());
 const timeline=Promise.resolve().then(tasks.timeline),actions=Promise.resolve().then(tasks.actions);
 const sensors=passport.then(tasks.sensors);
 const [p,t,s,a]=await Promise.all([passport,timeline,sensors,actions]);
 return {passport:p,timeline:t,sdkSensorTimeline:s,hasTokenizeRequest:a};
}
/** Fixed aggregate names; never put identifiers, URLs or locations into timing headers. */
export async function timedSunResponse(name:'sun_total'|'sun_snapshot',run:()=>Promise<Response>):Promise<Response>{
 const started=performance.now(),response=await run(),headers=new Headers(response.headers);
 headers.set('server-timing',`${name};dur=${Math.max(0,performance.now()-started).toFixed(1)}`);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
