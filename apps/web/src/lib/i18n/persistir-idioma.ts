// Cliente: avisa al servidor del idioma elegido en el selector para guardarlo en la preferencia de la persona. Mejor esfuerzo y silencioso:
// sin sesión, sin red o sin la tabla en la base, no pasa nada (la cookie rovaq_lang ya quedó escrita y manda en la interfaz).
import type {Idioma} from './idioma';
export const RUTA_PREFERENCIA_IDIOMA = '/api/preferencias/idioma';
export async function persistirIdioma(idioma: Idioma, enviar: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await enviar(RUTA_PREFERENCIA_IDIOMA, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({idioma}), credentials: 'same-origin', keepalive: true});
    return r.ok;
  } catch { return false; }
}
