'use client';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useJson} from '../ui/use-json';
import {useAcceso} from '../workspace/access';
import {Button, LinkButton, Refresh} from '../ui/button';
import {RovaqCargando} from '../rovaq-cargando';
import {Chat, type ModoChat} from '../agente/agente';
import {runTurn, failAnswerOf, type Runner} from '../agente/use-agente';
import {LIMITS} from '../../../../../packages/agent-datos/contract.mjs';
import type {AgentState} from '../agente/types';
import {CFO_TOOLS} from '../../../../../packages/cfo-copilot/src/client.mjs';
import type {CfoReport} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {FugaPantalla} from '../refunds/fuga-pantalla';
import {MODOS, puedeUsarModo} from '../../lib/copiloto/modos.mjs';
import {AreaRestringida} from './area-restringida';
import {BriefingCfoView} from './briefing-cfo-view';
import {ContenedorErrores} from './contenedor-errores';
import {RovaqWordmark} from '../agente/rovaq-mark';
import {briefingCfo, monedaElegida} from './briefing-cfo.mjs';
import {adaptarRespuestaCfo, cuerpoConsultaCfo, esFueraDeCfo, esPreguntaDeCfo} from './adaptador-cfo.mjs';
import {PreguntasSugeridas} from './preguntas-sugeridas';
import './copiloto.css';

