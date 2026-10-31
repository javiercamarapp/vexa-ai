// Asistente de configuración (/setup, solo lectura): el orden, el tiempo estimado y el estado honesto de cada paso para una pista.
// NO es una lista paralela: cada entrada apunta a un paso del catálogo (catalogo.mjs), que es quien dice la capacidad, la pantalla y los textos.
// Un paso que el rol de la pista NO puede hacer (p. ej. conectar el CRM para el analista) se muestra como «lo hace otra persona», sin enlace.
// Nada aquí consulta datos ni escribe: recibe señales ya calculadas por el servidor (setup-servidor.ts) y las del navegador (avisos push).
import { CATALOGO, ROL_DE_PISTA, rolTieneCapacidad, rolesConCapacidad } from './catalogo.mjs';
import { estadoDePaso } from './prerrequisitos.mjs';

/** Orden de roles al decir «pídeselo a»: primero quien más autoridad tiene. */
const ORDEN_ROLES = Object.freeze(['owner', 'analyst', 'operator', 'viewer']);

/**
 * Entradas por pista: `min` = minutos estimados; `mixto` = paso compartido con el equipo de Rovaq (hoja para soporte);
 * `pre` = prerrequisito propio del asistente cuando el paso del catálogo no lo declara.
 */
export const ASISTENTE = Object.freeze({
  propietario: Object.freeze([
    { id: 'propietario.idioma', min: 1 },
    { id: 'propietario.crm', min: 15, mixto: true },
    { id: 'propietario.historial', min: 10 },
    { id: 'propietario.pedidos', min: 15 },
    { id: 'propietario.dimensiones', min: 10 },
    { id: 'propietario.conciliar', min: 20 },
    { id: 'propietario.corte', min: 5 },
    { id: 'propietario.equipo', min: 5 },
    { id: 'propietario.avisos', min: 2, pre: 'push' },
    { id: 'propietario.retencion', min: 3 },
  ]),
  analista: Object.freeze([
    { id: 'analista.idioma', min: 1 },
    { id: 'analista.importar', min: 10 },
    { id: 'analista.corte', min: 5 },
    { id: 'analista.avisos', min: 2, pre: 'push' },
    { id: 'propietario.crm', min: 15 },
    { id: 'propietario.pedidos', min: 15 },
    { id: 'propietario.dimensiones', min: 10 },
    { id: 'propietario.conciliar', min: 20 },
  ]),
  operador: Object.freeze([
    { id: 'operador.idioma', min: 1 },
    { id: 'operador.avisos', min: 2, pre: 'push' },
    { id: 'operador.propuesta', min: 5 },
    { id: 'operador.resultado', min: 5 },
  ]),
  lector: Object.freeze([
    { id: 'lector.idioma', min: 1 },
    { id: 'lector.avisos', min: 2, pre: 'push' },
  ]),
});

const PASO = new Map(CATALOGO.map((p) => [p.id, p]));
/** Roles de organización que pueden hacer un paso, en el orden en que se les pide ayuda. */
export const rolesQueLoHacen = (accion) => { const r = rolesConCapacidad(accion); return ORDEN_ROLES.filter((x) => r.includes(x)); };

/**
 * Estado de un paso del asistente para la pista (y su rol).
 * `ctx` = { senales: objeto de normalizarSenales | null, consultadas?: claves que el servidor sí consultó, push: { configurado: boolean|null, dispositivos: number|null } }
 * @returns {{estado:string, cuenta:boolean, esperaA:string|null, nota:string|null, puede:boolean}}
 */
export function estadoAsistente(pista, entrada, ctx = {}) {
  const paso = PASO.get(entrada.id);
  const rol = ROL_DE_PISTA[pista];
  // Un paso que el catálogo marca como «espera al propietario» (el analista prepara pero publica el propietario) no es accionable para esta pista aunque la capacidad exista.
  const puede = Boolean(rol) && rolTieneCapacidad(rol, paso.accion) && !paso.espera;
  // Lo que el rol no puede hacer no es suyo: no cuenta en su progreso ni en su «siguiente recomendado».
  if (!puede) return { estado: 'otro', cuenta: false, esperaA: null, nota: null, puede };
  const { senales = null, push = null } = ctx;
  if (entrada.pre === 'push') {
    if (!push || push.configurado == null) return { estado: 'desconocido', cuenta: false, esperaA: null, nota: null, puede };
    // Sin la configuración del servidor, el aviso push no se puede activar: es de un tercero y no cuenta.
    if (push.configurado !== true) return { estado: 'esperando', cuenta: false, esperaA: 'onb.tercero.push', nota: null, puede };
    if ((push.dispositivos ?? 0) > 0) return { estado: 'hecho', cuenta: true, esperaA: null, nota: null, puede };
    return { estado: 'pendiente', cuenta: true, esperaA: null, nota: null, puede };
  }
  if (!paso.prerrequisito) return { estado: 'informativo', cuenta: false, esperaA: null, nota: null, puede };
  // Una señal que el servidor no consultó para este rol nunca se toma por «falso»: se dice que no se pudo comprobar.
  if (Array.isArray(ctx.consultadas) && !ctx.consultadas.includes(paso.prerrequisito)) return { estado: 'desconocido', cuenta: false, esperaA: null, nota: null, puede };
  return { ...estadoDePaso(paso, senales), puede };
}

