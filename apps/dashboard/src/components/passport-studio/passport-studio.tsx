"use client";
import {useEffect,useRef} from 'react';
import {mountPassportStudio} from './passport-studio-view';
import {studioHTTPTransport} from '../../lib/passport-studio-transport';
import type {StudioSnapshot} from '../../lib/passport-studio-contract';
import './passport-studio.css';
/** Integrate only after the BFF implements and validates the matching durable editorial contract.
 * The presenter has no assumed endpoint. This bridge adds no route or default production feature.
 * `initial` must be an authenticated, allowlisted server projection, never raw SDM configuration. */
export function PassportStudio({initial,endpoint}:{initial:StudioSnapshot;endpoint:string}){
 const host=useRef<HTMLDivElement>(null),first=useRef({initial,endpoint});
 // Caller must key by tenant+batch+draft to deliberately switch context. Do not reset unsaved input on incidental re-renders.
 useEffect(()=>{
  if(!host.current)return;
  const {initial:snapshot,endpoint:verifiedEndpoint}=first.current;
  const controller=mountPassportStudio(host.current,{initial:snapshot,send:studioHTTPTransport(verifiedEndpoint,snapshot.actorId)});
  return()=>controller.destroy();
 },[]);
 return <div ref={host} data-passport-studio-host aria-label="Passport Studio"/>;
}
