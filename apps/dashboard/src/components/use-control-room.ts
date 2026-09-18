"use client";
import { useEffect, useRef, useState } from "react";
/** Presentation-only mode. Shares the existing stream; never opens a second feed. */
export function useControlRoom() {
  const [enabled,setEnabled]=useState(false);
  const [notice,setNotice]=useState("");
  const rootRef=useRef<HTMLDivElement>(null);
  const buttonRef=useRef<HTMLButtonElement>(null);
  const ownedFullscreen=useRef(false);
  useEffect(()=>{
    const full=()=>{
      if(ownedFullscreen.current && document.fullscreenElement!==rootRef.current){ownedFullscreen.current=false;setEnabled(false);buttonRef.current?.focus({preventScroll:true});}
      window.dispatchEvent(new Event("resize"));
    };
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){setEnabled(false);setNotice("");buttonRef.current?.focus({preventScroll:true});}};
    document.addEventListener("fullscreenchange",full);document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("fullscreenchange",full);document.removeEventListener("keydown",key);};
  },[]);
  async function toggle() {
    if(enabled){setEnabled(false);if(document.fullscreenElement===rootRef.current)await document.exitFullscreen().catch(()=>{});ownedFullscreen.current=false;buttonRef.current?.focus({preventScroll:true});}
    else {setEnabled(true);setNotice("");try{await rootRef.current?.requestFullscreen();ownedFullscreen.current=document.fullscreenElement===rootRef.current;}catch{setNotice("Modo sala dentro de la ventana. El navegador no permitió pantalla completa.");}}
    requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
  }
  return {enabled,notice,rootRef,buttonRef,toggle};
}
