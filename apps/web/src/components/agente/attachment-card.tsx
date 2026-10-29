'use client';
import {type AdjuntoResumen} from './attachments';
import {useLocaleIntl,useT} from '../i18n/proveedor';
/** Local analysis of a file the user attached. Always labelled as user-provided data; never uses the Observado/Estimado/Inferido badges. */
export function AttachmentCard({a}:{a:AdjuntoResumen}){
 const tx=useT(),loc=useLocaleIntl(),nf=new Intl.NumberFormat(loc,{maximumFractionDigits:2}),max=Math.max(1,...(a.freq?.rows.map(r=>r.count)??[1]));
 return <section className="card agente-attach" aria-label={tx('tr.ag.adjAria',{name:a.name})}>
  <div className="agente-block-head"><h3>{a.name}</h3><span className="agente-block-tags"><span className="chip chip-user" title={tx('tr.ag.adjNoVerif')}>{tx('tr.ag.adjRotulo')}</span><span className="chip">{(a.bytes/1024).toLocaleString(loc,{maximumFractionDigits:1})} KB · {a.kind.toUpperCase()}</span></span></div>
  {a.rows!==null&&<p className="card-lead">{tx('tr.ag.adjFilasCols',{filas:nf.format(a.rows),cols:a.columns.length,trunc:a.truncated?tx('tr.ag.adjSoloPrimeras'):''})}</p>}
  {a.text&&<p className="card-lead">{tx('tr.ag.adjTexto',{l:nf.format(a.text.lines),w:nf.format(a.text.words),c:nf.format(a.text.chars)})}</p>}
  {a.preview.length>0&&<div className="table-wrap" tabIndex={0} role="region" aria-label={tx('tr.ag.adjVista',{name:a.name})}><table>{a.kind!=='txt'&&<thead><tr>{a.preview[0].map((c,i)=><th key={i} scope="col">{c}</th>)}</tr></thead>}<tbody>{(a.kind==='txt'?a.preview:a.preview.slice(1)).map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
  {a.columns.some(c=>c.numeric)&&<div className="table-wrap" tabIndex={0} role="region" aria-label={tx('tr.ag.adjResumenAria')}><table><thead><tr><th scope="col">{tx('tr.ag.adjThColumna')}</th><th scope="col" className="num">{tx('tr.ag.adjThValor')}</th><th scope="col" className="num">{tx('tr.ag.adjThVacias')}</th><th scope="col" className="num">{tx('tr.ag.adjThMin')}</th><th scope="col" className="num">{tx('tr.ag.adjThMax')}</th><th scope="col" className="num">{tx('tr.ag.adjThSuma')}</th><th scope="col" className="num">{tx('tr.ag.adjThProm')}</th></tr></thead>
   <tbody>{a.columns.filter(c=>c.numeric).map(c=><tr key={c.name}><th scope="row">{c.name}</th><td className="num">{nf.format(c.filled)}</td><td className="num">{nf.format(c.missing)}</td><td className="num">{nf.format(c.numeric!.min)}</td><td className="num">{nf.format(c.numeric!.max)}</td><td className="num">{nf.format(c.numeric!.sum)}</td><td className="num">{nf.format(c.numeric!.mean)}</td></tr>)}</tbody></table></div>}
  {a.columns.some(c=>c.identificador)&&<p className="card-lead agente-note">{tx('tr.ag.adjIds',{lista:a.columns.filter(c=>c.identificador).map(c=>c.name).join(', ')})}</p>}
  {a.freq&&<figure className="agente-ubars" aria-label={tx('tr.ag.adjFreqAria',{col:a.freq.column})}><figcaption className="chart-title">{a.freq.column}<span>{tx('tr.ag.adjFilasValor')}</span></figcaption>
   <ul>{a.freq.rows.map(r=><li key={r.value}><span className="agente-ubar-name" title={r.value}>{r.value}</span><span className="agente-ubar-track"><span style={{width:Math.max(1,r.count*100/max)+'%'}}/></span><strong>{nf.format(r.count)}</strong></li>)}</ul></figure>}
  {a.notes.map(n=><p key={n} className="card-lead agente-note">{n}</p>)}
  <p className="card-lead agente-note">{tx('tr.ag.adjNoLee')}</p>
 </section>;
}
