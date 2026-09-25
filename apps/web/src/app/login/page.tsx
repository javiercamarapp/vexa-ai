import { cookies } from 'next/headers';
import { authClient, config } from '../../lib/auth';
import {VexaBrand} from '../../components/vexa-brand';
import {EmailLogin} from '../../components/email-login';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
  let configured=false;
  try {configured=!!config();}catch {/* Configuration is reported without exposing environment values. */}
  let signedIn=false;
  if(configured){
    try{const jar=await cookies();const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});const {data,error}=await client.auth.getUser();signedIn=!error&&!!data.user;}catch{/* An unavailable or invalid session does not expose a logout action. */}
  }
  const denied=!!(await searchParams).error;
  const google=configured && process.env.VEXA_GOOGLE_AUTH_ENABLED==='true';
  return <section className="home auth-card"><div className="auth-brand"><VexaBrand/></div><h1>Bienvenido a VEXA</h1>
    {denied && <p role="alert">Acceso denegado. Inicia sesión con una cuenta que tenga una organización activa.</p>}
    {!configured && <p>El acceso aún no está configurado.</p>}
    {google ? <form action="/auth/google" method="post"><button type="submit">Continuar con Google</button></form> : <p>Google no está habilitado. El administrador debe configurar el proveedor antes de usarlo.</p>}
    <p>Accede con Google o recibe un enlace seguro en tu correo, sin contraseña. Necesitas una cuenta invitada a un equipo de VEXA.</p>
    {configured && process.env.VEXA_EMAIL_AUTH_ENABLED==='true' && <EmailLogin/>}
    {signedIn && <form action="/auth/logout" method="post"><button type="submit">Cerrar sesión</button></form>}
  </section>;
}
