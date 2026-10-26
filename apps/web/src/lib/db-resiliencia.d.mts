export function esErrorDeConexion(error:unknown):boolean;
export function conectarConReintento<C extends {release:(error?:Error | boolean)=>void}>(driver:{connect:()=>Promise<C>},comprobar:(c:C)=>Promise<unknown>,opciones?:{intentos?:number}):Promise<C>;
export function vigilarPool<P extends {on:(evento:'error',fn:(e:Error&{code?:string})=>void)=>unknown}>(pool:P,avisar?:(mensaje:string)=>void):P;
export class CompuertaAgotada extends Error{code:'POOL_WAIT'}
export function crearCompuerta(opciones?:{max?:number;esperaMs?:number}):{adquirir:()=>Promise<()=>void>;estado:()=>{activas:number;enEspera:number;max:number}};
