// Puerto de datos: lo único que las herramientas pueden leer. Se construye en el servidor ya ATADO a un tenant y a la sesión RLS del
// usuario; ningún método recibe tenant, rol ni SQL. Hoy existen dos implementaciones: sintética (synthetic.mjs, pruebas y UI) y el
// adaptador al servicio del espacio de trabajo (abajo), que cubre lo que ya existe y declara «no conectado» lo que falta construir.
import { createProvenanceRepository } from '../workspace-service/provenance.mjs';
import { createTrendsRepository } from '../workspace-service/trends.mjs';

export const PORT_METHODS = Object.freeze(['coverage', 'trends', 'associations', 'tracker', 'problems', 'problemIncidents', 'categoryMonthly', 'exposure', 'ledgerBySource', 'evidence', 'problemCustomers']);
export function assertPort(port) {
  for (const m of PORT_METHODS) if (typeof port?.[m] !== 'function') throw new Error(`port_incomplete:${m}`);
  return port;
}

const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
export function parseAssociations(source) {
  if (!source?.loaded) return { status: 'empty' };
  const line = (source.detail ?? []).find((d) => /hechos \(resueltos/.test(d)); if (!line) return { status: 'empty' };
  const m = line.match(/([\d.,]+) hechos \(resueltos ([\d.,]+) · pendientes ([\d.,]+) · por revisar ([\d.,]+) · retenidos ([\d.,]+)\)/); if (!m) return { status: 'empty' };
  const links = (source.detail ?? []).map((d) => d.match(/([\d.,]+) vínculos activos/)).find(Boolean);
  return { status: 'ok', class: source.class, total: num(m[1]), resolved: num(m[2]), pending: num(m[3]), review: num(m[4]), held: num(m[5]), activeLinks: links ? num(links[1]) : 0, sampled: (source.detail ?? []).some((d) => /muestra/i.test(d)) };
}
export function parseTracker(source) {
  if (!source?.loaded || !source.sheets || !source.topVersion) return { status: 'empty' };
  const v = (source.detail ?? []).map((d) => d.match(/mayor rango de (\d+)/)).find(Boolean);
  return { status: 'ok', class: source.class, version: source.topVersion.label, rank: source.topVersion.rank, versions: v ? Number(v[1]) : source.topVersion.rank, sha: source.topVersion.sha, rows: source.incorporated, rejected: source.rejected, sheetsClosed: source.sheets.closed, sheetsTotal: source.sheets.total };
}

const notConnected = (name) => async () => ({ status: 'empty', reason: 'not_connected', method: name });

/** Adaptador real. `database` es el mismo puerto `createDatabase({identity,pool,selectedTenant})` que usan /api/coverage y /api/trends:
 *  cada lectura corre en una transacción de solo lectura bajo la RLS del usuario, con statement_timeout local. */
export function createWorkspacePort({ database, tenantId, now = () => new Date() }) {
  const provenance = createProvenanceRepository({ database }), trends = createTrendsRepository({ database, now });
  let cv; const coverage = () => (cv ??= provenance.coverage());
  return {
    tenantId, now,
    coverage, trends: () => trends.monthly(),
    associations: async () => parseAssociations((await coverage()).sources.find((s) => s.key === 'associations')),
    tracker: async () => parseTracker((await coverage()).sources.find((s) => s.key === 'excel')),
    // Pendientes de construir (ver INFORME-AGENTE-DATOS.md): requieren consultas acotadas nuevas sobre issues/problems/problem_conversations,
    // economic_problem_links y economic_ledger_entries por fuente. Mientras tanto el agente responde «no tengo ese dato».
    problems: notConnected('problems'), problemIncidents: notConnected('problemIncidents'), categoryMonthly: notConnected('categoryMonthly'),
    exposure: notConnected('exposure'), ledgerBySource: notConnected('ledgerBySource'), evidence: notConnected('evidence'), problemCustomers: notConnected('problemCustomers'),
  };
}
