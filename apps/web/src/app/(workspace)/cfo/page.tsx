import {CfoDashboard} from '../../../components/cfo/cfo-dashboard';
import {Empty} from '../../../components/platform/primitives';
import {PageHeader} from '../../../components/ui/page-header';
import {LinkButton} from '../../../components/ui/button';
import {allowed, cfoAccessForPage, FIXTURES} from './_lib/access';
export const metadata = {title: 'Dinero'};
export const dynamic = 'force-dynamic';
type Search = Promise<Record<string, string | string[] | undefined>>;
export default async function Page({searchParams}: {searchParams: Search}) {
  const search = await searchParams;
  const access = await cfoAccessForPage(search);
  if (!allowed(access.role)) return <div className="cf-page"><PageHeader eyebrow="CFO del negocio" title="Dinero" description="Panel financiero del negocio para propietarios y analistas." />
    <Empty title="Tu rol no tiene acceso a este panel" tone="muted" action={<LinkButton href="/overview">Volver al resumen</LinkButton>}>El panel CFO muestra ingresos, reembolsos y exposición económica. Solo lo ven los propietarios y analistas de la organización; pide acceso a un propietario.</Empty></div>;
  // El informe ya no se calcula aquí (bloqueaba cada navegación): el panel lo pide con la caché global y pinta al instante lo último que vio.
  const query = FIXTURES ? '?' + new URLSearchParams(Object.entries({as: search.as, demo: search.demo}).filter((e): e is [string, string] => typeof e[1] === 'string')).toString() : '';
  return <CfoDashboard query={query === '?' ? '' : query} organization={access.mode === 'fixture' ? 'Organización de demostración (sintética)' : undefined} />;
}
