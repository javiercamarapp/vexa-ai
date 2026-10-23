'use client';
import {useCallback,useEffect,useLayoutEffect,useState} from 'react';
import {guardarVista,leerVista} from '../../lib/workspace/cache.mjs';
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
/** useState que recuerda su valor (filtros, orden, pestaña) mientras dure la sesión del navegador: al volver a la pantalla sigue como se dejó. Solo preferencias de vista, nunca datos. */
export function useVistaPersistente<T>(clave:string,inicial:T):[T,(valor:T)=>void]{
 const [valor,setValor]=useState<T>(inicial);
 useAntesDePintar(()=>{const g=leerVista('estado:'+clave) as {v?:T}|null;if(g&&'v' in g)setValor(g.v as T);},[clave]);
 const poner=useCallback((nuevo:T)=>{setValor(nuevo);guardarVista('estado:'+clave,{v:nuevo});},[clave]);
 return [valor,poner];
}
