import {MARCAS,marcaDe,monoEnOscuro} from './brand-marks.data';
export {marcaDe};
export type TamanoMarca=16|20|24;
const resolver=(m:string|null|undefined)=>m&&Object.hasOwn(MARCAS,m)?m:marcaDe(m);
/**
 * Logo original de una integración (HubSpot, Shopify, Zendesk…), SVG en línea de tamaño fijo (sin saltos de diseño).
 * `marca` acepta la clave (`hubspot`) o un nombre/clave de fuente («Tracker (Excel)»); si no se reconoce no pinta nada.
 * Sin `titulo` el icono es decorativo (aria-hidden): úsalo junto al nombre escrito. Con `titulo` es una imagen con nombre accesible.
 * El color de marca vive solo en el SVG; en tema oscuro pasa a tinta si no contrasta >= 3:1 (ver ui.css `.bm`).
 */
export function BrandMark({marca,tamaño=16,titulo}:{marca:string|null|undefined;tamaño?:TamanoMarca;titulo?:string}){
 const clave=resolver(marca);
 const def=clave?MARCAS[clave]:null;
 if(!def)return null;
 const aria=titulo?{role:'img' as const,'aria-label':titulo}:{'aria-hidden':true as const,focusable:false as const};
 const base={className:'bm',width:tamaño,height:tamaño,viewBox:'0 0 24 24',xmlns:'http://www.w3.org/2000/svg',...aria};
 if(def.tipo==='logo')return <svg {...base} data-marca={clave} data-mono-oscuro={monoEnOscuro(def)?'1':undefined}><path fill={def.color} d={def.path}/></svg>;
 if(def.tipo==='monograma')return <svg {...base} data-marca={clave} data-neutra="1"><rect x="2.5" y="2.5" width="19" height="19" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><text x="12" y="12" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontFamily="inherit" fontWeight="700" fontSize={def.letras.length>1?9.5:12}>{def.letras}</text></svg>;
 return <svg {...base} data-marca={clave} data-neutra="1"><path d="M6 2.5h8l4.5 4.5v13a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8 11h8M8 14.5h8M8 18h8M12 11v7" fill="none" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
/** Contenedor 28×28 con borde 1 px y radio 8 para el logo (filas de lista y tarjetas). Tamaño fijo: no cambia la altura de la fila. */
export function BrandBadge({marca,titulo}:{marca:string|null|undefined;titulo?:string}){
 const clave=resolver(marca);
 if(!clave)return null;
 return <span className="bm-badge"><BrandMark marca={clave} tamaño={20} titulo={titulo}/></span>;
}
/** Logo + nombre en línea (chips, leyendas, encabezados). Si la fuente no tiene marca, solo el texto. */
export function ConMarca({marca,children,tamaño=16}:{marca:string|null|undefined;children:React.ReactNode;tamaño?:TamanoMarca}){
 const clave=resolver(marca);
 if(!clave)return <>{children}</>;
 return <span className="bm-linea"><BrandMark marca={clave} tamaño={tamaño}/>{children}</span>;
}
