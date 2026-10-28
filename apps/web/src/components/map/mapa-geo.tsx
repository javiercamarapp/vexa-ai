'use client';
import {useT} from '../i18n/proveedor';
import {RovaqCargando} from '../rovaq-cargando';
// Mapa con geometrías reales (SVG puro, sin librerías, sin teselas, sin red). Cámara, entrada escalonada y vuelo adaptados del «Cerebro de ventas»
// de Likida (repo propio, src/app/admin/mapa-prospectos/cerebro.tsx): cámara imperativa en un <g>, curva cubic-bezier(.22,1,.36,1), borde que se engrosa al elegir.
import {useCallback,useEffect,useId,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useTipPosicion} from '../ui/use-tip-posicion';
import type {KeyboardEvent,PointerEvent as RPointerEvent,ReactNode} from 'react';
import {VISTA_PAIS,ZOOM_MAX,cabeEtiqueta,camaraParaRegion,limitarCamara,regionesPintadas,zoomEnPunto,type Camara,type GeoPais} from './mapa-modelo.mjs';

export type Mosaico={clave:string;nombre:string;n:number};
type Pais='US'|'MX';
const CARGAS:Record<Pais,()=>Promise<{default:GeoPais}>>={US:()=>import('./geo/geo-us.mjs'),MX:()=>import('./geo/geo-mx.mjs')};
const CURVA='cubic-bezier(.22,1,.36,1)';
const reducido=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Tip={clave:string;x:number;y:number};

