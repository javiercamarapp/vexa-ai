import { config } from '../../lib/auth';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
  let configured=false;
  try {configured=!!config();}catch {/* Configuration is reported without exposing environment values. */}
  const denied=!!(await searchParams).error;
  const google=configured && process.env.VEXA_GOOGLE_AUTH_ENABLED==='true';
  return <section className="home"><h1>Acceder a VEXA</h1>
    {denied && <p role="alert">Acceso denegado. Inicia sesión con una cuenta que tenga una organización activa.</p>}
    {!configured && <p>El acceso aún no está configurado.</p>}
    {google ? <form action="/auth/google" method="post"><button type="submit">Continuar con Google</button></form> : <p>Google no está habilitado. El administrador debe configurar el proveedor antes de usarlo.</p>}
    <p>Los enlaces de acceso del entorno local se verifican mediante Supabase Auth.</p>
    {configured && <form action="/auth/logout" method="post"><button type="submit">Cerrar sesión</button></form>}
  </section>;
}
