// Textos de cliente para el detalle de una carga: estado en español, filas con separador y fecha legible (UTC rotulada). Nada de códigos HTTP ni estados crudos.
import {fechaCorteLegible} from '../legibilidad/fechas.mjs';
export const ESTADO_CARGA=Object.freeze({queued:'En cola',running:'Importando',succeeded:'Completada',partial:'Completada con rechazos',failed:'Requiere atención',cancelled:'Cancelada'});
export const TONO_CARGA=Object.freeze({succeeded:'ok',partial:'warn',failed:'bad',running:'info',queued:'info',cancelled:'muted'});
export const estadoCarga=(estado)=>ESTADO_CARGA[estado]??'Estado por revisar';
export const tonoCarga=(estado)=>TONO_CARGA[estado]??'muted';
export const filasConfirmadas=(n)=>{const v=Number(n);return Number.isFinite(v)?`${v.toLocaleString('es-MX')} ${v===1?'fila confirmada':'filas confirmadas'}`:'Filas por confirmar';};
export const ultimoProgreso=(iso)=>iso?fechaCorteLegible(iso):'Aún sin progreso registrado';
