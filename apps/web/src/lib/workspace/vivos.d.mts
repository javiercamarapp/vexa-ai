export const INTERVALO_MS: number;
export const MAX_RETROCESO_MS: number;
export const ENDPOINT: string;
export interface CambioDatos { version: string; anterior: string; fuentes: Array<{key: string; [k: string]: unknown}>; insights: Array<{insight: string; [k: string]: unknown}> }
export function crearVigilante(options?: {
  fetchFn?: typeof fetch; visible?: () => boolean; onCambio?: (e: CambioDatos) => void; onEstado?: (e: {estado: string; [k: string]: unknown}) => void;
  intervaloMs?: number; maxMs?: number; ahora?: () => number; setT?: typeof setTimeout; clearT?: typeof clearTimeout; endpoint?: string; primerRetrasoMs?: number;
}): {iniciar(): void; detener(): void; visibilidad(): void; reconocer(): void; estado(): {base: string | null; ultima: string | null; espera: number; fallos: number; parado: boolean; hayNuevos: boolean; activo: boolean}};
