export function eventosVisibles<T extends {connected:boolean}>(catalogo:T[]):T[];
export function textoCanal(canal:{id:string;deliveryAvailable:boolean},tr?:(clave:never,vars?:Record<string,string|number>)=>string):string;
