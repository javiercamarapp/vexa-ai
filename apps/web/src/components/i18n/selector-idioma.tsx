'use client';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';
import {IDIOMAS, guardarIdiomaEnNavegador, type Idioma} from '../../lib/i18n';
import {useIdioma, useT} from './proveedor';
import './selector-idioma.css';
/** Selector ES / EN del encabezado. Fija la cookie rovaq_lang (SameSite=Lax, sin datos personales) y refresca para que el servidor renderice en el idioma elegido. */
export function SelectorIdioma() {
  const actual = useIdioma(), t = useT(), router = useRouter(), [pendiente, iniciar] = useTransition();
  function elegir(idioma: Idioma) {
    if (idioma === actual) return;
    guardarIdiomaEnNavegador(idioma);
    iniciar(() => router.refresh());
  }
  return <div className="idioma-selector" role="group" aria-label={t('idioma.etiqueta')} aria-busy={pendiente || undefined}>
    {IDIOMAS.map((i, n) => <span key={i} className="idioma-celda">
      {n > 0 && <span className="idioma-sep" aria-hidden="true">/</span>}
      <button type="button" lang={i} className="idioma-boton" aria-pressed={i === actual} aria-label={t('idioma.cambiar', {idioma: t(i === 'es' ? 'idioma.es' : 'idioma.en')})} title={t(i === 'es' ? 'idioma.es' : 'idioma.en')} onClick={() => elegir(i)}>{i.toUpperCase()}</button>
    </span>)}
  </div>;
}
