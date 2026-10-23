import type {ReactNode} from 'react';
/** Kit de gráficas pequeñas y compactas. Color = identidad (tokens --chart-1..8, en orden fijo, nunca por ranking); estado = trama/discontinuo/punteado:
 *  parcial = trama, estimado = línea discontinua, desconocido = vacío punteado (NUNCA cero). Todas llevan etiqueta directa, aria-label y tabla equivalente (sr-only). */
export type Estado='real'|'parcial'|'estimado'|'desconocido';
export const color=(i:number)=>`var(--chart-${((i%8)+8)%8+1})`;
export const suave=(i:number)=>`var(--soft-${((i%8)+8)%8+1})`;
const fmt=(v:number)=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(v);
function Tabla({titulo,filas}:{titulo:string;filas:[string,string][]}){return <div className="sr-only"><table><caption>{titulo}</caption><tbody>{filas.map(([a,b],i)=><tr key={i}><th scope="row">{a}</th><td>{b}</td></tr>)}</tbody></table></div>;}

/** Barra apilada horizontal 100 %: una fila, segmentos con 2 px de separación y etiqueta directa en los grandes. */
export function BarraApilada({items,label,h=18,base=0,sinLeyenda=false}:{items:{label:string;value:number;estado?:Estado}[];label:string;h?:number;/** índice del primer color (0..7) para mantener el color fijo de la métrica */base?:number;sinLeyenda?:boolean}){
 const total=items.reduce((a,i)=>a+Math.max(0,i.value),0);
 if(total<=0)return <div className="mc-vacio" role="img" aria-label={label+': sin datos'}/>;
 return <div className="mc"><div className="mc-stack" role="img" aria-label={label+': '+items.map(i=>i.label+' '+fmt(i.value*100/total)+' %').join(', ')} style={{height:h}}>
  {items.map((it,i)=>{const p=Math.max(0,it.value)*100/total;return <span key={it.label} className="mc-seg" data-estado={it.estado??'real'} title={it.label+': '+fmt(p)+' %'} style={{flexBasis:p+'%',['--c' as string]:color(i+base)}}>{p>=14&&h>=14&&<b>{fmt(p)} %</b>}</span>;})}</div>
  {!sinLeyenda&&<ul className="mc-leyenda ui-reset">{items.map((it,i)=><li key={it.label}><i style={{background:color(i+base)}}/>{it.label}</li>)}</ul>}
  <Tabla titulo={label} filas={items.map(i=>[i.label,fmt(i.value)])}/></div>;
}
/** Dona pequeña: SOLO hasta 5 categorías (con más se usa BarraApilada). Total al centro. */
export function DonaMini({items,label,size=72,centro,sinLeyenda=false}:{items:{label:string;value:number;/** 1..8: color fijo de la métrica (si falta, por posición) */c?:number}[];label:string;size?:number;centro?:ReactNode;sinLeyenda?:boolean}){
 if(items.length>5)throw new Error('DonaMini admite como máximo 5 categorías; usa BarraApilada');
 const total=items.reduce((a,i)=>a+Math.max(0,i.value),0),r=size/2-5,c=2*Math.PI*r,col=(it:{c?:number},i:number)=>color(it.c?it.c-1:i);let acc=0;
 return <div className="mc mc-dona" style={{['--sz' as string]:size+'px'}}><span className="mc-dona-g"><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label+': '+items.map(i=>i.label+' '+fmt(i.value)).join(', ')}>
  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--ui-soft)" strokeWidth="8"/>
  {total>0&&items.map((it,i)=>{const len=Math.max(0,it.value)/total*c,el=<circle key={it.label} className="mc-arc" cx={size/2} cy={size/2} r={r} fill="none" stroke={col(it,i)} strokeWidth="8" strokeDasharray={`${Math.max(0,len-2)} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size/2} ${size/2})`}><title>{it.label+': '+fmt(it.value)}</title></circle>;acc+=len;return el;})}
 </svg>{centro&&<span className="mc-centro">{centro}</span>}</span>
 {!sinLeyenda&&<ul className="mc-leyenda ui-reset">{items.map((it,i)=><li key={it.label}><i style={{background:col(it,i)}}/>{it.label} <b>{fmt(it.value)}</b></li>)}</ul>}<Tabla titulo={label} filas={items.map(i=>[i.label,fmt(i.value)])}/></div>;
}
/** Barras agrupadas: categorías en X, hasta 3-4 series con color propio; etiqueta directa de la serie en la leyenda. null = desconocido (vacío punteado, no cero). */
export function BarrasAgrupadas({categorias,series,label,h=96,w=320}:{categorias:string[];series:{label:string;values:(number|null)[]}[];label:string;h?:number;w?:number}){
 const max=Math.max(1,...series.flatMap(s=>s.values.map(v=>v??0))),gw=w/categorias.length,bw=Math.max(3,Math.min(14,(gw-8)/series.length-2));
 return <div className="mc"><svg viewBox={`0 0 ${w} ${h+16}`} width="100%" role="img" aria-label={label}>
  <line x1="0" x2={w} y1={h} y2={h} stroke="var(--chart-grid,var(--ui-border))"/>
  {categorias.map((c,ci)=><g key={c}>{series.map((s,si)=>{const v=s.values[ci],x=ci*gw+(gw-series.length*(bw+2))/2+si*(bw+2);return v==null?<rect key={s.label} x={x} y={h-10} width={bw} height="10" rx="3" fill="none" stroke={color(si)} strokeDasharray="2 2"><title>{s.label+' · '+c+': sin dato'}</title></rect>:<rect key={s.label} className="mc-bar" x={x} y={h-v/max*h} width={bw} height={Math.max(1,v/max*h)} rx="3" fill={color(si)}><title>{s.label+' · '+c+': '+fmt(v)}</title></rect>;})}
   <text x={ci*gw+gw/2} y={h+12} textAnchor="middle" fontSize="12" fill="var(--muted)">{c}</text></g>)}</svg>
  <ul className="mc-leyenda ui-reset">{series.map((s,i)=><li key={s.label}><i style={{background:color(i)}}/>{s.label}</li>)}</ul>
  <Tabla titulo={label} filas={categorias.flatMap((c,ci)=>series.map(s=>[s.label+' · '+c,s.values[ci]==null?'sin dato':fmt(s.values[ci] as number)] as [string,string]))}/></div>;
}
/** Área comparativa: 2 series (p. ej. periodo actual sólido y anterior discontinuo) con etiqueta directa al final de cada línea. */
export function AreaComparativa({series,label,w=320,h=88}:{series:{label:string;values:(number|null)[];estado?:Estado}[];label:string;w?:number;h?:number}){
 const n=Math.max(...series.map(s=>s.values.length)),all=series.flatMap(s=>s.values.filter((v):v is number=>v!=null)),max=Math.max(1,...all),min=Math.min(0,...all),sp=max-min||1;
 const X=(i:number)=>4+i/(Math.max(1,n-1))*(w-64),Y=(v:number)=>h-4-(v-min)/sp*(h-12);
 return <div className="mc"><svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={label}>
  {series.map((s,si)=>{const pts=s.values.map((v,i)=>v==null?null:[X(i),Y(v)] as const),d=pts.map((p,i)=>p?`${pts.slice(0,i).some(q=>q===null)||i===0||!pts[i-1]?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`:'').join(''),last=[...pts].reverse().find(Boolean),first=pts.find(Boolean);
   return <g key={s.label}>{si===0&&first&&last&&<path className="mc-area" d={d+`L${last[0]},${h-4}L${first[0]},${h-4}Z`} fill={color(si)} opacity=".12"/>}
    <path className="mc-line" d={d} pathLength={1} fill="none" stroke={color(si)} strokeWidth="2" strokeDasharray={s.estado==='estimado'||si>0?'5 4':undefined} strokeLinecap="round"/>
    {last&&<text x={last[0]+6} y={last[1]+4} fontSize="12" fill="var(--ink)">{s.label}</text>}</g>;})}</svg>
  <Tabla titulo={label} filas={series.map(s=>[s.label,s.values.map(v=>v==null?'sin dato':fmt(v)).join(', ')])}/></div>;
}
/** Treemap simple (franjas proporcionales en 1–2 filas). Hasta 8 bloques con su color; etiqueta si cabe. */
export function TreemapSimple({items,label,h=96}:{items:{label:string;value:number}[];label:string;h?:number}){
 const v=items.filter(i=>i.value>0).sort((a,b)=>b.value-a.value).slice(0,8),tot=v.reduce((a,i)=>a+i.value,0)||1,cut=Math.ceil(v.length/2),filas=[v.slice(0,cut),v.slice(cut)].filter(f=>f.length),sumF=filas.map(f=>f.reduce((a,i)=>a+i.value,0));
 return <div className="mc"><div className="mc-tree" style={{height:h}} role="img" aria-label={label+': '+v.map(i=>i.label+' '+fmt(i.value)).join(', ')}>
  {filas.map((f,fi)=><div key={fi} className="mc-tree-row" style={{flexBasis:sumF[fi]/tot*100+'%'}}>{f.map(i=>{const k=v.indexOf(i);return <span key={i.label} className="mc-tree-cell" title={i.label+': '+fmt(i.value)} style={{flexBasis:i.value/sumF[fi]*100+'%',background:suave(k),borderColor:color(k)}}><b>{i.label}</b><small>{fmt(i.value)}</small></span>;})}</div>)}</div><Tabla titulo={label} filas={v.map(i=>[i.label,fmt(i.value)])}/></div>;
}
/** Bullet: valor real contra objetivo y rango previo. */
export function Bullet({value,target,max,label,i=0}:{value:number;target?:number;max:number;label:string;i?:number}){
 const p=(n:number)=>Math.min(100,Math.max(0,n/max*100));
 return <div className="mc-bullet" role="img" aria-label={label+': '+fmt(value)+(target!=null?' de objetivo '+fmt(target):'')}><span className="mc-bullet-track"><span className="mc-bullet-bar" style={{width:p(value)+'%',background:color(i)}}/>{target!=null&&<span className="mc-bullet-target" style={{left:p(target)+'%'}}/>}</span></div>;
}
/** Rampa secuencial de UN matiz para heatmaps: nivel 0..4 (mezcla del color con la superficie). */
export const rampa=(i:number,nivel:number)=>`color-mix(in srgb,${color(i)} ${[8,24,44,68,92][Math.max(0,Math.min(4,nivel))]}%,var(--ui-surface))`;