/** Lista del asistente de una pista, en orden, con progreso y «siguiente recomendado» (nunca un paso de tercero, informativo o de otra persona). */
export function calcularAsistente(pista, ctx = {}) {
  const items = (ASISTENTE[pista] ?? []).map((entrada) => {
    const paso = PASO.get(entrada.id);
    const quien = paso.espera === 'propietario' ? ['owner'] : rolesQueLoHacen(paso.accion);
    return { id: paso.id, textos: paso.textos, href: paso.href, accion: paso.accion, min: entrada.min, mixto: entrada.mixto === true, quien, ...estadoAsistente(pista, entrada, ctx) };
  });
  const propios = items.filter((i) => i.cuenta);
  const hechos = propios.filter((i) => i.estado === 'hecho' || i.estado === 'salvedad').length;
  const siguiente = (ctx.senales || ctx.push) ? (items.find((i) => i.estado === 'pendiente' && i.cuenta)?.id ?? null) : null;
  return { items, progreso: { hechos, total: propios.length }, siguiente };
}

/** Proveedor y permisos de la hoja para soporte (HubSpot es el CRM por defecto). Los permisos salen del adaptador: packages/connectors/hubspot.mjs. */
export const HOJA_PROVEEDOR = 'HubSpot';
export const HOJA_PERMISOS_MINIMOS = Object.freeze(['conversations.read']);
export const HOJA_PERMISOS_OPCIONALES = Object.freeze(['crm.objects.tickets.read', 'crm.objects.contacts.read']);
/** Nombre sugerido de la credencial (campo `ref` de VEXA_CRM_CREDENTIALS_JSON): proveedor + los 8 primeros caracteres de la organización. */
export const nombreCredencial = (tenantId) => `hubspot-${String(tenantId ?? '').replace(/[^a-f0-9]/gi, '').slice(0, 8).toLowerCase() || 'cuenta'}`;
/**
 * Datos de la hoja para soporte. No contiene ningún secreto: el token lo entrega el propietario por el canal que acuerde con soporte.
 * `cuenta` = identificador de la cuenta del proveedor si ya hay una conexión que lo declara; si no, null (el propietario lo completa).
 */
export function datosHojaSoporte({ tenantId, organizacion = '', cuenta = null } = {}) {
  return { proveedor: HOJA_PROVEEDOR, organizacion, tenantId: String(tenantId ?? ''), cuenta, credencial: nombreCredencial(tenantId), permisos: [...HOJA_PERMISOS_MINIMOS], opcionales: [...HOJA_PERMISOS_OPCIONALES] };
}

/**
 * Indicador de conciliación pedido-cliente a partir de lo que devuelve el servidor.
 * `datos` = { pedidos: number|null (pedidos del libro, de un resumen precalculado), resumen: 'ready'|'absent'|'unavailable'|'timeout'|'no_aplica', refreshedAt: string|null, ligadas: boolean|null }
 * Nunca inventa ni redondea: sin una base verificable devuelve `pendiente` sin cifra.
 * @returns {{tipo:'base'|'hay_ligas'|'sin_pedidos'|'sin_resumen'|'pendiente', ligados:number|null, total:number|null, fecha:string|null}}
 */
export function indicadorConciliacion(datos) {
  const d = datos ?? {};
  const total = Number.isFinite(d.pedidos) && d.pedidos >= 0 ? Math.trunc(d.pedidos) : null;
  const fecha = typeof d.refreshedAt === 'string' ? d.refreshedAt : null;
  if (d.resumen !== 'ready' || total === null) return { tipo: d.resumen === 'ready' ? 'pendiente' : 'sin_resumen', ligados: null, total: null, fecha: null };
  if (total === 0) return { tipo: 'sin_pedidos', ligados: null, total: 0, fecha };
  if (d.ligadas === false) return { tipo: 'base', ligados: 0, total, fecha };
  // Hay vínculos: el conteo exacto de pedidos ligados no se lee barato, así que no se muestra cifra de ligados.
  if (d.ligadas === true) return { tipo: 'hay_ligas', ligados: null, total, fecha };
  return { tipo: 'pendiente', ligados: null, total: null, fecha: null };
}
