// Fixtures de la ola «datos»: preferencias de avisos (matriz compacta). Solo auditoría visual.
import {catalog, channels} from '../../../../packages/notifications/catalog.mjs';
export function respondExtra(url, method) {
  const p = new URL(url, 'http://x').pathname;
  if (p === '/api/notifications/preferences' && method === 'GET') {
    return [200, {contract_version: 'f06-notifications-v1', data: {catalog: [...catalog], channels: [...channels], preferences: [{channel: 'inapp', eventType: '*', enabled: true, version: 1}, {channel: 'inapp', eventType: 'brief.available', enabled: true, version: 1}]}}];
  }
  return null;
}
