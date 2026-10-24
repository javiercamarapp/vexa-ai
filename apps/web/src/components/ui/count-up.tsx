'use client';
import {useLayoutEffect,useRef} from 'react';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
/** Animated money: the DOM always holds the exact final text; the intermediate frames are exact fractions computed with BigInt.
 *  Skipped for reduced motion, automation (navigator.webdriver) and non-integer input. */
export function CountUpMoney({amountMinor,currency,exponent,className}:{amountMinor:string;currency:string;exponent:number;className?:string}){
 const ref=useRef<HTMLElement>(null),final=formatMinorUnits(amountMinor,currency,exponent);
 useLayoutEffect(()=>{
  const el=ref.current;if(!el||!/^-?\d+$/.test(amountMinor))return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||navigator.webdriver)return;
  const total=BigInt(amountMinor),start=performance.now(),duration=650;let raf=0;
  const frame=(now:number)=>{const p=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-p,3);el.textContent=p>=1?final:formatMinorUnits(String(total*BigInt(Math.round(eased*1000))/1000n),currency,exponent);if(p<1)raf=requestAnimationFrame(frame);};
  el.textContent=formatMinorUnits('0',currency,exponent);raf=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(raf);el.textContent=final;};
 },[amountMinor,currency,exponent,final]);
 return <strong ref={ref} className={className}>{final}</strong>;
}
