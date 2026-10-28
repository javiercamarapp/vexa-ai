'use client';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useJson} from '../ui/use-json';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import {useAcceso} from '../workspace/access';
import {Refresh} from '../ui/button';
import {CtlLink} from '../agente/ctl';
import {RovaqCargando} from '../rovaq-cargando';
import {Chat, type ModoChat} from '../agente/agente';
import {Icon} from '../agente/icons';
import {TemasRapidos} from '../agente/sugerencias';
import {RovaqWordmark} from '../agente/rovaq-mark';
import {runTurn, failAnswerOf, type Runner} from '../agente/use-agente';
import {LIMITS} from '../../../../../packages/agent-datos/contract.mjs';
import type {AgentState} from '../agente/types';
import {CFO_TOOLS} from '../../../../../packages/cfo-copilot/src/client.mjs';
import type {CfoReport} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {FugaPantalla} from '../refunds/fuga-pantalla';
import {MODOS, puedeUsarModo} from '../../lib/copiloto/modos.mjs';
import {AreaRestringida} from './area-restringida';
import {AccionesCfo, BriefingCfoUna} from './briefing-cfo-una';
import {Ctl} from '../agente/ctl';
import {ContenedorErrores} from './contenedor-errores';
import {briefingCfo, monedaElegida, parametrosConMoneda} from './briefing-cfo.mjs';
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
  const t = useT();
  if (p === null) return <p className="sr-only" aria-live="polite">{t('cop.verificandoPres')}</p>;
  if (p === 'error') return <p className="cn-uso" role="alert">{t('cop.presError')}</p>;
  const pct = Math.min(100, Math.round((p.pctBps ?? 0) / 100));
  return <p className="cn-uso">{t('cop.usoMes')} <strong>{usd(p.spent)}</strong> {t('cop.usoDe')} {usd(p.cap)}<span className="cn-uso-barra" role="img" aria-label={t('cop.presUsado', {pct})}><span style={{width: pct + '%'}} /></span>{p.exhausted && <span role="status">{t('cop.presAgotado')}</span>}</p>;
}

