import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_ORG, AccessError, authClient, config, identity, resolveSession } from '../lib/auth';
import { SessionGuard } from './session-guard';
export const dynamic='force-dynamic';
export default async function Home() {
  const c=config();
  if(!c)return <section className="home"><h1>VEXA · En construcción</h1><p>El acceso aún no está configurado. No hay datos de clientes ni métricas disponibles.</p><a href="/login">Acceder</a></section>;
  const jar=await cookies();
  // Middleware owns refresh writes; server rendering can only read cookies.
  const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});
  let session;
  try {session=await resolveSession(identity(client),jar.get(ACTIVE_ORG)?.value);}
  catch(error){if(error instanceof AccessError && [401,403].includes(error.status))redirect('/login?error=access_denied');throw error;}
  const {data:organizations,error}=await client.from('organizations').select('id,name').in('id',session.memberships.map(m=>m.tenant_id)).order('name');
  if(error)throw new AccessError(503,'organizations_unavailable');
  const active=organizations?.find(org=>org.id===session.active.tenant_id);
  if(!active)redirect('/login?error=access_denied');
  return <section className="home"><SessionGuard/><h1>Tu organización</h1>
    <form action="/auth/organization" method="post">
      <label htmlFor="organization">Organización activa</label>{' '}
      <select id="organization" name="tenant_id" defaultValue={session.active.tenant_id} required>
        {organizations?.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}
      </select>{' '}<button type="submit">Cambiar organización</button>
    </form>
    <h2>{active.name}</h2><p>Rol: {session.active.role}</p>
    <p>Producto en construcción. Las fuentes y funciones de análisis aún no están disponibles.</p>
    <form action="/auth/logout" method="post"><button type="submit">Cerrar sesión</button></form>
  </section>;
}
