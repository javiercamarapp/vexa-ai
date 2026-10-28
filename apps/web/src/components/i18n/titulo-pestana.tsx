'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {itemActivo} from '../../lib/workspace/menu.mjs';
import {tituloItem} from '../../lib/i18n/menu';
import {useIdioma, useT} from './proveedor';
/**
 * Título de la pestaña del navegador en inglés. El título en español sigue saliendo de `metadata.title` de cada página (estático, lo exige la prueba SEO);
 * en inglés se reescribe aquí con el título traducido del menú y se vuelve a aplicar si Next lo restablece al navegar. No renderiza nada.
 */
export function TituloPestana() {
  const idioma = useIdioma(), t = useT(), pathname = usePathname();
  useEffect(() => {
    if (idioma !== 'en') return;
    const activo = itemActivo(pathname ?? '');
    if (!activo) return;
    const titulo = `${tituloItem(t, activo.item)} · Rovaq AI`;
    const aplicar = () => { if (document.title !== titulo) document.title = titulo; };
    aplicar();
    const el = document.querySelector('title');
    const observador = new MutationObserver(aplicar);
    observador.observe(el ?? document.head, {childList: true, subtree: true, characterData: true});
    return () => observador.disconnect();
  }, [idioma, pathname, t]);
  return null;
}
