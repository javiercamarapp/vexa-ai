// Herramientas del Copiloto de plataforma (solo lectura, solo administradores de plataforma verificados en servidor).
// Leen la vista agregada de plataforma (ctx.data.view()): conteos, estados y gasto por organización. NUNCA mensajes, correos ni texto
// de clientes; los nombres de organización (texto no confiable) pasan por sanitizeText antes de salir.
import {EXPECTED_SOURCES, HEALTH} from '../platform-model.mjs';
import {pct} from '../format.mjs';
import {sanitizeText} from './guards.mjs';

const cite = (label, href) => ({label, href, kind: 'pantalla'});
const C = {
  resumen: cite('Plataforma · Resumen', '/platform'), orgs: cite('Plataforma · Organizaciones', '/platform/organizaciones'), fuentes: cite('Plataforma · Fuentes y cargas', '/platform/fuentes'),
  procesos: cite('Plataforma · Procesos', '/platform/procesos'), costos: cite('Plataforma · Costos de IA', '/platform/costos-ia'), alertas: cite('Plataforma · Alertas', '/platform/alertas'), auditoria: cite('Plataforma · Auditoría', '/platform/auditoria'),
};
const name = o => sanitizeText(o.name, 80);
const fig = (id, label, display, kind = 'observed', scope = null) => ({id, label, display, kind, scope, coverage: {label: ''}});
async function view(ctx) {
  const result = await ctx.data.view();
  return result?.status === 'ok' ? result.view : null;
}
const unavailable = (citation = C.resumen) => ({noData: true, summary: 'No tengo el dato: la consola de plataforma aún no puede leer esa fuente (falta aplicar la función de observabilidad o hubo un tiempo de espera).', figures: [], citations: [citation]});
const findOrg = (v, id) => v.organizations.find(o => o.id === id);

