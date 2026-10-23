import {CfoDashboard} from '../../../components/cfo/cfo-dashboard';
import {FIXTURES} from './_lib/access';
export const metadata = {title: 'Dinero'};
export const dynamic = 'force-dynamic';
type Search = Promise<Record<string, string | string[] | undefined>>;
// La página no consulta nada en el servidor: la sesión y el rol ya los validó el layout del espacio de trabajo y el panel pide el informe
// con la caché global (/cfo/data/report decide el acceso real: 403 si el rol no es propietario o analista). Así volver a Dinero no espera un viaje al servidor.
export default async function Page({searchParams}: {searchParams: Search}) {
  const search = await searchParams;
  const query = FIXTURES ? '?' + new URLSearchParams(Object.entries({as: search.as, demo: search.demo}).filter((e): e is [string, string] => typeof e[1] === 'string')).toString() : '';
  const rolDeprueba = FIXTURES && typeof search.as === 'string' ? search.as : undefined;
  return <CfoDashboard query={query === '?' ? '' : query} organization={FIXTURES ? 'Organización de demostración (sintética)' : undefined} roleOverride={rolDeprueba} />;
}
