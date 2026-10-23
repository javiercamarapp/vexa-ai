/** Sparkline de 24 px sin ejes: línea de 1.5 px en tinta y punto rojo de marca en el último valor. Solo geometría: la cifra exacta siempre se imprime al lado. `tone` queda como dato (data-tone) sin cambiar el color: el semáforo vive en la variación, no en el trazo. */
export function Sparkline({data,w=72,h=24,tone='auto',label,color}:{color?:number;data:number[];w?:number;h?:number;tone?:'up'|'down'|'flat'|'auto';label:string}){
 if(data.length<2)return null;
 const min=Math.min(...data),max=Math.max(...data),span=max-min||1;
 const pts=data.map((v,i)=>[(i/(data.length-1))*(w-8)+4,h-4-((v-min)/span)*(h-8)] as const);
 const d=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
 const t=tone==='auto'?(data[data.length-1]>data[0]?'up':data[data.length-1]<data[0]?'down':'flat'):tone,[lx,ly]=pts[pts.length-1];
 return <svg className="spark" data-tone={t} data-c={color} style={color?{['--spark' as string]:`var(--chart-${((color-1)%8)+1})`}:undefined} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
  <path className="spark-area" d={`${d}L${lx.toFixed(1)},${h}L${pts[0][0].toFixed(1)},${h}Z`}/><path className="spark-line" d={d} pathLength={1}/><circle className="spark-dot" cx={lx} cy={ly} r="2.25"/></svg>;
}
