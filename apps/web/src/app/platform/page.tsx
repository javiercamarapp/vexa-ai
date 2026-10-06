import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {authClient,config} from '../../lib/auth';
import {VexaBrand} from '../../components/vexa-brand';
import {WorkspaceIcon} from '../../components/workspace/icon';
import './platform.css';
import {PlatformPanel} from '../../components/platform-panel';
export const dynamic='force-dynamic';
export default async function Page(){
 if(!config())return <section className="home access-flow"><h1>Administración de plataforma</h1><p role="alert">Falta configurar el acceso.</p><Link href="/login">Volver al acceso</Link></section>;
 const jar=await cookies();const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});
 const user=await client.auth.getUser();if(user.error||!user.data.user)redirect('/login?error=access_denied');
 const grant=await client.rpc('platform_manage',{p_input:{operation:'status'}});
 if(grant.error)return <section className="home access-flow"><h1>Administración de plataforma</h1><p role="alert">{grant.error.code==='42501'?'No tienes acceso a la administración de plataforma.':'No se pudo validar la administración. Intenta nuevamente.'}</p><Link href="/">Volver</Link></section>;
 const membership=await client.from('memberships').select('tenant_id').eq('user_id',user.data.user.id).eq('status','active').limit(1);
 return <div className="workspace workspace-shell platform-shell">
  <a className="skip-link workspace-skip" href="#platform-contenido">Saltar al contenido</a>
  <aside className="workspace-sidebar platform-sidebar" aria-label="Plataforma">
   <div className="sidebar-brand"><Link href="/platform" className="sidebar-logo" aria-label="Rovaq AI, administración"><VexaBrand/></Link></div>
   <div className="workspace-context"><span>Consola de administración</span><strong>Plataforma</strong><small>Organizaciones y accesos</small></div>
   <nav className="sidebar-navigation" aria-label="Administración de plataforma"><p className="nav-caption">Gestionar</p><ul>
    <li><a href="#organizaciones"><WorkspaceIcon name="overview"/>Organizaciones</a></li>
    <li><a href="#crear-organizacion"><WorkspaceIcon name="team"/>Crear organización</a></li>
    <li><a href="#actividad"><WorkspaceIcon name="history"/>Actividad</a></li>
   </ul></nav>
   <div className="sidebar-footer">
    {!membership.error&&membership.data.length>0&&<Link className="workspace-platform-link" href="/"><WorkspaceIcon name="overview"/>Mi organización</Link>}
    <div className="platform-account"><span className="account-avatar" aria-hidden="true">A</span><div className="account-copy"><strong>Administrador</strong><span>Acceso de plataforma</span></div></div>
    <form action="/auth/logout" method="post"><button className="platform-logout" type="submit"><WorkspaceIcon name="logout"/>Cerrar sesión</button></form>
   </div>
  </aside>
  <div className="workspace-frame"><header className="workspace-header"><span className="workspace-heading"><WorkspaceIcon name="settings"/>Consola de Rovaq AI</span><span className="platform-scope">Administración</span></header><div className="workspace-content" id="platform-contenido" tabIndex={-1}><PlatformPanel/></div></div>
 </div>;
}
