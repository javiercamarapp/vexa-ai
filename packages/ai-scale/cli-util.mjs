// Parseo estricto de opciones numéricas de CLI: un entero positivo o error (nada de NaN/Infinity/decimales silenciosos).
export function intOpt(args,name,def){
  const i=args.indexOf('--'+name);if(i<0)return def;
  const v=args[i+1];if(typeof v!=='string'||!/^[1-9]\d{0,9}$/.test(v))throw Error(`--${name} debe ser un entero positivo`);
  return Number(v);
}
export function moneyOpt(args,name,def){
  const i=args.indexOf('--'+name);if(i<0)return def;
  const v=args[i+1];if(typeof v!=='string'||!/^\d+(\.\d+)?$/.test(v)||!(Number(v)>0))throw Error(`--${name} debe ser un número positivo`);
  return Number(v);
}
