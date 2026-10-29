// Script de datos estructurados de una página (T2). Es el único script propio en línea que la política del sitio permite: un bloque ld+json no se ejecuta.
import type {IdiomaSitio} from '../../../lib/sitio/metadatos.mjs';
import {jsonLdDe} from './metadatos';

export function JsonLd({id, lang}: {id: string; lang: IdiomaSitio}) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLdDe(id, lang)}} />;
}
