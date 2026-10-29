// Textos de cliente para el detalle de una carga: estado en español, filas con separador y fecha legible (UTC rotulada). Nada de códigos HTTP ni estados crudos.
import {fechaCorteLegible} from '../legibilidad/fechas.mjs';
import {numero} from '../formato/idioma.mjs';
// Textos de este módulo puro: español canónico (lo que fijan las pruebas) e inglés. El idioma es siempre opcional y por omisión 'es'.
export const TXT=Object.freeze({
 es:{estados:{queued:'En cola',running:'Importando',succeeded:'Completada',partial:'Completada con rechazos',failed:'Requiere atención',cancelled:'Cancelada'},revisar:'Estado por revisar',fila:'fila confirmada',filas:'filas confirmadas',filasPorConfirmar:'Filas por confirmar',sinProgreso:'Aún sin progreso registrado',
  inexistente:'Esta carga no existe o ya no está disponible.',sinAcceso:'No tienes acceso a esta carga.',noConfigurado:'El servicio no respondió ahora. Se reintentará solo; si sigue igual, un administrador debe revisar la conexión y el proceso en segundo plano en «Configurar proceso».',reintentar:'No se pudo consultar el estado de la carga. Se reintentará solo.'},
 en:{estados:{queued:'Queued',running:'Importing',succeeded:'Completed',partial:'Completed with rejections',failed:'Needs attention',cancelled:'Cancelled'},revisar:'Status to review',fila:'row confirmed',filas:'rows confirmed',filasPorConfirmar:'Rows to confirm',sinProgreso:'No progress recorded yet',
  inexistente:'This upload does not exist or is no longer available.',sinAcceso:'You do not have access to this upload.',noConfigurado:'The service did not respond just now. It will retry on its own; if it stays the same, an administrator must review the connection and the background process under Set up process.',reintentar:'The upload status could not be checked. It will retry on its own.'},
});
const T=(idioma)=>TXT[idioma==='en'?'en':'es'];
export const ESTADO_CARGA=Object.freeze(TXT.es.estados);
export const TONO_CARGA=Object.freeze({succeeded:'ok',partial:'warn',failed:'bad',running:'info',queued:'info',cancelled:'muted'});
export const estadoCarga=(estado,idioma)=>T(idioma).estados[estado]??T(idioma).revisar;
export const tonoCarga=(estado)=>TONO_CARGA[estado]??'muted';
export const filasConfirmadas=(n,idioma)=>{const v=Number(n);return Number.isFinite(v)?`${numero(v,idioma)} ${v===1?T(idioma).fila:T(idioma).filas}`:T(idioma).filasPorConfirmar;};
export const ultimoProgreso=(iso,idioma)=>iso?fechaCorteLegible(iso,{idioma}):T(idioma).sinProgreso;
/** Qué decirle a la persona cuando la consulta de una carga falla. Nada de «404: JOB_NOT_FOUND»: el código HTTP y el código interno no se muestran. `tipo` decide la pantalla. */
export function errorDeCarga(status, code, idioma) {
  const x = T(idioma);
  if (status === 404 || code === 'JOB_NOT_FOUND') return { tipo: 'inexistente', mensaje: x.inexistente };
  if (status === 401 || status === 403) return { tipo: 'sin-acceso', mensaje: x.sinAcceso };
  if (status === 503) return { tipo: 'no-configurado', mensaje: x.noConfigurado };
  return { tipo: 'reintentar', mensaje: x.reintentar };
}
/** Una carga inexistente o sin acceso no mejora al reintentar: se deja de consultar cada 2 s. */
export const reintentable = (tipo) => tipo === 'reintentar' || tipo === 'no-configurado';

/** El CSV de errores solo tiene sentido si la carga rechazó filas: con 0 rechazadas descargaría un archivo vacío. */
export const hayErroresParaDescargar = (rechazadas) => Number(rechazadas) > 0;
