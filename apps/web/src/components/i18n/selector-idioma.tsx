'use client';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';
import {IDIOMAS, guardarIdiomaEnNavegador, type Idioma} from '../../lib/i18n';
import {useIdioma, useT} from './proveedor';
import {Bandera} from './banderas';
import './selector-idioma.css';
/** Selector ES / EN del encabezado: la misma píldora segmentada que el selector de tema (dos celdas, la elegida resaltada). Fija la cookie rovaq_lang (SameSite=Lax, sin datos personales) y refresca para que el servidor renderice en el idioma elegido. */
export function SelectorIdioma() {
  const actual = useIdioma(), t = useT(), router = useRouter(), [pendiente, iniciar] = useTransition();
  function elegir(idioma: Idioma) {
    if (idioma === actual) return;
    guardarIdiomaEnNavegador(idioma);
    iniciar(() => router.refresh());
  }
  return <fieldset className="idioma-selector" aria-busy={pendiente || undefined}>
    <legend className="sr-only">{t('idioma.etiqueta')}</legend>
    {IDIOMAS.map(i => <label key={i} lang={i} title={t(i === 'es' ? 'idioma.es' : 'idioma.en')}>
      <input type="radio" className="sr-only" name="idioma" value={i} checked={i === actual} aria-label={t('idioma.cambiar', {idioma: t(i === 'es' ? 'idioma.es' : 'idioma.en')})} onChange={() => elegir(i)} />
      <Bandera idioma={i} /><span aria-hidden="true">{i.toUpperCase()}</span>
    </label>)}
  </fieldset>;
}
