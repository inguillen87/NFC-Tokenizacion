"use client";
import {createContext,useContext,useEffect,useState,useCallback,type ReactNode} from 'react';
import {parseProductNoticesV2,boundedNoticeJson,type ProductNoticesV2} from './product-notices-v2';
export type NoticeResource={tenant:string;bid:string;enabled:boolean;value:ProductNoticesV2|null;loading:boolean;failed:boolean;refresh:()=>void};
const Context=createContext<NoticeResource|null>(null);
/** One bounded request shared by the warning and the first-screen summary. No polling or browser persistence. */
export function ProductNoticeProvider({tenant,bid,enabled,children}:{tenant:string;bid:string;enabled:boolean;children:ReactNode}){
 const [state,setState]=useState<{value:ProductNoticesV2|null;loading:boolean;failed:boolean}>({value:null,loading:true,failed:false});
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!enabled)return;
  let current=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  setState(previous=>({value:previous.value?.scope.tenant===tenant&&previous.value.scope.bid===bid?previous.value:null,loading:true,failed:false}));
  void(async()=>{try{
   const response=await fetch('/api/product-notices/v2?'+new URLSearchParams({tenant,bid}),{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('notice_read_failed');
   const value=parseProductNoticesV2(await boundedNoticeJson(response),tenant,bid);
   if(current)setState({value,loading:false,failed:false});
  }catch{if(current)setState(previous=>({value:previous.value?.scope.tenant===tenant&&previous.value.scope.bid===bid?previous.value:null,loading:false,failed:true}));}
  finally{clearTimeout(timer);}})();
  return()=>{current=false;controller.abort();clearTimeout(timer);};
 },[tenant,bid,enabled,revision]);
 const refresh=useCallback(()=>{if(!state.loading)setRevision(x=>x+1);},[state.loading]);
 const value=enabled&&state.value?.scope.tenant===tenant&&state.value.scope.bid===bid?state.value:null;
 return <Context.Provider value={{tenant,bid,enabled,value,loading:enabled&&state.loading,failed:enabled&&state.failed,refresh}}>{children}</Context.Provider>;
}
export function useProductNotices(){return useContext(Context);}
