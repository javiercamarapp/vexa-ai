import {ConMarca} from '../ui/brand-mark';
import {useT,useIdioma} from '../i18n/proveedor';
import {LOCALE_INTL} from '../../lib/i18n';
import '../panel-comun/panel-comun.css';
type Ventana={canal:string;tipo:string;completa:boolean;desde:string|null;hasta:string|null;corte:string|null;inicioIso:string|null;finIso:string|null;corteIso:string|null};
const ms=(v:string|null)=>{const t=v?Date.parse(v):NaN;return Number.isNaN(t)?null:t;};
const mes=(t:number,loc='es-MX')=>new Date(t).toLocaleDateString(loc,{month:'short',year:'numeric',timeZone:'UTC'});
/** Línea de tiempo de ventanas de exportación: una fila por canal y tipo, barra desde–hasta en un eje común. Trama = ventana parcial; punteado = sin fecha de inicio (no se dibuja desde cero). */
export function VentanasLinea({filas,ahora}:{filas:Ventana[];ahora?:number}){
 const tx=useT(),loc=LOCALE_INTL[useIdioma()];
 const ini=filas.map(f=>ms(f.inicioIso)).filter((x):x is number=>x!==null),fin=filas.map(f=>ms(f.finIso)??ms(f.corteIso)).filter((x):x is number=>x!==null);
 const a=ini.length?Math.min(...ini):(ahora??Date.parse('2026-01-01T00:00:00Z'))-365*864e5,b=Math.max(...fin,a+864e5,ini.length?Math.max(...ini):a);
 const sp=b-a||1,pos=(t:number)=>Math.max(0,Math.min(100,(t-a)/sp*100));
 return <div className="pc-fill"><ul className="pc-vent ui-reset" role="list" aria-label={tx('conf.ventAria')}>{filas.map((f,i)=>{const i0=ms(f.inicioIso),i1=ms(f.finIso)??ms(f.corteIso);const sin=i0===null;
  const l=i0===null?0:pos(i0),w=i1===null?(i0===null?4:Math.max(2,100-l)):Math.max(2,pos(i1)-l);
  return <li key={i} style={{listStyle:'none'}}><span className="pc-vent-n"><ConMarca marca={f.canal}>{f.canal}</ConMarca><small>{f.tipo}</small></span>
   <span className="pc-vent-pista" role="img" aria-label={tx('conf.ventPista',{canal:f.canal,tipo:f.tipo,desde:f.desde??tx('conf.sinInicio'),hasta:f.hasta??f.corte??tx('conf.sinFechaCorte'),estado:f.completa?tx('conf.completaP'):tx('conf.parcialP')})}><i className="pc-vent-barra" data-parcial={!f.completa||undefined} data-sin={sin||undefined} style={{left:l+'%',width:w+'%',['--c' as string]:'var(--chart-8)'}}/></span>
   <span className="pc-vent-f">{f.desde?tx('conf.desdeX',{x:f.desde}):tx('conf.sinInicioC')}{f.hasta||f.corte?' · '+(f.hasta??f.corte):''}</span></li>;})}<li aria-hidden="true" className="pc-vent-eje" style={{listStyle:'none'}}><span/><span className="pc-eje"><span>{mes(a,loc)}</span><span>{mes(b,loc)}</span></span><span/></li></ul>
  <ul className="pc-leyenda ui-reset" role="list" style={{marginTop:8}}><li style={{listStyle:'none'}}><i/>{tx('conf.leyCompleta')}</li><li style={{listStyle:'none'}}><i data-parcial/>{tx('conf.leyParcial')}</li><li style={{listStyle:'none'}}><i style={{background:'none',border:'1px dashed var(--muted)'}}/>{tx('conf.leySinInicio')}</li></ul></div>;
}
