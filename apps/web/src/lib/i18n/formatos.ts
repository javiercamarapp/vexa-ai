import * as F from '../formato/idioma.mjs';
import type {Idioma} from './idioma';
// Los formatos por idioma ligados a un idioma concreto: lo que usan componentes (useFormato), servidor y .mjs que reciben el idioma como dato.
export type Formatos = {
  idioma: Idioma; locale: string;
  numero: (n: number | null | undefined, opciones?: Intl.NumberFormatOptions) => string;
  compacto: (n: number | null | undefined, decimales?: number) => string;
  porcentaje: (p: number | null | undefined, opciones?: {decimales?: number; conSigno?: boolean}) => string;
  moneda: (n: number | null | undefined, codigo: string, opciones?: Intl.NumberFormatOptions) => string;
  mesLargo: (m: string | null | undefined) => string | null;
  mesCorto: (m: string | null | undefined, opciones?: {anio?: boolean}) => string | null;
  diaMes: (v: unknown, opciones?: {largo?: boolean}) => string | null;
  fechaCorta: (v: unknown) => string | null;
  fechaHora: (v: unknown) => string | null;
  diaHora: (v: unknown) => string | null;
  duracionMs: (ms: number | null | undefined) => string;
};
export const formatosDe = (idioma: Idioma): Formatos => ({
  idioma, locale: F.localeDe(idioma),
  numero: (n, o) => F.numero(n, idioma, o), compacto: (n, d) => F.compacto(n, idioma, d), porcentaje: (p, o) => F.porcentaje(p, idioma, o),
  moneda: (n, c, o) => F.moneda(n, c, idioma, o), mesLargo: (m) => F.mesLargo(m, idioma), mesCorto: (m, o) => F.mesCorto(m, idioma, o),
  diaMes: (v, o) => F.diaMes(v, idioma, o), fechaCorta: (v) => F.fechaCorta(v, idioma), fechaHora: (v) => F.fechaHora(v, idioma),
  diaHora: (v) => F.diaHora(v, idioma), duracionMs: (ms) => F.duracionMs(ms, idioma),
});