export const PLATFORM_TOOLS = [
  {name: 'organizaciones', label: 'Leyendo las organizaciones', scope: 'platform', description: 'Lista de organizaciones con salud, miembros y asientos del ledger. Filtra por salud («attention» incluye las críticas).',
    input: {props: {health: {type: 'enum', values: ['healthy', 'attention', 'critical']}}},
    async run(args, ctx) {
      const v = await view(ctx); if (!v) return unavailable(C.orgs);
      const list = v.organizations.filter(o => !args.health || (args.health === 'attention' ? o.health.level !== 'healthy' : o.health.level === args.health));
      const figs = list.map(o => fig('org:' + o.id, name(o), `${o.health.label} · ${o.members.total} miembro(s) · ${o.ledger.rows} asientos`, 'observed', 'organización'));
      return {summary: `${list.length} organización(es)${args.health ? ' con salud «' + (args.health === 'attention' ? 'Requiere atención o crítica' : HEALTH[args.health]) + '»' : ''}:\n` + figs.map(f => `${f.label}: ${f.display}`).join('\n'), figures: figs, citations: [C.orgs]};
    }},
  {name: 'salud_organizacion', label: 'Revisando la salud de la organización', scope: 'platform', description: 'Motivos de salud, procesos, importaciones y fuentes de UNA organización (por id).',
    input: {props: {organizationId: {type: 'uuid', required: true}}},
    async run(args, ctx) {
      const v = await view(ctx); if (!v) return unavailable(C.orgs);
      const o = findOrg(v, args.organizationId);
      if (!o) return {noData: true, summary: 'No tengo el dato: esa organización no existe.', figures: [], citations: [C.orgs]};
      const reasons = o.health.reasons.map(r => r.text);
      const figs = [fig('h:' + o.id, name(o), o.health.label, 'observed', 'salud'), fig('h:jobs:' + o.id, 'Procesos fallidos', String(o.jobs.failed), 'observed', name(o)), fig('h:imp:' + o.id, 'Importaciones fallidas', String(o.imports.failed), 'observed', name(o)), fig('h:src:' + o.id, 'Fuentes cargadas', `${o.sourcesLoaded} de ${o.sourcesExpected}`, 'observed', name(o))];
      return {summary: `${name(o)}: ${o.health.label}.${reasons.length ? ' Motivos: ' + reasons.join('; ') + '.' : ' Sin motivos de atención.'} Fuentes cargadas: ${o.sourcesLoaded} de ${o.sourcesExpected}.`, figures: figs, citations: [C.orgs, C.fuentes]};
    }},
  {name: 'cobertura_fuentes', label: 'Midiendo la cobertura de las fuentes', scope: 'platform', description: 'Cobertura por fuente (imports, Tracker, adjuntos, ledger, asociaciones), de una organización o de todas.',
    input: {props: {organizationId: {type: 'uuid'}}},
    async run(args, ctx) {
      const v = await view(ctx); if (!v) return unavailable(C.fuentes);
      const orgs = args.organizationId ? v.organizations.filter(o => o.id === args.organizationId) : v.organizations;
      if (!orgs.length) return {noData: true, summary: 'No tengo el dato: esa organización no existe.', figures: [], citations: [C.fuentes]};
      const figs = orgs.flatMap(o => EXPECTED_SOURCES.map(s => { const c = o.sources[s.key]; return fig(`src:${o.id}:${s.key}`, `${name(o)} · ${s.label}`, c?.loaded ? `${c.incorporated} de ${c.total} (${pct(c.total ? Math.round(c.incorporated * 10000 / c.total) : null)}), ${c.rejected} rechazados, ${c.pending} pendientes` : 'Sin cargar', 'observed', 'cobertura'); }));
      return {summary: 'Cobertura por fuente (una fuente sin cargar no es cero cargado):\n' + figs.map(f => `${f.label}: ${f.display}`).join('\n'), figures: figs, citations: [C.fuentes]};
    }},
  {name: 'procesos', label: 'Revisando procesos y colas', scope: 'platform', description: 'Procesos en segundo plano: en cola, en curso, fallidos y atascados. Solo lectura.',
    input: {props: {state: {type: 'enum', values: ['failed', 'stuck', 'queued', 'running']}}},
    async run(args, ctx) {
      const v = await view(ctx); if (!v) return unavailable(C.procesos);
      const t = v.jobs.totals, failed = v.jobs.failed.filter(j => args.state === 'failed' ? j.state === 'failed' : args.state === 'stuck' ? j.stuck : true);
      const figs = [fig('j:queued', 'En cola', String(t.queued)), fig('j:running', 'En curso', String(t.running)), fig('j:failed', 'Fallidos', String(t.failed)), fig('j:stuck', 'Atascados', String(t.stuck)),
        ...failed.slice(0, 10).map(j => fig('j:' + j.id, `${j.type} · ${sanitizeText(j.organization, 60)}`, `${j.state}${j.errorCode ? ' (' + j.errorCode + ')' : ''}, ${j.attempts} intento(s)`, 'observed', 'proceso'))];
      return {summary: `Procesos: ${t.queued} en cola, ${t.running} en curso, ${t.failed} fallidos, ${t.stuck} atascados.\n` + figs.slice(4).map(f => `${f.label}: ${f.display}`).join('\n'), figures: figs, citations: [C.procesos]};
    }},
  {name: 'costos_ia', label: 'Leyendo los costos de IA', scope: 'platform', description: 'Gasto de IA del mes por organización contra su tope, con proyección Estimada.',
    input: {props: {}},
    async run(_args, ctx) {
      const v = await view(ctx); if (!v) return unavailable(C.costos);
      const figs = v.aiCosts.map(c => fig('ai:' + c.id, name(c), `${c.spent} de ${c.limit}${c.pctBps === null ? '' : ' (' + pct(c.pctBps) + ')'}`, 'observed', 'gasto del mes'));
      const proj = v.aiCosts.filter(c => c.projected.overLimit).map(c => fig('ai-proj:' + c.id, `${name(c)} · proyección`, '≈ ' + c.projected.display, 'estimated', 'fin de mes'));
      return {summary: `Gasto de IA del mes (Observado): total ${v.kpis.aiSpent} de ${v.kpis.aiLimit}.\n` + figs.map(f => `${f.label}: ${f.display}`).join('\n') + (proj.length ? '\nProyección al cierre que superaría el tope (ESTIMADO):\n' + proj.map(f => `${f.label}: ${f.display}`).join('\n') : ''), figures: [...figs, ...proj], citations: [C.costos]};
    }},
  {name: 'alertas_operativas', label: 'Revisando alertas operativas', scope: 'platform', description: 'Alertas de plataforma (procesos, topes de IA, statement_timeout, crons, disco).',
    input: {props: {severity: {type: 'enum', values: ['alta', 'media', 'info']}}},
    async run(args, ctx) {
      const v = await view(ctx); if (!v) return unavailable(C.alertas);
      const list = v.alerts.filter(a => !args.severity || a.severity === args.severity);
      if (!list.length) return {noData: true, summary: 'No hay alertas con ese filtro.', figures: [], citations: [C.alertas]};
      const figs = list.map(a => fig(a.id, sanitizeText(a.title, 120), a.organization ? sanitizeText(a.organization, 80) : (a.detail ? sanitizeText(a.detail, 160) : a.source), a.kind === 'unclassified' ? 'unclassified' : 'observed', a.severity));
      return {summary: 'Alertas:\n' + list.map(a => `[${a.severity}] ${sanitizeText(a.title, 120)}${a.organization ? ' · ' + sanitizeText(a.organization, 80) : ''}${a.unknown ? ' (sin fuente conectada)' : ''}`).join('\n'), figures: figs, citations: [C.alertas]};
    }},
  {name: 'bitacora', label: 'Leyendo la bitácora de auditoría', scope: 'platform', description: 'Últimas operaciones administrativas registradas (quién, qué, cuándo; sin contenido).',
    input: {props: {limit: {type: 'int', min: 1, max: 25}}},
    async run(args, ctx) {
      const v = await view(ctx); if (!v) return unavailable(C.auditoria);
      const list = v.audit.slice(0, args.limit ?? 10), orgName = id => (id ? sanitizeText(v.organizations.find(o => o.id === id)?.name ?? 'organización desconocida', 60) : 'plataforma');
      const figs = list.map(a => fig('audit:' + a.id, `${sanitizeText(a.operation, 30)} · ${orgName(a.tenantId)}`, a.createdAt.slice(0, 16).replace('T', ' ') + ' UTC', 'observed', 'auditoría'));
      return {summary: `Últimas ${list.length} operaciones:\n` + figs.map(f => `${f.label}: ${f.display}`).join('\n'), figures: figs, citations: [C.auditoria]};
    }},
  {name: 'miembros_resumen', label: 'Contando miembros e invitaciones', scope: 'platform', description: 'Conteo de miembros por rol e invitaciones de una organización. Sin correos.',
    input: {props: {organizationId: {type: 'uuid', required: true}}},
    async run(args, ctx) {
      const v = await view(ctx); if (!v) return unavailable(C.orgs);
      const o = findOrg(v, args.organizationId);
      if (!o) return {noData: true, summary: 'No tengo el dato: esa organización no existe.', figures: [], citations: [C.orgs]};
      const m = o.members, figs = [fig('m:total:' + o.id, 'Miembros activos', String(m.total), 'observed', name(o)), fig('m:inv:' + o.id, 'Invitaciones pendientes', String(o.invitationsPending), 'observed', name(o))];
      return {summary: `${name(o)}: ${m.total} miembro(s) (${m.owner} propietario, ${m.analyst} analista, ${m.operator} operador, ${m.viewer} lector) y ${o.invitationsPending} invitación(es) pendiente(s).`, figures: figs, citations: [C.orgs]};
    }},
];

