// 404 propio del sitio (T7): con el shell, útil y noindex. Vive junto al layout del sitio (que pone el <html>) porque Next solo captura el notFound() de una página en la frontera del layout superior;
// el idioma llega por idioma-actual porque no-encontrada no recibe params. Responde 404 real: las rutas desconocidas se reescriben a __404.
import type {Metadata} from 'next';
import {landingUrl} from '../../../../lib/site.mjs';
import {PaginaNoEncontrada} from '../../../../components/sitio/shell/no-encontrada';
import {idiomaActual} from '../../../../components/sitio/shell/idioma-actual';

export const metadata: Metadata = {metadataBase: new URL(landingUrl()), title: {absolute: 'Página no encontrada | Rovaq AI'}, robots: {index: false, follow: true}};

export default function NoEncontrada() {
  return <PaginaNoEncontrada lang={idiomaActual()} />;
}
