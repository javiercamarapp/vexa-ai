// Textos de cliente para el detalle de una carga: estado en español, filas con separador y fecha legible (UTC rotulada). Nada de códigos HTTP ni estados crudos.
import {fechaCorteLegible} from '../legibilidad/fechas.mjs';
export const ESTADO_CARGA=Object.freeze({queued:'En cola',running:'Importando',succeeded:'Completada',partial:'Completada con rechazos',failed:'Requiere atención',cancelled:'Cancelada'});
export const TONO_CARGA=Object.freeze({succeeded:'ok',partial:'warn',failed:'bad',running:'info',queued:'info',cancelled:'muted'});
export const estadoCarga=(estado)=>ESTADO_CARGA[estado]??'Estado por revisar';
export const tonoCarga=(estado)=>TONO_CARGA[estado]??'muted';
export const filasConfirmadas=(n)=>{const v=Number(n);return Number.isFinite(v)?`${v.toLocaleString('es-MX')} ${v===1?'fila confirmada':'filas confirmadas'}`:'Filas por confirmar';};
export const ultimoProgreso=(iso)=>iso?fechaCorteLegible(iso):'Aún sin progreso registrado';
/** Qué decirle a la persona cuando la consulta de una carga falla. Nada de «404: JOB_NOT_FOUND»: el código HTTP y el código interno no se muestran. `tipo` decide la pantalla. */
export function errorDeCarga(status, code) {
  if (status === 404 || code === 'JOB_NOT_FOUND') return { tipo: 'inexistente', mensaje: 'Esta carga no existe o ya no está disponible.' };
  if (status === 401 || status === 403) return { tipo: 'sin-acceso', mensaje: 'No tienes acceso a esta carga.' };
  if (status === 503) return { tipo: 'no-configurado', mensaje: 'Configura la conexión a la base de datos y la autenticación del servidor y habilita el proceso en segundo plano en «Configurar proceso».' };
  return { tipo: 'reintentar', mensaje: 'No se pudo consultar el estado de la carga. Pulsa Actualizar para reintentar.' };
}
/** Una carga inexistente o sin acceso no mejora al reintentar: se deja de consultar cada 2 s. */
export const reintentable = (tipo) => tipo === 'reintentar' || tipo === 'no-configurado';