export function MapaGeo({pais,datos,max,total,nombres,seleccion,onElegir,etiqueta}:{pais:Pais;datos:Map<string,Mosaico>;max:number;total:number;nombres:Readonly<Record<string,string>>;seleccion:string|null;onElegir:(clave:string)=>void;etiqueta:string}){
 const t=useT();
 const textoRegion=(nombre:string,d:Mosaico|null|undefined,total:number)=>{if(!d||!(d.n>0))return t('mapa.sinDatoRegion',{nombre});const pc=total>0?' · '+String(Math.round((d.n*1000)/total)/10)+' %':'';return `${nombre}: ${d.n.toLocaleString('en-US')} ${d.n===1?t('mapa.caso'):t('mapa.casos')}${pc}`;};
 const uid=useId().replace(/[^a-zA-Z0-9]/g,''),idPunto=`mp-punto-${uid}`;
 const [cargado,setCargado]=useState<{pais:Pais;geo:GeoPais}|null>(null),[falloDe,setFalloDe]=useState<Pais|null>(null),[k,setK]=useState(1),[tip,setTip]=useState<Tip|null>(null),[ancho,setAncho]=useState(0);
 const caja=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),g=useRef<SVGGElement>(null);
 const cam=useRef<Camara>({x:0,y:0,k:1}),dedos=useRef(new Map<number,{x:number;y:number}>()),distPrev=useRef(0),gesto=useRef<{cx:number;cy:number;mov:number;captura:boolean}|null>(null),arrastro=useRef(false),sync=useRef<ReturnType<typeof setTimeout>|null>(null);
 const geo=cargado?.pais===pais?cargado.geo:null,fallo=falloDe===pais;
 const vb=geo?.viewBox??VISTA_PAIS[pais];
 useEffect(()=>{const el=caja.current;if(!el)return;const ro=new ResizeObserver(()=>setAncho(el.clientWidth));ro.observe(el);return()=>ro.disconnect();},[]);

 useEffect(()=>{let vivo=true;
  CARGAS[pais]().then(m=>{if(vivo)setCargado({pais,geo:m.default});}).catch(()=>{if(vivo)setFalloDe(pais);});
  return()=>{vivo=false;};},[pais]);

 const aplicar=useCallback((animar:boolean)=>{const el=g.current;if(!el)return;
  el.style.transition=animar&&!reducido()?`transform 700ms ${CURVA}`:'none';
  el.style.transform=`translate(${cam.current.x}px,${cam.current.y}px) scale(${cam.current.k})`;
 },[]);
 const sincronizar=useCallback((ya:boolean)=>{if(sync.current)clearTimeout(sync.current);if(ya)setK(cam.current.k);else sync.current=setTimeout(()=>setK(cam.current.k),140);},[]);
 const mover=useCallback((c:Camara,animar:boolean)=>{cam.current=limitarCamara(c,vb);aplicar(animar);sincronizar(animar);},[vb,aplicar,sincronizar]);
 useEffect(()=>()=>{if(sync.current)clearTimeout(sync.current);},[]);

 // Al elegir (o quitar) un estado la cámara vuela hacia él; al cambiar de geometría se reinicia.
 const region=useMemo(()=>geo?.regiones.find(r=>r.clave===seleccion)??null,[geo,seleccion]);
 useEffect(()=>{if(!geo)return;mover(region?camaraParaRegion(region,geo.viewBox):{x:0,y:0,k:1},true);},[geo,region,mover]);

 const aViewBox=(cx:number,cy:number)=>{const r=svg.current?.getBoundingClientRect();if(!r||!r.width)return{px:vb.w/2,py:vb.h/2};const f=r.width/vb.w;return{px:(cx-r.left)/f,py:(cy-r.top)/f};};
 const centro=():[number,number]=>{const r=svg.current?.getBoundingClientRect();return r?[r.left+r.width/2,r.top+r.height/2]:[0,0];};
 const zoom=(factor:number)=>{const{px,py}=aViewBox(...centro());mover(zoomEnPunto(cam.current,px,py,factor,vb),true);};

 // Rueda: solo con Ctrl/⌘ (también es el gesto de pellizco del trackpad) para no secuestrar el scroll de la página. Listener no pasivo.
 useEffect(()=>{const el=svg.current;if(!el)return;
  const rueda=(ev:WheelEvent)=>{if(!ev.ctrlKey&&!ev.metaKey)return;ev.preventDefault();const{px,py}=aViewBox(ev.clientX,ev.clientY);mover(zoomEnPunto(cam.current,px,py,Math.exp(-ev.deltaY*0.0022),vb),false);};
  el.addEventListener('wheel',rueda,{passive:false});return()=>el.removeEventListener('wheel',rueda);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- aViewBox solo lee refs
 },[vb,mover,geo]);

 const abajo=(e:RPointerEvent<SVGSVGElement>)=>{arrastro.current=false;if(e.pointerType==='touch'){dedos.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(dedos.current.size===2){const[a,b]=[...dedos.current.values()];distPrev.current=Math.hypot(a.x-b.x,a.y-b.y);}}gesto.current={cx:e.clientX,cy:e.clientY,mov:0,captura:false};};
 const mueve=(e:RPointerEvent<SVGSVGElement>)=>{
  // Pellizco con dos dedos (táctil): acerca o aleja alrededor del punto medio.
  if(e.pointerType==='touch'&&dedos.current.has(e.pointerId)){dedos.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(dedos.current.size===2){const[p,q]=[...dedos.current.values()],d=Math.hypot(p.x-q.x,p.y-q.y);
    if(distPrev.current>0&&d>0){const{px,py}=aViewBox((p.x+q.x)/2,(p.y+q.y)/2);arrastro.current=true;setTip(null);mover(zoomEnPunto(cam.current,px,py,d/distPrev.current,vb),false);}
    distPrev.current=d;gesto.current=null;return;}}
  const a=gesto.current;
  if(a){const r=svg.current?.getBoundingClientRect(),f=r&&r.width?r.width/vb.w:1,dx=e.clientX-a.cx,dy=e.clientY-a.cy;a.cx=e.clientX;a.cy=e.clientY;a.mov+=Math.abs(dx)+Math.abs(dy);
   if(a.mov>5&&cam.current.k>1){arrastro.current=true;if(!a.captura){a.captura=true;svg.current?.setPointerCapture?.(e.pointerId);}
    cam.current=limitarCamara({...cam.current,x:cam.current.x+dx/f,y:cam.current.y+dy/f},vb);aplicar(false);setTip(null);}}
 };
 const suelta=(e?:RPointerEvent<SVGSVGElement>)=>{if(e)dedos.current.delete(e.pointerId);if(dedos.current.size<2)distPrev.current=0;if(gesto.current?.captura)sincronizar(true);gesto.current=null;};
 const sobre=(clave:string)=>(e:RPointerEvent<SVGPathElement>)=>{if(e.pointerType!=='mouse'||gesto.current?.captura)return;const c=caja.current?.getBoundingClientRect();if(c)setTip({clave,x:e.clientX-c.left,y:e.clientY-c.top});};
 const tecla=(clave:string)=>(e:KeyboardEvent<SVGPathElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onElegir(clave);}};
 const clic=(clave:string)=>()=>{if(arrastro.current)return;onElegir(clave);};

 const pintadas=useMemo(()=>geo?regionesPintadas(geo,datos,max):[],[geo,datos,max]);
 const nombreDe=(r:{codigo:string})=>nombres[r.codigo]??r.codigo;
 const tipReg=tip?pintadas.find(p=>p.r.clave===tip.clave):null;
 const elegida=pintadas.find(p=>p.r.clave===seleccion)??null;
 const pxPorU=ancho?ancho/vb.w:0.5;

 return <div className="mp-lienzo" ref={caja}>
  <div className="mp-zoom" role="group" aria-label={t('mapa.zoomGrupo')}>
   <button type="button" onClick={()=>zoom(1.6)} disabled={!geo||k>=ZOOM_MAX} aria-label={t('mapa.acercar')}>+</button>
   <button type="button" onClick={()=>zoom(1/1.6)} disabled={!geo||k<=1} aria-label={t('mapa.alejar')}>−</button>
   <button type="button" onClick={()=>mover({x:0,y:0,k:1},true)} disabled={!geo||k<=1} aria-label={t('mapa.verTodo')}>⤢</button>
  </div>
  <svg ref={svg} className="mp-svg" viewBox={`0 0 ${vb.w} ${vb.h}`} role="group" aria-label={etiqueta} data-zoom={k>1?'on':'off'} data-listo={geo?'si':'no'}
   onPointerDown={abajo} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta} onPointerLeave={()=>{setTip(null);}} onLostPointerCapture={suelta}>
   <defs><pattern id={idPunto} width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.6" cy="1.6" r="0.9" className="mp-punto"/></pattern></defs>
   <g ref={g} className="mp-g">
    {pintadas.map(({r,d,tipo,paso},i)=>{
     const nombre=nombreDe(r),sel=seleccion===r.clave,txt=textoRegion(nombre,d,total);
     const base={d:r.path,className:'mp-reg',style:{'--i':i,...(tipo==='sin-dato'?{fill:`url(#${idPunto})`}:{})} as React.CSSProperties,'data-paso':paso,'data-tipo':tipo,'data-sel':sel||undefined,vectorEffect:'non-scaling-stroke' as const};
     return tipo==='dato'
      ?<path key={r.clave} {...base} role="button" tabIndex={0} aria-pressed={sel} aria-label={txt} onClick={clic(r.clave)} onKeyDown={tecla(r.clave)} onPointerEnter={sobre(r.clave)} onPointerMove={sobre(r.clave)} onPointerLeave={()=>setTip(null)}/>
      :<path key={r.clave} {...base} aria-hidden="true" onPointerEnter={sobre(r.clave)} onPointerMove={sobre(r.clave)} onPointerLeave={()=>setTip(null)}/>;
    })}
    {/* El elegido se repite encima, sin foco ni puntero, para que su borde rojo no lo tapen los vecinos. */}
    {elegida&&<path d={elegida.r.path} className="mp-reg mp-sobre" vectorEffect="non-scaling-stroke" aria-hidden="true"/>}
    {pintadas.filter(p=>p.tipo==='dato'&&cabeEtiqueta(p.r,k*pxPorU)).map(({r,paso})=>
     <text key={r.clave} x={r.cx} y={r.cy} className="mp-cod" data-paso={paso} style={{fontSize:`${12/(k*pxPorU)}px`}} textAnchor="middle" dominantBaseline="central" aria-hidden="true">{r.codigo}</text>)}
   </g>
  </svg>
  {!geo&&<div className={'mp-carga'+(fallo?' mp-carga-fallo':'')} role="status">{fallo?t('mapa.falloMapa'):<RovaqCargando compacto mensaje={t('mapa.cargandoMapa')}/>}</div>}
  {tip&&tipReg&&typeof document!=='undefined'&&createPortal(<TipRegion ancla={()=>{const c=caja.current?.getBoundingClientRect();return c?{ax:c.left+tip.x,ay:c.top+tip.y,modo:'lado' as const,sep:14}:null;}}>{textoRegion(nombreDe(tipReg.r),tipReg.d,total)}</TipRegion>,document.body)}
 </div>;
}

/** Tooltip de región: fuera del lienzo (portal a <body>, position:fixed) para que el overflow:hidden del mapa no lo corte; junto al cursor, volteado y acotado al viewport. */
function TipRegion({ancla,children}:{ancla:()=>{ax:number;ay:number;modo:'lado';sep:number}|null;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useTipPosicion(ref,true,ancla);
 return <div ref={ref} className="mp-tip" role="presentation">{children}</div>;
}
