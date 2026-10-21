'use client';
import {useEffect,useRef,useState} from 'react';
/** Width of an element in px (0 until measured). Charts render real pixels so text never gets stretched. */
export function useWidth<T extends HTMLElement>(){
 const ref=useRef<T>(null),[w,setW]=useState(0);
 useEffect(()=>{const el=ref.current;if(!el)return;const read=()=>setW(Math.round(el.getBoundingClientRect().width));const frame=requestAnimationFrame(read);const ro=new ResizeObserver(read);ro.observe(el);return()=>{cancelAnimationFrame(frame);ro.disconnect();};},[]);
 return [ref,w] as const;
}
