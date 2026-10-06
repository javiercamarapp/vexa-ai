import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_ORG, AccessError, authClient, config, identity, resolveSession } from '../lib/auth';
export const dynamic='force-dynamic';
export default async function Home() {
  if(!config())return <section className="home access-flow"><h1>Rovaq AI · En construcción</h1><p>El acceso aún no está configurado. No hay datos de clientes ni métricas disponibles.</p><a href="/login">Acceder</a></section>;
  const jar=await cookies();
  const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});
  try {await resolveSession(identity(client),jar.get(ACTIVE_ORG)?.value);}
  catch(error){
    if(error instanceof AccessError){
      if(error.status===401)redirect('/login');
      if(error.status===403)redirect('/login?error=access_denied');
    }
    throw error;
  }
  redirect('/overview');
}
