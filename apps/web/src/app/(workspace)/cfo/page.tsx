import {CfoDashboard} from '../../../components/cfo/cfo-dashboard';
import {CopilotoNegocio} from '../../../components/copiloto/copiloto-negocio';
import {FIXTURES} from './_lib/access';
export const metadata = {title: 'CFO'};
export const dynamic = 'force-dynamic';
type Search = Promise<Record<string, string | string[] | undefined>>;
// La página no consulta nada en el servidor: la sesión y el rol ya los validó el layout del espacio de trabajo y el copiloto pide el informe
// con la caché global (/cfo/data/report decide el acceso real: 403 si el rol no es propietario o analista). Así volver a CFO no espera un viaje al servidor.
// /cfo abre el MODO COPILOTO (briefing + chat); el informe clásico completo sigue en /cfo?vista=informe.
export default async function Page({searchParams}: {searchParams: Search}) {
  const search = await searchParams;
  const query = FIXTURES ? '?' + new URLSearchParams(Object.entries({as: search.as, demo: search.demo}).filter((e): e is [string, string] => typeof e[1] === 'string')).toString() : '';
  const rolDeprueba = FIXTURES && typeof search.as === 'string' ? search.as : undefined;
  const organization = FIXTURES ? 'Organización de demostración (sintética)' : undefined;
  const q = query === '?' ? '' : query;
  if (search.vista === 'informe') {
    const volver = '/cfo' + (() => { const p = new URLSearchParams(Object.entries(search).filter((e): e is [string, string] => typeof e[1] === 'string' && e[0] !== 'vista')); const t = p.toString(); return t ? '?' + t : ''; })();
    return <CfoDashboard query={q} organization={organization} roleOverride={rolDeprueba} volverA={volver} />;
  }
  return <CopilotoNegocio modo="cfo" query={q} organization={organization} roleOverride={rolDeprueba} />;
}
