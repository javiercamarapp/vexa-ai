// Frases de críticos con traductor OPCIONAL: el paquete (critico.mjs) arma el español de siempre y lo guarda en meta.critical_notice; aquí se rearma con las cuentas en el idioma activo.
// Sin traductor sale el texto del paquete, idéntico (lo fijan las pruebas); con traductor, las claves tr.crit.*.
import {fraseCriticos, avisoCriticos} from '../../../../../packages/workspace-service/critico.mjs';
import {idiomaDe} from './trad.mjs';

const nfDe = (t) => new Intl.NumberFormat(idiomaDe(t) === 'en' ? 'en-US' : 'es-MX');
/** «53 grupos de problemas con revisión crítica (120 señales críticas, evidencias)». */
export function fraseCriticosT(t, {grupos, senales = null}) {
  const es = fraseCriticos({grupos, senales});
  if (!t) return es;
  const nf = nfDe(t), g = t(grupos === 1 ? 'tr.crit.grupo1' : 'tr.crit.grupoN', {n: nf.format(grupos)});
  return senales === null || senales === undefined ? g : t('tr.crit.conSenales', {grupos: g, senales: t(senales === 1 ? 'tr.crit.senal1' : 'tr.crit.senalN', {n: nf.format(senales)})});
}
/** Aviso del banner: la cifra, su unidad y por qué no depende de filtros ni de importe. */
export function avisoCriticosT(t, {grupos, senales = null}) {
  return t ? t('tr.crit.aviso', {frase: fraseCriticosT(t, {grupos, senales})}) : avisoCriticos({grupos, senales});
}
/** Aviso a partir de `bundle.meta`: con cuentas se rearma por idioma; sin ellas (respuesta vieja) se conserva el texto del paquete. */
export function avisoDeMeta(t, meta) {
  const c = meta?.critical_counts;
  return c && Number.isFinite(c.groups) ? avisoCriticosT(t, {grupos: c.groups, senales: c.signals ?? null}) : (meta?.critical_notice ?? null);
}
