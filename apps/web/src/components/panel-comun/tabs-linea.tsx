import Link from '../workspace/navigation-lifecycle';
export type TabLinea={key:string;label:string;href:string;count?:number|null};
/** Pestañas de página con subrayado (13 px): navegación entre vistas del mismo conjunto de datos. Máximo 6. */
export function TabsLinea({label,tabs,actual}:{label:string;tabs:TabLinea[];actual:string}){
 return <nav aria-label={label}><ul className="pc-tabs ui-reset" role="list">{tabs.map(t=><li key={t.key} style={{listStyle:'none'}}><Link href={t.href} aria-current={t.key===actual?'page':undefined}>{t.label}{t.count!=null&&<span className="pc-count" data-cero={t.count===0||undefined}>{t.count}</span>}</Link></li>)}</ul></nav>;
}
