'use client';
import {useId, useState} from 'react';
import {IDIOMAS, traductor, type Idioma, type Traductor} from '../../lib/i18n';
import {useIdioma, useT} from './proveedor';
import {motivoEtiqueta, submotivoEtiqueta} from '../../lib/legibilidad/motivos';

/** Idioma de un documento que se envía a un TERCERO (paquete de evidencia, reclamo, borradores): arranca en el idioma de la sesión y la persona puede cambiarlo sin tocar el de la pantalla. */
export function useIdiomaDocumento(): [Idioma, (i: Idioma) => void] {
  const sesion = useIdioma();
  const [elegido, setElegido] = useState<Idioma | null>(null);
  return [elegido ?? sesion, setElegido];
}
/** Selector sencillo (lista nativa, accesible por teclado) del idioma del documento. */
export function SelectorIdiomaDocumento({valor, onChange, compacto = false}: {valor: Idioma; onChange: (i: Idioma) => void; compacto?: boolean}) {
  const t = useT(), id = useId();
  return <div className="idioma-documento" style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
    <label htmlFor={id} className={compacto ? 'sr-only' : undefined} style={compacto ? undefined : {fontSize: 12.5}}>{t('tr.doc.idioma')}</label>
    <select id={id} value={valor} onChange={e => onChange(e.target.value as Idioma)} aria-describedby={id + '-n'} style={{minHeight: 32}}>
      {IDIOMAS.map(i => <option key={i} value={i} lang={i}>{t(i === 'es' ? 'idioma.es' : 'idioma.en')}</option>)}
    </select>
    <span id={id + '-n'} className="sr-only">{t('tr.doc.nota')}</span>
  </div>;
}
/** Funciones que rotulan los motivos del Tracker (datos guardados en español) en el idioma del DOCUMENTO. En español no hace falta: el documento sale tal cual. */
export function rotulosDeDocumento(idioma: Idioma): {motivo?: (r: string) => string; submotivo?: (r: string) => string} {
  if (idioma !== 'en') return {};
  const t: Traductor = traductor(idioma);
  return {motivo: r => motivoEtiqueta(r, t as never), submotivo: r => submotivoEtiqueta(r, t as never)};
}
