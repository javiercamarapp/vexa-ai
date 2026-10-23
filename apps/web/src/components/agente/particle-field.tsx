'use client';
import {useEffect,useRef} from 'react';
/**
 * Decorative dot field behind the hero: a grid of tiny squares whose density follows three slow clouds (dithering with a FIXED threshold per
 * cell, so dots appear and fade as density crosses it, they do not move). Own canvas, no dependency.
 * Cost control: ~20 fps cap, device pixel ratio ≤ 2, paused when the tab is hidden or the canvas is off screen, a single static frame under
 * prefers-reduced-motion (and when the preference changes live). The mean draw time is exposed in `data-draw-ms` for measurement.
 */
const CELL=11,DOT=2.2,FRAME_MS=50;
const threshold=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
export function ParticleField(){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  let raf=0,last=0,visible=true,alive=true,w=0,h=0,drawCount=0,drawTotal=0;
  const size=()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);w=r.width;h=r.height;canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);};
  const draw=(t:number)=>{
   if(!w||!h)return;const t0=performance.now();
   ctx.clearRect(0,0,w,h);ctx.fillStyle=getComputedStyle(canvas).color;
   const clouds=[{x:w*.84+Math.sin(t*.00021)*w*.05,y:h*.16+Math.cos(t*.00017)*h*.06,r:w*.26},{x:w*.1+Math.cos(t*.00019)*w*.05,y:h*.8+Math.sin(t*.00023)*h*.06,r:w*.24},{x:w*.3+Math.sin(t*.00013)*w*.05,y:h*.08+Math.cos(t*.00011)*h*.04,r:w*.15}];
   const cx=w/2,cy=h*.45,narrow=w<640,k=narrow?.6:1,cap=narrow?.24:.5; // fainter on phones, where the text spans the whole width
   for(let gx=0;gx<w;gx+=CELL)for(let gy=0;gy<h;gy+=CELL){
    let d=0;for(const c of clouds){const dx=(gx-c.x)/c.r,dy=(gy-c.y)/c.r;d+=Math.max(0,1-(dx*dx+dy*dy));}
    const ux=(gx-cx)/(w*.42),uy=(gy-cy)/(h*.5);d*=Math.min(1,Math.max(0,ux*ux+uy*uy-.15)*2.2); // keep the centre clear: the content lives there
    if(d>threshold(gx,gy)){ctx.globalAlpha=Math.min(cap,.16*k+d*.3*k);ctx.fillRect(gx,gy,DOT,DOT);}
   }
   ctx.globalAlpha=1;drawTotal+=performance.now()-t0;drawCount++;canvas.dataset.drawMs=(drawTotal/drawCount).toFixed(2);canvas.dataset.frames=String(drawCount);
  };
  const loop=(ts:number)=>{if(!alive||!visible||document.hidden||reduce.matches){raf=0;return;}if(ts-last>=FRAME_MS){last=ts;draw(ts);}raf=requestAnimationFrame(loop);};
  const start=()=>{if(!raf&&alive&&visible&&!document.hidden&&!reduce.matches)raf=requestAnimationFrame(loop);};
  const stop=()=>{if(raf){cancelAnimationFrame(raf);raf=0;}};
  const redraw=()=>{size();draw(reduce.matches?0:performance.now());};
  size();draw(0);start();
  const ro=new ResizeObserver(redraw);ro.observe(canvas);
  const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(es=>{visible=es.some(e=>e.isIntersecting);if(visible)start();else stop();});io?.observe(canvas);
  const vis=()=>{if(document.hidden)stop();else start();};document.addEventListener('visibilitychange',vis);
  const pref=()=>{if(reduce.matches){stop();draw(0);}else start();};reduce.addEventListener('change',pref);
  return()=>{alive=false;stop();ro.disconnect();io?.disconnect();document.removeEventListener('visibilitychange',vis);reduce.removeEventListener('change',pref);};
 },[]);
 return <canvas ref={ref} className="particle-field" aria-hidden="true"/>;
}
