import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { traductor } from '../lib/i18n';
import { idiomaActual } from '../lib/i18n/servidor';
import { ACTIVE_ORG, AccessError, authClient, config, identity, resolveSession } from '../lib/auth';
export const dynamic='force-dynamic';
export default async function Home() {
  if(!config()){const t=traductor(await idiomaActual());return <section className="home access-flow"><h1>{t('tr.home.titulo')}</h1><p>{t('tr.home.sinConfig')}</p><a href="/login">{t('tr.home.acceder')}</a></section>;}
  const jar=await cookies();
  const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});
  try {await resolveSession(identity(client),jar.get(ACTIVE_ORG)?.value,{fallback:true});}
  catch(error){
    if(error instanceof AccessError){
      if(error.status===401)redirect('/login');
      if(error.status===403)redirect('/sin-acceso');
    }
    throw error;
  }
  redirect('/overview');
}
