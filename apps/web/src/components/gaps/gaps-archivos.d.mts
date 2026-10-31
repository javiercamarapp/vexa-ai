import type {BrechasVista} from '../../../../../packages/workspace-service/brechas.mjs';
import type {Archivo} from '../refunds/fuga-archivos.mjs';
type ArchivoN = Archivo & {total: number};
export function proveniencia(v: BrechasVista, idioma?: string): string[];
export function csvIngresos(v: BrechasVista): ArchivoN;
export function csvIntensidad(v: BrechasVista): ArchivoN;
export function csvRecomendaciones(v: BrechasVista): ArchivoN;
export function resumenHtml(v: BrechasVista): ArchivoN;
