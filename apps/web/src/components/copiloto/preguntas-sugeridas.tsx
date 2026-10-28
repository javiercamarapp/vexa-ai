'use client';
import {useT} from '../i18n/proveedor';
import type {Tema} from '../../lib/copiloto/modos.mjs';
/** Chips por tema (como los del cajón del Copiloto) y «lo que podría ayudarte»: siguientes mejores preguntas calculadas por reglas a partir del briefing. */
export function PreguntasSugeridas({temas, siguientes, ask}: {temas: readonly Tema[]; siguientes: {pregunta: string; motivo: string}[]; ask: (q: string) => void}) {
  const t = useT();
  return <section className="cn-preguntas" aria-label={t('cop.preguntasSug')}>
    {siguientes.length > 0 && <div className="cn-tema cn-tema-ayuda"><h2 className="cn-tema-t">{t('cop.ayudarte')}</h2><div className="cn-chips" role="group" aria-label={t('cop.siguientes')}>{siguientes.map(s => <button type="button" key={s.pregunta} className="cn-chip cn-chip-ayuda" title={s.motivo} onClick={() => ask(s.pregunta)}>{s.pregunta}<small>{s.motivo}</small></button>)}</div></div>}
    {temas.map(tm => <div key={tm.titulo} className="cn-tema"><h2 className="cn-tema-t">{tm.titulo}</h2><div className="cn-chips" role="group" aria-label={tm.titulo}>{tm.preguntas.map(q => <button type="button" key={q} className="cn-chip" onClick={() => ask(q)}>{q}</button>)}</div></div>)}
  </section>;
}
