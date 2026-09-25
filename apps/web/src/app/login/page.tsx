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
  const email=configured && process.env.VEXA_EMAIL_AUTH_ENABLED==='true';
  return <div className="login">
    <section className="login-column"><div className="login-inner">
      <header className="login-entra auth-brand"><VexaBrand/></header>
      <div className="login-copy">
        <p className="login-kicker login-entra">Acceso al panel</p>
        <h1 className="login-serif login-entra">Bienvenido<br/>a VEXA AI</h1>
        <p className="login-intro login-entra">Decisiones con evidencia para tu equipo.</p>
        <div className="login-divider"/>
        {denied && <p className="login-message" role="alert">Acceso denegado. Inicia sesión con una cuenta que tenga una organización activa.</p>}
        {!configured && <p className="login-hint">El acceso aún no está configurado.</p>}
        <form action="/auth/google" method="post" className="login-google login-entra">
          <button type="submit" className="login-btn login-btn-borde" disabled={!google} aria-describedby={!google?'google-availability':undefined}>
            <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
            Continuar con Google
          </button>
        </form>
        {!google && <p id="google-availability" className="login-hint">Google: pendiente de configurar.</p>}
        <div className="login-separator"><span/>o<span/></div>
        <EmailLogin enabled={email}/>
        <p className="login-help">¿Tu correo no tiene acceso? <strong>Pídele a tu equipo que te invite a VEXA.</strong></p>
        <p className="login-footnote">Acceso reservado a equipos autorizados. Inicia sesión sin contraseña con Google o un enlace seguro en tu correo.</p>
        {signedIn && <form action="/auth/logout" method="post"><button type="submit" className="login-btn login-btn-borde">Cerrar sesión</button></form>}
      </div>
    </div></section>
    <aside className="login-visual"><figure className="login-lamina">
      {/* eslint-disable-next-line @next/next/no-img-element -- Exact unmodified visual reference supplied by the user. */}
      <img src="/images/login-hero.png" alt="Recepción de un hotel boutique al anochecer." className="login-foto-marca" fetchPriority="high"/>
      <div className="login-velo"/>
      <figcaption><p className="login-kicker">De conversaciones a decisiones</p><p className="login-serif">Entiende lo que importa.<br/>Decide con evidencia.</p></figcaption>
    </figure></aside>
  </div>;
}
