// Textos de cobertura que el servidor arma en español (meta.coverage del espacio de trabajo y de los briefs, «Cobertura n/m» de las métricas): se reconocen por su texto exacto
// y se rotulan en el idioma activo al pintar. El español de referencia vive SOLO en el diccionario (claves tr.cov.*): aquí no hay literales. Un texto que no está en la tabla
// (un dato nuevo) sale tal cual. Sin traductor, igual que lo mandó el servidor.
import {es} from '../i18n/es';

type Tr = (clave: never, vars?: Record<string, string | number>) => string;
type Regla = {clave: string; exacto: string | null; patron: RegExp | null; variables: string[]};
let reglas: Regla[] | null = null;
function tabla(): Regla[] {
  if (reglas) return reglas;
  reglas = [];
  for (const [clave, texto] of Object.entries(es)) {
    if (!clave.startsWith('tr.cov.')) continue;
    const variables = [...(texto as string).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (!variables.length) { reglas.push({clave, exacto: texto as string, patron: null, variables}); continue; }
    const fuente = (texto as string).split(/\{\w+\}/).map((trozo) => trozo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('([\\d,.]+)');
    reglas.push({clave, exacto: null, patron: new RegExp('^' + fuente + '$'), variables});
  }
  return reglas;
}
export const CLAVES_COBERTURA = (): string[] => tabla().map((r) => r.clave);
export function coberturaTexto(t: Tr | null | undefined, texto: string): string {
  if (!t || typeof texto !== 'string') return texto;
  for (const r of tabla()) {
    if (r.exacto !== null) { if (r.exacto === texto) return t(r.clave as never); continue; }
    const m = r.patron!.exec(texto);
    if (m) return t(r.clave as never, Object.fromEntries(r.variables.map((v, i) => [v, m[i + 1]])));
  }
  return texto;
}
