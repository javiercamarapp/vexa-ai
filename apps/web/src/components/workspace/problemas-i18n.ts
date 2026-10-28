import type {Clave, Traductor} from '../../lib/i18n';
/** Rótulos de interfaz de Problemas (severidad, grupo, motivo crítico): traducen los códigos; nunca el contenido del cliente. */
export const sevT = (t: Traductor, v: string | null | undefined): string | null => v === null || v === undefined || v === '' ? null : (['critical', 'high', 'medium', 'low'].includes(v) ? t(('prob.sev.' + v) as Clave) : String(v));
export function chipSevT(t: Traductor, severidad: string | null | undefined, critico: boolean | null | undefined): {texto: string; tono: 'bad' | 'warn' | 'neutral'; ayuda: string | null} | null {
  const e = sevT(t, severidad); if (e === null) return null;
  const tono = severidad === 'high' || severidad === 'critical' ? 'bad' as const : severidad === 'medium' ? 'warn' as const : 'neutral' as const;
  if (critico === true && (severidad === 'low' || severidad === 'medium')) return {texto: t('prob.sevMixtaChip'), tono: 'warn', ayuda: t('prob.sevMixtaAyuda', {sev: e.toLowerCase()})};
  return {texto: ['critical', 'high', 'medium', 'low'].includes(String(severidad)) ? t(('prob.sevChip.' + severidad) as Clave) : t('prob.sevChipOtra', {sev: e.toLowerCase()}), tono, ayuda: null};
}
type FilaGrupo = {general?: boolean; grupo?: {n: number; de: number} | null};
export const fraseGrupoT = (t: Traductor, f: FilaGrupo): string => f.general ? t('prob.grupoGeneral') : !f.grupo || f.grupo.de <= 1 ? t('prob.grupoUnico') : t('prob.grupoNDeM', {n: f.grupo.n, de: f.grupo.de});
export const motivoT = (t: Traductor, m: string | null | undefined): string | null => m === 'both' ? t('prob.motivo.both') : m === 'severity' ? t('prob.motivo.severity') : m === 'category' ? t('prob.motivo.category') : null;
export const senalesT = (t: Traductor, n: number): string => t(n === 1 ? 'prob.senal1' : 'prob.senalN');
