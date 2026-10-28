'use client';
import {createContext, useContext, useEffect, useMemo, type ReactNode} from 'react';
import {IDIOMA_POR_OMISION, traductor, LOCALE_INTL, type Idioma, type Traductor} from '../../lib/i18n';
const Contexto = createContext<Idioma>(IDIOMA_POR_OMISION);
/** Expone a los componentes cliente el idioma que el servidor resolvió (?lang= / cookie rovaq_lang / inglés por omisión). Sin proveedor, el idioma es inglés. */
export function IdiomaProvider({idioma, children}: {idioma: Idioma; children: ReactNode}) {
  // El <html lang> del layout raíz es estático: aquí se alinea con el idioma activo para lectores de pantalla y traducción del navegador.
  useEffect(() => { document.documentElement.lang = idioma; }, [idioma]);
  return <Contexto.Provider value={idioma}>{children}</Contexto.Provider>;
}
/** Da el idioma a una isla de cliente SIN tocar <html lang> (consola de plataforma, que aún no está traducida entera). */
export function IdiomaLocal({idioma, children}: {idioma: Idioma; children: ReactNode}) { return <Contexto.Provider value={idioma}>{children}</Contexto.Provider>; }
export const useIdioma = (): Idioma => useContext(Contexto);
export function useT(): Traductor { const idioma = useIdioma(); return useMemo(() => traductor(idioma), [idioma]); }
export const useLocaleIntl = () => LOCALE_INTL[useIdioma()];
