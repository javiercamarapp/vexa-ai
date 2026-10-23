import {sello,type ClaseCifra} from '../../lib/confianza/sello.mjs';
import type {Sello} from '../../lib/confianza/sello.mjs';
import './confianza.css';
/** Sello de procedencia de 4 campos bajo una cifra: clase · fuente · hasta fecha · actualizado hace. 11 px gris; el texto completo va también como título (tooltip). */
export function SelloProcedencia({sello:s,clase,fuente,hasta,actualizado}:{sello?:Sello;clase?:ClaseCifra;fuente?:string;hasta?:string|null;actualizado?:string|null}){
 const v=s??sello({clase,fuente,hasta,actualizado});
 return <ul className="sello" data-clase={v.clase} title={v.texto} aria-label={'Procedencia: '+v.texto}><li className="sello-clase">{v.claseTxt}</li><li>{v.fuente}</li><li>{v.hasta}</li><li>{v.actualizado}</li></ul>;
}