export const PLATFORM_SHORTCUTS = {
  suggestions: ['¿Qué organizaciones requieren atención?', '¿Hay procesos fallidos?', '¿Cómo va el gasto de IA contra el tope?', '¿Qué alertas operativas hay?', '¿Qué fuentes faltan por cargar?'],
  categories: [
    {title: 'Organizaciones', questions: ['¿Qué organizaciones requieren atención?', '¿Cómo está la cobertura de fuentes?']},
    {title: 'Operación', questions: ['¿Hay procesos fallidos?', '¿Qué alertas operativas hay?', '¿Qué se hizo últimamente en la bitácora?']},
    {title: 'Costos', questions: ['¿Cómo va el gasto de IA contra el tope?']},
  ],
  direct: {
    '¿Qué organizaciones requieren atención?': {tool: 'organizaciones', args: {health: 'attention'}},
    '¿Cómo está la cobertura de fuentes?': {tool: 'cobertura_fuentes', args: {}},
    '¿Hay procesos fallidos?': {tool: 'procesos', args: {state: 'failed'}},
    '¿Qué alertas operativas hay?': {tool: 'alertas_operativas', args: {}},
    '¿Qué se hizo últimamente en la bitácora?': {tool: 'bitacora', args: {limit: 10}},
    '¿Cómo va el gasto de IA contra el tope?': {tool: 'costos_ia', args: {}},
    '¿Qué fuentes faltan por cargar?': {tool: 'cobertura_fuentes', args: {}},
  },
};