/** «Modo copiloto»: el shell de «Pregúntale a tus datos» con un briefing estructurado del área como primer bloque. Ver docs/COPILOTO-NEGOCIO.md. */
export function CopilotoNegocio({modo: clave, organization, roleOverride, query = ''}: {modo: keyof typeof MODOS | string; organization?: string; roleOverride?: string; query?: string}) {
  const t = useT(), modo = MODOS[clave as keyof typeof MODOS], tituloModo = (['cfo', 'refunds', 'general'].includes(modo.clave) ? t(('cop.modo.' + modo.clave) as Clave) : modo.titulo), {role} = useAcceso(), permitido = puedeUsarModo(modo, roleOverride ?? role);
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
  const cambiaMoneda = useCallback((m: string) => { router.replace(pathname + '?' + parametrosConMoneda(sp?.toString(), m), {scroll: false}); }, [sp, router, pathname]);
  useEffect(() => { // Escape vuelve al chat desde el informe abierto (sin pisar el Escape de un menú o diálogo abierto)
    if (!verInforme) return;
    const alEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open], .popover-panel')) setVerInforme(false); };
    document.addEventListener('keydown', alEscape);
    return () => document.removeEventListener('keydown', alEscape);
  }, [verInforme]);
  const hrefInforme = useCallback((ancla?: string) => { const p = new URLSearchParams(sp?.toString() ?? ''); p.set('vista', 'informe'); return (modo.ruta) + '?' + p.toString() + (ancla ? '#' + ancla : ''); }, [sp, modo.ruta]);

  const sugerenciasCfo = useMemo(() => modo.chipsPorTema.flatMap(t => [...t.preguntas]).slice(0, 3), [modo]);
  const runner: Runner | undefined = useMemo(() => !esCfo ? undefined : async (body, signal, onEvent) => {
    const delegar = async () => { // no es una pregunta de CFO: la contesta el agente general y el modo queda en el historial de este chat
      const a = await runTurn({...body, directa: undefined}, signal, onEvent);
      return {...a, notes: [...(a.notes ?? []), t('cop.notaDelegada')]};
    };
    if (!body.directa && !esPreguntaDeCfo(body.question)) return delegar();
    let res: Response;
    try { res = await fetch(modo.endpointDeConsulta + query, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(cuerpoConsultaCfo({question: body.question, history: body.history, directa: body.directa})), signal, cache: 'no-store'}); }
    catch (e) { if (signal.aborted) throw e; return failAnswerOf('unavailable', ''); }
    if (res.status === 401 || res.status === 403) return failAnswerOf('forbidden', t('cop.soloPropAnalistas'));
    if (res.status === 429) return failAnswerOf('rate_limited', t('cop.muchas'));
    if (!res.ok) return failAnswerOf('unavailable', '');
    const reply = (await res.json())?.data; if (reply?.budget) setPresupuesto(reply.budget);
    if (esFueraDeCfo(reply)) return delegar();
    return adaptarRespuestaCfo(reply, {sugerencias: sugerenciasCfo, descripciones: DESCRIPCIONES_CFO});
  }, [esCfo, modo, query, sugerenciasCfo, t]);

  if (!permitido || estado.kind === 'sin_acceso' || sinAccesoMotor) return <AreaRestringida modo={modo} />;
  if (estado.kind === 'cargando') return <div className="copiloto copiloto-negocio" aria-busy="true"><div className="cn-espera"><RovaqCargando mensaje="" /></div></div>;
  if (estado.kind === 'error') return <div className="cn-gate" role="alert"><h1>{t('cop.errAbrir', {modo: tituloModo})}</h1><p>{t('cop.errAbrirCuerpo')}</p><Ctl variant="soft" icon={<Refresh />} onClick={() => { setEstado({kind: 'cargando'}); setIntento(n => n + 1); }}>{t('cop.reintentar')}</Ctl></div>;

  const base = estado.base, siguientes = brief?.siguientes ?? [];
  const directas = {...base.suggestions.directas, ...modo.directas, ...Object.fromEntries(siguientes.map(s => [s.pregunta, s.directa]))};
  const data: AgentState = {...base, scope: base.scope + '-' + modo.clave, toolLabels: esCfo ? {...base.toolLabels, ...ETIQUETAS_CFO} : base.toolLabels, limits: {...base.limits, maxQuestionChars: esCfo ? 600 : base.limits.maxQuestionChars, maxTurnsPerConversation: LIMITS.maxTurnsPerConversation},
    suggestions: {...base.suggestions, directas, categorias: modo.chipsPorTema.map(t => ({titulo: t.titulo, preguntas: [...t.preguntas]})), sugerencias: []}};
  const cuerpoBriefing = () => {
    if (modo.briefing === 'refunds') return <FugaPantalla embebido organization={organization} />;
    if (!esCfo) return null;
    if (!informe) return rep.error ? <div className="cn-estado" role="alert"><p>{rep.error}</p><Ctl variant="soft" icon={<Refresh />} onClick={() => void rep.reload()}>{t('cop.reintentar')}</Ctl></div> : <div className="una-esqueleto" role="status" aria-label={t('cop.preparando')}><span className="una-esq-kpis" /><span className="una-esq-panel" /></div>;
    if (informe.status !== 'ok') return <div className="cn-estado" role="status"><h2>{informe.status === 'timeout' ? t('cop.noDisponible') : t('cop.sinRegistros')}</h2><p>{informe.status === 'timeout' ? t('cop.timeoutCuerpo') : t('cop.vacioCuerpo')}</p>{informe.status === 'timeout' ? <Ctl variant="soft" icon={<Refresh />} disabled={rep.busy} onClick={() => void rep.reload()}>{t('cop.reintentar')}</Ctl> : <CtlLink href="/economics" variant="soft">{t('cop.irPreparar')}</CtlLink>}</div>;
    return brief ? <ContenedorErrores alFallar={null}><BriefingCfoUna b={brief} informe={hrefInforme} /></ContenedorErrores> : null;
  };
  // Estado honesto de la tarjeta del informe: nunca una cifra parcial ni un cero inventado mientras carga o falla.
  const tarjeta = (): {estado: string; texto: string; accion: 'abrir' | 'reintentar' | 'cargar' | null} => {
    if (rep.error) return {estado: 'error', texto: rep.error, accion: 'reintentar'};
    if (!informe) return {estado: 'cargando', texto: t('cop.preparandoInf'), accion: null};
    if (informe.status === 'timeout') return {estado: 'error', texto: t('cop.tarjetaTimeout'), accion: 'reintentar'};
    if (informe.status === 'empty') return {estado: 'vacio', texto: t('cop.tarjetaVacio'), accion: 'cargar'};
    return brief ? {estado: 'listo', texto: brief.titular.texto, accion: 'abrir'} : {estado: 'cargando', texto: t('cop.preparandoInf'), accion: null};
  };
  const chat: ModoChat = {
    modo: modo.clave, runner, placeholder: esCfo ? t('cop.phCfo') : modo.clave === 'refunds' ? t('cop.phRefunds') : undefined, etiquetaChat: t('cop.etiquetaChat', {modo: tituloModo}),
    cabecera: !esCfo ? undefined : hayHilo => hayHilo || verInforme ? <>
      <h1 className="una-h1">{tituloModo}</h1>
      {verInforme
        ? <Ctl variant="soft" className="una-toggle una-volver" icon={<Icon name="back" size={16} />} aria-expanded onClick={() => setVerInforme(false)}>{t('cop.volverChat')}</Ctl>
        : <Ctl variant="soft" className="una-toggle" aria-expanded={false} onClick={() => setVerInforme(true)}>{t('cop.verInformeDe', {modo: tituloModo})}</Ctl>}
      {verInforme && brief ? <AccionesCfo b={brief} informe={hrefInforme} onMoneda={cambiaMoneda} sintetico={informe?.status === 'ok' && informe.synthetic} /> : null}
    </> : null,
    portada: (ask, hayHilo) => {
      const cuerpo = cuerpoBriefing();
      const resumen = <ContenedorErrores alFallar={null}>{cuerpo}</ContenedorErrores>;
      if (!esCfo) {
        if (hayHilo) return <div className="cn-portada" data-hilo={true}>
          <Ctl className="cn-colapsa" aria-expanded={verInforme} onClick={() => setVerInforme(v => !v)}>{verInforme ? t('cop.ocultarInforme', {modo: tituloModo}) : t('cop.mostrarInforme', {modo: tituloModo})}</Ctl>
          <div hidden={!verInforme}>{resumen}</div>
        </div>;
        return <div className="cn-portada" data-hilo={false}>{resumen}<PreguntasSugeridas temas={modo.chipsPorTema} siguientes={siguientes} ask={ask} /></div>;
      }
      // CFO en una sola pantalla: el informe vive arriba (KPI en una fila + pestañas) y el chat queda anclado abajo; con un hilo abierto el informe se despliega a demanda.
      if (hayHilo) return <div className="cn-portada cn-una" data-hilo={true}><div hidden={!verInforme} className="cn-una-cuerpo">{resumen}</div></div>;
      if (verInforme) return <div className="cn-portada cn-una" data-hilo={false}><div className="cn-una-cuerpo">{resumen}</div></div>;
      // Portada limpia, igual que Pregúntale: wordmark, título, compositor y chips por tema; el informe es una tarjeta plegada que se abre a demanda.
      const tj = tarjeta();
      return <>
        <header className="agente-hero">
          <RovaqWordmark size={36} />
          <h1>{tituloModo}</h1>
          <p className="agente-sub">{t('cop.hero')}</p>
        </header>
        <TemasRapidos temas={modo.chipsPorTema} ask={ask} />
        <section className="cn-tarjeta" aria-label={t('cop.informeDe', {modo: tituloModo})} data-estado={tj.estado}>
          <div className="cn-tarjeta-t" role={tj.estado === 'cargando' ? 'status' : undefined}><b>{t('cop.informeDe', {modo: tituloModo})}</b><span title={tj.texto}>{tj.texto}</span></div>
          {tj.accion === 'abrir' && <Ctl variant="soft" aria-expanded={false} onClick={() => setVerInforme(true)}>{t('cop.abrir')}</Ctl>}
          {tj.accion === 'reintentar' && <Ctl variant="soft" icon={<Refresh />} disabled={rep.busy} onClick={() => void rep.reload()}>{t('cop.reintentar')}</Ctl>}
          {tj.accion === 'cargar' && <CtlLink href="/economics" variant="soft">{t('cop.irDinero')}</CtlLink>}
        </section>
      </>;
    },
    pie: esCfo && modo.presupuesto.mostrar ? <UsoDelMes p={presupuesto} /> : undefined,
  };
  return <Chat data={data} modo={chat} />;
}
