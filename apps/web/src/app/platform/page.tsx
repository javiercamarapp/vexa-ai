import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {authClient,config} from '../../lib/auth';
import {PlatformPanel} from '../../components/platform-panel';
export const dynamic='force-dynamic';
export default async function Page(){
 if(!config())return <section className="home access-flow"><h1>Administración de plataforma</h1><p role="alert">Falta configurar el acceso.</p><Link href="/login">Volver al acceso</Link></section>;
 const jar=await cookies();const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});
 const user=await client.auth.getUser();if(user.error||!user.data.user)redirect('/login?error=access_denied');
 const grant=await client.rpc('platform_manage',{p_input:{operation:'status'}});
 if(grant.error)return <section className="home access-flow"><h1>Administración de plataforma</h1><p role="alert">{grant.error.code==='42501'?'No tienes acceso a la administración de plataforma.':'No se pudo validar la administración. Intenta nuevamente.'}</p><Link href="/">Volver</Link></section>;
 const membership=await client.from('memberships').select('tenant_id').eq('user_id',user.data.user.id).eq('status','active').limit(1);
 return <section className="home access-flow">{!membership.error&&membership.data.length>0&&<nav aria-label="Administración"><Link href="/">Mi organización</Link></nav>}<PlatformPanel/><form action="/auth/logout" method="post"><button type="submit">Cerrar sesión</button></form></section>;
}