type Informe = {status: 'ok'; report: CfoReport; synthetic: boolean} | {status: 'empty' | 'timeout'; synthetic?: boolean};
const acepta = (j: unknown): Informe | null => { const d = (j as {data?: Informe})?.data; return d && (d.status === 'ok' || d.status === 'empty' || d.status === 'timeout') ? d : null; };
type Presupuesto = {spent: string; cap: string; pctBps: number | null; exhausted: boolean};
const usd = (micro: string) => 'US$ ' + new Intl.NumberFormat('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(BigInt(micro) / 10000n) / 100);
const ETIQUETAS_CFO = Object.fromEntries(CFO_TOOLS.map((t: {name: string; label: string}) => [t.name, t.label]));
const DESCRIPCIONES_CFO = Object.fromEntries(CFO_TOOLS.map((t: {name: string; description: string}) => [t.name, t.description]));
type Estado = {kind: 'cargando'} | {kind: 'error'} | {kind: 'sin_acceso'} | {kind: 'listo'; base: AgentState};

/** Pie discreto del compositor: gasto del mes frente al tope (mismo presupuesto y bitácora fail-closed del motor de CFO). */
function UsoDelMes({p}: {p: Presupuesto | 'error' | null}) {
  if (p === null) return <p className="cn-uso" aria-live="polite">Verificando el presupuesto de IA…</p>;
  if (p === 'error') return <p className="cn-uso" role="alert">No pude verificar el presupuesto de IA. Las consultas directas siguen disponibles.</p>;
  const pct = Math.min(100, Math.round((p.pctBps ?? 0) / 100));
  return <p className="cn-uso">Uso del mes: <strong>{usd(p.spent)}</strong> de {usd(p.cap)}<span className="cn-uso-barra" role="img" aria-label={`${pct} % del presupuesto usado`}><span style={{width: pct + '%'}} /></span>{p.exhausted && <span role="status"> Presupuesto agotado: solo consultas directas.</span>}</p>;
}

/** «Modo copiloto»: el shell de «Pregúntale a tus datos» con un briefing estructurado del área como primer bloque. Ver docs/COPILOTO-NEGOCIO.md. */
export function CopilotoNegocio({modo: clave, organization, roleOverride, query = ''}: {modo: keyof typeof MODOS | string; organization?: string; roleOverride?: string; query?: string}) {
  const modo = MODOS[clave as keyof typeof MODOS], {role} = useAcceso(), permitido = puedeUsarModo(modo, roleOverride ?? role);
  const pathname = usePathname(), router = useRouter(), sp = useSearchParams(), esCfo = modo.consulta === 'cfo';
  const [estado, setEstado] = useState<Estado>({kind: 'cargando'}), [intento, setIntento] = useState(0), [presupuesto, setPresupuesto] = useState<Presupuesto | 'error' | null>(null), [sinAccesoMotor, setSinAccesoMotor] = useState(false), [verInforme, setVerInforme] = useState(false);
  const rep = useJson<Informe>(permitido && esCfo && modo.endpointInforme ? modo.endpointInforme + query : null, acepta);

  useEffect(() => { // estado del agente general: alcance de la organización, rótulos de herramientas y límites (también sirve a las preguntas que se delegan)
    if (!permitido) return;
    const ctl = new AbortController();
    void (async () => {
      try {
        const r = await fetch('/api/agent/state', {cache: 'no-store', signal: ctl.signal});
        if (r.status === 401 || r.status === 403) { setEstado({kind: 'sin_acceso'}); return; }
        if (!r.ok) throw Error(String(r.status));
        const j = await r.json(); if (!j?.data?.suggestions) throw Error('forma');
        setEstado({kind: 'listo', base: j.data});
      } catch { if (!ctl.signal.aborted) setEstado({kind: 'error'}); }
    })();
    return () => ctl.abort();
  }, [permitido, intento]);
  useEffect(() => { // presupuesto del motor de CFO (GET no lee datos del negocio); un 403 es el mismo «solo propietarios y analistas»
    if (!permitido || !esCfo || !modo.presupuesto.mostrar) return;
    const ctl = new AbortController();
    fetch(modo.endpointDeConsulta + query, {cache: 'no-store', signal: ctl.signal}).then(r => { if (r.status === 403) { setSinAccesoMotor(true); return null; } return r.ok ? r.json() : Promise.reject(Error(String(r.status))); })
      .then(j => { if (j) setPresupuesto(j.data.budget); }).catch(() => { if (!ctl.signal.aborted) setPresupuesto('error'); });
    return () => ctl.abort();
  }, [permitido, esCfo, modo, query]);

  const informe = rep.data, moneda = informe?.status === 'ok' ? monedaElegida(informe.report, sp?.get('currency')) : null;
  const brief = useMemo(() => informe?.status === 'ok' && moneda ? briefingCfo(informe.report, moneda) : null, [informe, moneda]);
  const cambiaMoneda = useCallback((m: string) => { const p = new URLSearchParams(sp?.toString() ?? ''); p.set('currency', m); router.replace(pathname + '?' + p.toString(), {scroll: false}); }, [sp, router, pathname]);
  const hrefInforme = useCallback((ancla?: string) => { const p = new URLSearchParams(sp?.toString() ?? ''); p.set('vista', 'informe'); return (modo.ruta) + '?' + p.toString() + (ancla ? '#' + ancla : ''); }, [sp, modo.ruta]);

  const sugerenciasCfo = useMemo(() => modo.chipsPorTema.flatMap(t => [...t.preguntas]).slice(0, 3), [modo]);
  const runner: Runner | undefined = useMemo(() => !esCfo ? undefined : async (body, signal, onEvent) => {
    const delegar = async () => { // no es una pregunta de CFO: la contesta el agente general y el modo queda en el historial de este chat
      const a = await runTurn({...body, directa: undefined}, signal, onEvent);
      return {...a, notes: [...(a.notes ?? []), 'Esta pregunta no es de CFO: la respondió el agente general de datos.']};
    };
    if (!body.directa && !esPreguntaDeCfo(body.question)) return delegar();
    let res: Response;
    try { res = await fetch(modo.endpointDeConsulta + query, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(cuerpoConsultaCfo({question: body.question, history: body.history, directa: body.directa})), signal, cache: 'no-store'}); }
    catch (e) { if (signal.aborted) throw e; return failAnswerOf('unavailable', ''); }
    if (res.status === 401 || res.status === 403) return failAnswerOf('forbidden', 'Esta área es solo para propietarios y analistas.');
    if (res.status === 429) return failAnswerOf('rate_limited', 'Muchas preguntas seguidas. Espera un minuto.');
    if (!res.ok) return failAnswerOf('unavailable', '');
    const reply = (await res.json())?.data; if (reply?.budget) setPresupuesto(reply.budget);
    if (esFueraDeCfo(reply)) return delegar();
    return adaptarRespuestaCfo(reply, {sugerencias: sugerenciasCfo, descripciones: DESCRIPCIONES_CFO});
  }, [esCfo, modo, query, sugerenciasCfo]);

  if (!permitido || estado.kind === 'sin_acceso' || sinAccesoMotor) return <AreaRestringida modo={modo} />;
  if (estado.kind === 'cargando') return <div className="copiloto copiloto-negocio" aria-busy="true"><div className="cn-espera"><RovaqCargando mensaje="" /></div></div>;
  if (estado.kind === 'error') return <div className="cn-gate" role="alert"><h1>No se pudo abrir «{modo.titulo}»</h1><p>No pude verificar si la consulta está disponible. Revisa tu conexión e inténtalo de nuevo.</p><Button icon={<Refresh />} onClick={() => { setEstado({kind: 'cargando'}); setIntento(n => n + 1); }}>Reintentar</Button></div>;

  const base = estado.base, siguientes = brief?.siguientes ?? [];
  const directas = {...base.suggestions.directas, ...modo.directas, ...Object.fromEntries(siguientes.map(s => [s.pregunta, s.directa]))};
  const data: AgentState = {...base, scope: base.scope + '-' + modo.clave, toolLabels: esCfo ? {...base.toolLabels, ...ETIQUETAS_CFO} : base.toolLabels, limits: {...base.limits, maxQuestionChars: esCfo ? 600 : base.limits.maxQuestionChars, maxTurnsPerConversation: LIMITS.maxTurnsPerConversation},
    suggestions: {...base.suggestions, directas, categorias: modo.chipsPorTema.map(t => ({titulo: t.titulo, preguntas: [...t.preguntas]})), sugerencias: []}};
  const cuerpoBriefing = () => {
    if (modo.briefing === 'refunds') return <FugaPantalla embebido organization={organization} />;
    if (!esCfo) return null;
    if (!informe) return rep.error ? <div className="cn-estado" role="alert"><h1>CFO</h1><p>{rep.error}</p><Button size="sm" icon={<Refresh />} onClick={() => void rep.reload()}>Reintentar</Button></div> : <div className="cn-estado"><h1 className="sr-only">CFO</h1><RovaqCargando mensaje="Preparando el informe de CFO…" /></div>;
    if (informe.status !== 'ok') return <div className="cn-estado" role="status"><h1>{informe.status === 'timeout' ? 'No disponible ahora' : 'Aún no hay registros en el libro económico'}</h1><p>{informe.status === 'timeout' ? 'La consulta del libro económico superó el tiempo permitido. No se muestra ninguna cifra parcial como si fuera completa.' : 'No hay pedidos ni reembolsos registrados para esta organización en los últimos 12 meses. Carga una fuente para ver el informe.'}</p>{informe.status === 'timeout' ? <Button size="sm" icon={<Refresh />} loading={rep.busy} onClick={() => void rep.reload()}>Reintentar</Button> : <LinkButton href="/economics" size="sm">Ir a Dinero › Preparar</LinkButton>}</div>;
    return brief ? <ContenedorErrores alFallar={null}><BriefingCfoView b={brief} informe={hrefInforme} onMoneda={cambiaMoneda} sintetico={informe.synthetic} /></ContenedorErrores> : null;
  };
  const chat: ModoChat = {
    modo: modo.clave, runner, placeholder: esCfo ? 'Pregunta sobre tus ingresos, canales o reembolsos…' : modo.clave === 'refunds' ? 'Pregunta sobre tus reembolsos…' : undefined, etiquetaChat: `Conversación del copiloto: ${modo.titulo}`,
    portada: (ask, hayHilo) => {
      const cuerpo = cuerpoBriefing();
      const resumen = <ContenedorErrores alFallar={null}>{cuerpo}</ContenedorErrores>;
      if (hayHilo) return <div className="cn-portada" data-hilo={true}>
        <button type="button" className="cn-colapsa" aria-expanded={verInforme} onClick={() => setVerInforme(v => !v)}>{verInforme ? 'Ocultar' : 'Ver'} el informe de {modo.titulo}</button>
        <div hidden={!verInforme}>{resumen}</div>
      </div>;
      if (!esCfo) return <div className="cn-portada" data-hilo={false}>{resumen}<PreguntasSugeridas temas={modo.chipsPorTema} siguientes={siguientes} ask={ask} /></div>;
      // CFO: la misma portada que «Pregúntale a tus datos» (logo arriba, nombre debajo, tarjetas por tema con entrada animada); el resumen del mes es opcional.
      return <div className="cn-portada cn-hero-wrap" data-hilo={false}>
        <header className="agente-hero cn-hero"><RovaqWordmark size={36} /><h1>{modo.titulo}</h1><p className="agente-sub">{modo.subtitulo}</p></header>
        <div className="agente-cats cn-cats">{[...(siguientes.length ? [{titulo: 'Lo que podría ayudarte', preguntas: siguientes.map(x => x.pregunta)}] : []), ...modo.chipsPorTema.map(t => ({titulo: t.titulo, preguntas: [...t.preguntas]}))].map((c, i) => <section key={c.titulo} className="agente-cat cn-cat" style={{'--i': i} as React.CSSProperties} aria-label={c.titulo}><p className="agente-cat-title" role="heading" aria-level={2}>{c.titulo}</p><div className="agente-cat-list">{c.preguntas.map(q => <div key={q} className="agente-cat-q"><button type="button" className="agente-q" onClick={() => ask(q)}>{q}</button></div>)}</div></section>)}</div>
        {brief && <details className="cn-resumen-abre"><summary>Ver el resumen del mes</summary>{resumen}</details>}
      </div>;
    },
    pie: esCfo && modo.presupuesto.mostrar ? <UsoDelMes p={presupuesto} /> : undefined,
  };
  return <Chat data={data} modo={chat} />;
}
