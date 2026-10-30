/** R2-07 (login CSRF): un enlace con tokens en el fragmento instalaba la sesión de QUIEN lo generó en el navegador de quien lo abre. Ahora la sesión solo se instala tras un clic en «Entrar como <correo>».
 *  El correo se lee del payload del JWT SOLO para mostrarlo (no es una afirmación de identidad: el servidor refresca y verifica la sesión al confirmar). */
export function correoDeToken(accessToken:string|null|undefined):string|null{
  if(!accessToken||accessToken.length>8000)return null;
  const partes=accessToken.split('.');if(partes.length!==3)return null;
  try{
    const payload=JSON.parse(Buffer.from(partes[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')) as {email?:unknown};
    const e=payload.email;
    return typeof e==='string'&&e.length<=254&&/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(e)?e:null;
  }catch{return null;}
}
/** Tokens del fragmento de la URL (#access_token=…&refresh_token=…) sin instalar nada. */
export function tokensDeFragmento(hash:string):{accessToken:string;refreshToken:string;correo:string|null;conError:boolean}|null{
  const f=new URLSearchParams(hash.replace(/^#/,''));
  const accessToken=f.get('access_token'),refreshToken=f.get('refresh_token');
  if(!accessToken||!refreshToken)return f.has('error')?{accessToken:'',refreshToken:'',correo:null,conError:true}:null;
  return {accessToken,refreshToken,correo:correoDeToken(accessToken),conError:f.has('error')};
}
