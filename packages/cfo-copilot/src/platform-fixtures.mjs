// Instantánea SINTÉTICA de plataforma (forma del contrato `platform_observe`). Ninguna organización, persona ni cifra es real.
export const PLATFORM_NOW = '2026-10-20T14:00:00.000Z';
const id = n => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const src = (loaded, total, incorporated, rejected, pending, lastUpdate) => ({loaded, total, incorporated, rejected, pending, lastUpdate});
const none = () => src(false, 0, 0, 0, 0, null);
export const PLATFORM_ORGS = Object.freeze({
  mercado: id(1), norte: id(2), aurora: id(3), pixel: id(4), cedro: id(5), ensayo: id(6),
});
export function platformFixture() {
  return {
    generatedAt: PLATFORM_NOW,
    organizations: [
      {id: id(1), name: 'Comercializadora Mercado (demo sintética)', createdAt: '2026-08-14T16:20:00.000Z', members: {owner: 1, analyst: 2, operator: 1, viewer: 1, total: 5}, invitationsPending: 1, invitationsExpired: 0, lastActivityAt: '2026-10-20T13:41:00.000Z',
        ledger: {rows: 85361}, imports: {total: 31, open: 1, failed: 2, lastAt: '2026-10-19T22:10:00.000Z'}, jobs: {queued: 3, running: 1, partial: 1, failed: 2, stuck: 0, succeeded24h: 58, failed24h: 1},
        sources: {hubspot: src(true, 18250, 18102, 148, 0, '2026-10-19T21:00:00.000Z'), associations: src(true, 9120, 8407, 0, 713, '2026-10-19T21:05:00.000Z'), csv: src(true, 61200, 60980, 220, 0, '2026-10-18T10:30:00.000Z'), ledger: src(true, 85361, 85361, 0, 0, '2026-10-05T00:00:00.000Z'), excel: src(true, 4120, 3960, 160, 0, '2026-10-12T09:00:00.000Z'), attachments: src(true, 2240, 2101, 139, 0, '2026-10-17T17:45:00.000Z'), zendesk: none()},
        ai: {spentMicro: '61840000', limitMicro: '100000000', window: '2026-10', uncertain: 0}},
      {id: id(2), name: 'Distribuidora Norte (demo sintética)', createdAt: '2026-07-02T09:00:00.000Z', members: {owner: 1, analyst: 1, operator: 0, viewer: 0, total: 2}, invitationsPending: 0, invitationsExpired: 1, lastActivityAt: '2026-10-19T18:02:00.000Z',
        ledger: {rows: 12408}, imports: {total: 9, open: 0, failed: 0, lastAt: '2026-10-15T12:00:00.000Z'}, jobs: {queued: 0, running: 0, partial: 0, failed: 0, stuck: 0, succeeded24h: 12, failed24h: 0},
        sources: {hubspot: none(), associations: none(), csv: src(true, 8800, 8800, 0, 0, '2026-10-15T12:00:00.000Z'), ledger: src(true, 12408, 12408, 0, 0, '2026-10-14T00:00:00.000Z'), excel: none(), attachments: none(), zendesk: src(true, 5400, 5311, 89, 0, '2026-10-19T04:00:00.000Z')},
        ai: {spentMicro: '8120000', limitMicro: '50000000', window: '2026-10', uncertain: 0}},
      {id: id(3), name: 'Aurora Hogar (demo sintética)', createdAt: '2026-09-01T15:10:00.000Z', members: {owner: 1, analyst: 0, operator: 2, viewer: 0, total: 3}, invitationsPending: 2, invitationsExpired: 0, lastActivityAt: '2026-10-08T11:00:00.000Z',
        ledger: {rows: 0}, imports: {total: 4, open: 0, failed: 1, lastAt: '2026-10-08T11:00:00.000Z'}, jobs: {queued: 0, running: 0, partial: 0, failed: 4, stuck: 1, succeeded24h: 0, failed24h: 0},
        sources: {hubspot: src(true, 3200, 2910, 290, 0, '2026-10-08T11:00:00.000Z'), associations: none(), csv: none(), ledger: none(), excel: none(), attachments: none(), zendesk: none()},
        ai: {spentMicro: '47900000', limitMicro: '50000000', window: '2026-10', uncertain: 2}},
      {id: id(4), name: 'Pixel Retail (demo sintética)', createdAt: '2026-09-22T12:00:00.000Z', members: {owner: 1, analyst: 1, operator: 0, viewer: 2, total: 4}, invitationsPending: 0, invitationsExpired: 0, lastActivityAt: '2026-10-20T09:15:00.000Z',
        ledger: {rows: 3320}, imports: {total: 6, open: 0, failed: 0, lastAt: '2026-10-20T09:00:00.000Z'}, jobs: {queued: 0, running: 0, partial: 0, failed: 0, stuck: 0, succeeded24h: 7, failed24h: 0},
        sources: {hubspot: none(), associations: none(), csv: src(true, 2100, 2100, 0, 0, '2026-10-20T09:00:00.000Z'), ledger: src(true, 3320, 3320, 0, 0, '2026-10-20T00:00:00.000Z'), excel: src(true, 900, 900, 0, 0, '2026-10-20T09:00:00.000Z'), attachments: none(), zendesk: none()},
        ai: {spentMicro: '2300000', limitMicro: '25000000', window: '2026-10', uncertain: 0}},
      {id: id(5), name: 'Cedro Electro (demo sintética)', createdAt: '2026-10-10T08:30:00.000Z', members: {owner: 1, analyst: 0, operator: 0, viewer: 0, total: 1}, invitationsPending: 1, invitationsExpired: 1, lastActivityAt: null,
        ledger: {rows: 0}, imports: {total: 0, open: 0, failed: 0, lastAt: null}, jobs: {queued: 0, running: 0, partial: 0, failed: 0, stuck: 0, succeeded24h: 0, failed24h: 0},
        sources: {hubspot: none(), associations: none(), csv: none(), ledger: none(), excel: none(), attachments: none(), zendesk: none()},
        ai: {spentMicro: '0', limitMicro: '25000000', window: '2026-10', uncertain: 0}},
      {id: id(6), name: 'Espacio de ensayo (demo sintética)', createdAt: '2026-08-30T10:00:00.000Z', members: {owner: 1, analyst: 0, operator: 0, viewer: 0, total: 1}, invitationsPending: 0, invitationsExpired: 0, lastActivityAt: '2026-10-02T17:00:00.000Z',
        ledger: {rows: 180}, imports: {total: 2, open: 0, failed: 0, lastAt: '2026-10-02T17:00:00.000Z'}, jobs: {queued: 0, running: 0, partial: 0, failed: 0, stuck: 0, succeeded24h: 0, failed24h: 0},
        sources: {hubspot: none(), associations: none(), csv: src(true, 400, 400, 0, 0, '2026-10-02T17:00:00.000Z'), ledger: src(true, 180, 180, 0, 0, '2026-10-02T00:00:00.000Z'), excel: none(), attachments: none(), zendesk: none()},
        ai: {spentMicro: '0', limitMicro: '10000000', window: '2026-10', uncertain: 0}},
    ],
    failedJobs: [
      {id: id(31), organizationId: id(3), type: 'extraction', state: 'failed', attempts: 5, errorCode: 'PROVIDER_TIMEOUT', updatedAt: '2026-10-08T11:03:00.000Z'},
      {id: id(32), organizationId: id(3), type: 'import', state: 'failed', attempts: 3, errorCode: 'ROW_LIMIT', updatedAt: '2026-10-08T10:58:00.000Z'},
      {id: id(33), organizationId: id(3), type: 'extraction', state: 'failed', attempts: 5, errorCode: 'PROVIDER_TIMEOUT', updatedAt: '2026-10-08T11:01:00.000Z'},
      {id: id(34), organizationId: id(3), type: 'embedding', state: 'running', attempts: 1, errorCode: null, updatedAt: '2026-10-09T01:00:00.000Z', stuck: true},
      {id: id(35), organizationId: id(1), type: 'import', state: 'failed', attempts: 2, errorCode: 'MAPPING_INVALID', updatedAt: '2026-10-19T22:10:00.000Z'},
      {id: id(36), organizationId: id(1), type: 'tracker', state: 'failed', attempts: 1, errorCode: 'SHEET_REJECTED', updatedAt: '2026-10-19T20:40:00.000Z'},
    ],
    opsSignals: [
      {kind: 'statement_timeout', status: 'warn', title: 'Consultas canceladas por statement_timeout', detail: '3 consultas superaron los 10 s en 24 h (todas en tendencias del Resumen).', observedAt: '2026-10-20T13:00:00.000Z', source: 'logs de Postgres (lectura)'},
      {kind: 'cron', status: 'ok', title: 'Procesos programados (cron)', detail: '4 de 4 con latido en la última hora.', observedAt: '2026-10-20T13:55:00.000Z', source: 'latidos'},
      {kind: 'disk', status: 'unknown', title: 'Disco de la base de datos', detail: 'Sin fuente conectada: la consola aún no lee el uso de disco.', observedAt: null, source: null},
    ],
    audit: [
      {id: '120', actorId: 'a0000000-0000-4000-8000-000000000001', operation: 'team_invite', tenantId: id(3), targetId: null, createdAt: '2026-10-19T17:20:00.000Z'},
      {id: '119', actorId: 'a0000000-0000-4000-8000-000000000001', operation: 'create', tenantId: id(5), targetId: 'b0000000-0000-4000-8000-000000000005', createdAt: '2026-10-10T08:30:00.000Z'},
      {id: '118', actorId: 'a0000000-0000-4000-8000-000000000002', operation: 'team_role', tenantId: id(1), targetId: 'b0000000-0000-4000-8000-000000000009', createdAt: '2026-10-06T15:02:00.000Z'},
      {id: '117', actorId: 'a0000000-0000-4000-8000-000000000001', operation: 'team_cancel', tenantId: id(2), targetId: null, createdAt: '2026-10-03T12:44:00.000Z'},
    ],
  };
}
