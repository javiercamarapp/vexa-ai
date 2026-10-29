// Configuración del cliente piloto: TODO dato que identifique al cliente (UUID de su organización, nombres y huellas
// de los archivos recibidos, rutas privadas, dominio y prefijo de su tienda propia) vive FUERA del repositorio.
//
// Orden de búsqueda del archivo de configuración (el primero que exista):
//   1. variable de entorno VEXA_PILOT_CONFIG (ruta absoluta o relativa al repo)
//   2. config/cliente-piloto.local.json   (ignorado por git)
//   3. ~/.config/vexa/cliente-piloto.json (fuera del repo)
// El ejemplo genérico versionado es config/cliente-piloto.ejemplo.json. VEXA_TENANT_ID, si existe, manda sobre `tenantId`.
// No hay valores reales por defecto: sin configuración, los scripts de producción fallan con un mensaje claro.
import {existsSync, readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Tenant sintético SOLO para pruebas (node --test fija NODE_TEST_CONTEXT). Nunca se usa fuera de ellas. */
export const TENANT_SINTETICO_PRUEBAS = '00000000-0000-4000-8000-0000000000c1';

const DEFAULTS = Object.freeze({
  tenantId: null,
  trackerAccountId: 'pilot-tracker',
  trackerVersions: [],
  tiendaPropia: {prefijoRetailer: 'tienda-piloto', dominio: 'tienda-piloto.example', etiqueta: 'Tienda del cliente piloto'},
  rutaInsumosMarketplaces: path.join(REPO, 'private/cliente-piloto/received/VEXA'),
  shopify: {raiz: path.join(os.homedir(), '.vexa-private/cliente-piloto/insumos-shopify'), importPackage: null, normalized: null},
});

export function rutaConfig(env = process.env) {
  // Bajo `node --test` las pruebas son herméticas: no leen la configuración local de la máquina (salvo VEXA_PILOT_CONFIG explícito).
  if (env.NODE_TEST_CONTEXT && !env.VEXA_PILOT_CONFIG) return null;
  const candidatas = [env.VEXA_PILOT_CONFIG && path.resolve(REPO, env.VEXA_PILOT_CONFIG),
    path.join(REPO, 'config/cliente-piloto.local.json'), path.join(os.homedir(), '.config/vexa/cliente-piloto.json')].filter(Boolean);
  return candidatas.find(p => existsSync(p)) ?? null;
}

const ruta_ = p => (typeof p === 'string' && p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p && path.resolve(REPO, p));
let cache = null;
/** Lee (una vez) la configuración local; se mezcla con DEFAULTS genéricos. */
export function configPiloto({env = process.env, recargar = false} = {}) {
  if (cache && !recargar) return cache;
  const ruta = rutaConfig(env);
  const local = ruta ? JSON.parse(readFileSync(ruta, 'utf8')) : {};
  cache = Object.freeze({
    ...DEFAULTS, ...local,
    tiendaPropia: {...DEFAULTS.tiendaPropia, ...(local.tiendaPropia ?? {})},
    shopify: {...DEFAULTS.shopify, ...(local.shopify ?? {}), raiz: ruta_(local.shopify?.raiz ?? DEFAULTS.shopify.raiz)},
    rutaInsumosMarketplaces: ruta_(local.rutaInsumosMarketplaces ?? DEFAULTS.rutaInsumosMarketplaces),
    _ruta: ruta,
  });
  return cache;
}

/** UUID de la organización piloto: VEXA_TENANT_ID > config local > (solo bajo node --test) tenant sintético > ''. Sin valor real por defecto. */
export function tenantPiloto(env = process.env) {
  const v = (env.VEXA_TENANT_ID || configPiloto({env}).tenantId || '').trim();
  if (v) return v;
  return env.NODE_TEST_CONTEXT ? TENANT_SINTETICO_PRUEBAS : '';
}

/** Igual que tenantPiloto pero lanza si falta o no es un UUID (para los puntos de entrada de producción). */
export function exigirTenantPiloto(env = process.env) {
  const t = tenantPiloto(env);
  if (!UUID.test(t)) throw new Error('Falta el UUID de la organización piloto: defina VEXA_TENANT_ID o tenantId en config/cliente-piloto.local.json (ver config/cliente-piloto.ejemplo.json)');
  return t;
}

/** Archivos recibidos del tracker (nombre, huella, orden). Vacío si no hay configuración local. */
export function versionesTracker(env = process.env) { return Object.freeze(configPiloto({env}).trackerVersions.map(v => Object.freeze({...v}))); }
export function exigirVersionesTracker(env = process.env) {
  const v = versionesTracker(env);
  if (!v.length) throw new Error('No hay trackerVersions: cree config/cliente-piloto.local.json (ver config/cliente-piloto.ejemplo.json)');
  return v;
}
export const cuentaTracker = (env = process.env) => configPiloto({env}).trackerAccountId;
/** Prefijo y dominio de la tienda propia del piloto; VEXA_TIENDA_PROPIA_PREFIJO / VEXA_TIENDA_PROPIA_DOMINIO mandan sobre el archivo. */
export function tiendaPropia(env = process.env) {
  const t = configPiloto({env}).tiendaPropia;
  return {...t, prefijoRetailer: env.VEXA_TIENDA_PROPIA_PREFIJO || t.prefijoRetailer, dominio: env.VEXA_TIENDA_PROPIA_DOMINIO || t.dominio};
}
