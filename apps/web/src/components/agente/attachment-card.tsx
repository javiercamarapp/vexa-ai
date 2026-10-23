'use client';
import {ADJUNTO_ROTULO,type AdjuntoResumen} from './attachments';
const nf=new Intl.NumberFormat('es-MX',{maximumFractionDigits:2});
/** Local analysis of a file the user attached. Always labelled as user-provided data; never uses the Observado/Estimado/Inferido badges. */
export function AttachmentCard({a}:{a:AdjuntoResumen}){
 const max=Math.max(1,...(a.freq?.rows.map(r=>r.count)??[1]));
 return <section className="card agente-attach" aria-label={`Adjunto ${a.name}`}>
  <div className="agente-block-head"><h3>{a.name}</h3><span className="agente-block-tags"><span className="chip chip-user" title="No verificado ni parte del corte publicado.">{ADJUNTO_ROTULO}</span><span className="chip">{(a.bytes/1024).toLocaleString('es-MX',{maximumFractionDigits:1})} KB · {a.kind.toUpperCase()}</span></span></div>
  {a.rows!==null&&<p className="card-lead">{nf.format(a.rows)} filas y {a.columns.length} columnas{a.truncated?' (solo las primeras filas)':''}.</p>}
  {a.text&&<p className="card-lead">{nf.format(a.text.lines)} líneas, {nf.format(a.text.words)} palabras, {nf.format(a.text.chars)} caracteres.</p>}
  {a.preview.length>0&&<div className="table-wrap" tabIndex={0} role="region" aria-label={`Vista previa de ${a.name}`}><table>{a.kind!=='txt'&&<thead><tr>{a.preview[0].map((c,i)=><th key={i} scope="col">{c}</th>)}</tr></thead>}<tbody>{(a.kind==='txt'?a.preview:a.preview.slice(1)).map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
  {a.columns.some(c=>c.numeric)&&<div className="table-wrap" tabIndex={0} role="region" aria-label="Resumen de columnas numéricas"><table><thead><tr><th scope="col">Columna</th><th scope="col" className="num">Con valor</th><th scope="col" className="num">Vacías</th><th scope="col" className="num">Mín.</th><th scope="col" className="num">Máx.</th><th scope="col" className="num">Suma</th><th scope="col" className="num">Promedio</th></tr></thead>
   <tbody>{a.columns.filter(c=>c.numeric).map(c=><tr key={c.name}><th scope="row">{c.name}</th><td className="num">{nf.format(c.filled)}</td><td className="num">{nf.format(c.missing)}</td><td className="num">{nf.format(c.numeric!.min)}</td><td className="num">{nf.format(c.numeric!.max)}</td><td className="num">{nf.format(c.numeric!.sum)}</td><td className="num">{nf.format(c.numeric!.mean)}</td></tr>)}</tbody></table></div>}
  {a.columns.some(c=>c.identificador)&&<p className="card-lead agente-note">Columnas identificadoras (no se suman ni se promedian): {a.columns.filter(c=>c.identificador).map(c=>c.name).join(', ')}.</p>}
  {a.freq&&<figure className="agente-ubars" aria-label={`Frecuencia de ${a.freq.column} (dato aportado por el usuario)`}><figcaption className="chart-title">{a.freq.column}<span>filas por valor</span></figcaption>
   <ul>{a.freq.rows.map(r=><li key={r.value}><span className="agente-ubar-name" title={r.value}>{r.value}</span><span className="agente-ubar-track"><span style={{width:Math.max(1,r.count*100/max)+'%'}}/></span><strong>{nf.format(r.count)}</strong></li>)}</ul></figure>}
  {a.notes.map(n=><p key={n} className="card-lead agente-note">{n}</p>)}
  <p className="card-lead agente-note">El agente no lee este archivo: sus respuestas salen solo del corte publicado.</p>
 </section>;
}
