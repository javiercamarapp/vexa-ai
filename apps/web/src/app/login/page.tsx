import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authClient, config } from '../../lib/auth';
import {RovaqLogo} from '../../components/rovaq-logo';
import {EmailLogin} from '../../components/email-login';
import {LoginArtwork} from '../../components/login/artwork';
import {LimpiarCache} from '../../components/limpiar-cache';
import {GuardarIdioma} from '../../components/i18n/guardar-idioma';
import {idiomaActual} from '../../lib/i18n/servidor';
import {idiomaValido} from '../../lib/i18n/idioma';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string;lang?:string}>}) {
  let configured=false;
  try {configured=!!config();}catch {/* Configuration is reported without exposing environment values. */}
  let signedIn=false;
  if(configured){
    try{const jar=await cookies();const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});const {data,error}=await client.auth.getUser();signedIn=!error&&!!data.user;}catch{/* An unavailable or invalid session does not expose a logout action. */}
  }
  const params=await searchParams;
  const loginError=params.error;
  // Mismo mecanismo que la app autenticada: ?lang= explícito, si no la cookie rovaq_lang, si no inglés.
  const locale=await idiomaActual(params.lang);
  const t=(es:string,en:string)=>locale==='en'?en:es;
  const localeLink=(lang:string)=>`/login?${new URLSearchParams({...loginError?{error:loginError}:{},lang})}`;
  // Con una sesión válida no hay nada que iniciar: va al resumen. Con ?error= se queda (acceso denegado) para no encadenar redirecciones con el middleware.
  if(signedIn&&!loginError)redirect('/overview');
  const denied=!!loginError;
  const google=configured && process.env.VEXA_GOOGLE_AUTH_ENABLED==='true';
  const email=configured && process.env.VEXA_EMAIL_AUTH_ENABLED==='true';
  return <div className="login login-editorial" lang={locale}><LimpiarCache/><GuardarIdioma idioma={locale} explicito={idiomaValido(params.lang)!==null}/>
    <section className="login-column"><div className="login-inner">
      <header className="login-entra auth-brand"><RovaqLogo variante="horizontal" tono="positivo" ancho={132} espacioLibre={false}/><nav className="login-locales" aria-label={t('Idioma','Language')}><a href={localeLink('es')} lang="es" aria-label="Español" aria-current={locale==='es'?'page':undefined}>ES</a><span aria-hidden="true">/</span><a href={localeLink('en')} lang="en" aria-label="English" aria-current={locale==='en'?'page':undefined}>EN</a></nav></header>
      <div className="login-copy">
        <p className="login-kicker login-entra">{t('Acceso al panel','Workspace access')}</p>
        <h1 className="login-serif login-entra">{t('Bienvenido a Rovaq AI','Welcome to Rovaq AI')}</h1>
        <p className="login-intro login-entra">{t('El panel de decisiones de tu negocio.','Your business decision workspace.')}</p>
        <div className="login-divider"/>
        {denied && <p className="login-message" role="alert">{loginError==='oauth_cancelled'?t('Google no completó el acceso. Puedes intentarlo de nuevo o entrar con un enlace por correo.','Google sign-in was cancelled. Try again or use an email link.'):t('Acceso denegado. Inicia sesión con una cuenta que tenga una organización activa.','Access denied. Sign in with an account that belongs to an active organization.')}</p>}
        {!configured && <p className="login-hint">{t('El acceso aún no está configurado.','Sign-in is not configured yet.')}</p>}
        <form action={google?"/auth/google":undefined} method="post" className="login-google login-entra">
          <button type="submit" className="login-btn login-btn-borde" disabled={!google} aria-describedby={!google?"google-availability":undefined}>
            <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
            {t('Continuar con Google','Continue with Google')}
          </button>
        </form>
        <div className="login-separator"><span/><p id="google-availability">{google?t('o','or'):t('Google no está disponible por ahora.','Google sign-in is currently unavailable.')}</p><span/></div>
        <EmailLogin enabled={email} locale={locale}/>
        <details className="login-access-help"><summary>{t('¿Necesitas ayuda para entrar?','Need help signing in?')}</summary><p>{t('No necesitas contraseña. Usa el correo con el que tu equipo te invitó y abre el enlace seguro que recibas. Revisa también la carpeta de correo no deseado.','No password needed. Use the email your team invited and open the secure link you receive. Check your spam folder too.')}</p></details>
        <p className="login-help">{t('¿Tu correo no tiene acceso?','Does your email need access?')} <strong>{t('Pide una invitación a tu equipo.','Ask your team for an invitation.')}</strong></p>
        <p className="login-footnote">{t('Acceso reservado a equipos autorizados. Inicia sesión sin contraseña con Google o un enlace seguro en tu correo.','For authorized teams. Sign in without a password using Google or a secure email link.')}</p>
        {signedIn && <form action="/auth/logout" method="post"><button type="submit" className="login-btn login-btn-borde">{t('Cerrar sesión','Sign out')}</button></form>}
      </div>
    </div></section>
    <aside className="login-visual" aria-label={t('De conversaciones a decisiones','From conversations to decisions')}><div className="login-story-surface">
      <div className="login-story-copy"><p className="login-kicker">Rovaq · Intelligence</p><h2 className="login-serif">{t('Tus clientes. Una operación conectada.','Your customers. One connected operation.')}</h2><p className="login-story-description">{t('Conversaciones, señales y decisiones con un mismo contexto. Entiende lo que importa y conserva la visibilidad de tu negocio.','Conversations, signals and decisions share the same context. Understand what matters and keep your business in view.')}</p></div>
      <LoginArtwork/>
    </div></aside>
  </div>;
}
