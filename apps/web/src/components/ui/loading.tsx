import {RovaqCargando} from '../rovaq-cargando';
/** Carga: solo el logo animado (sin spinners ni textos largos). */
export function Loading({compact=false,message}:{compact?:boolean;message?:string}){return <RovaqCargando compacto={compact} mensaje={message}/>;}
