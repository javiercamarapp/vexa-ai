import type {EstadoViaje, EventoViaje, PlanViaje} from './viaje.mjs';
export interface Armado {tras: (origen: string) => boolean; esta: () => boolean}
export function crearArmado(): Armado;
export interface SensoresViaje {reducirMovimiento: () => boolean; enCampo: () => boolean; hayFormularioSucio: () => boolean}
export function planDelPaso(e: {tipo: string; armado: boolean; el: unknown; sensores: SensoresViaje}): PlanViaje;
export interface ConductorMinimo {enviar: (e: EventoViaje) => unknown; estado: () => EstadoViaje; reiniciar?: () => unknown}
export function siguienteDelPaso(e: {tipo: string | undefined; conductor: ConductorMinimo | null | undefined; despachar: (e: {tipo: 'siguiente'}) => void; llevar: () => void}): 'conductor' | 'continuar' | 'llevar' | 'avanzar';
export function teclaQueCancela(key: string): {motivo: 'tab' | 'escape'; consumir: boolean} | null;
export function cancelarConTecla(conductor: {enviar: (e: EventoViaje) => unknown}, evento: {key: string; preventDefault: () => void}): boolean;
export function punteroFueraDeTarjeta(objetivo: unknown, tarjeta: {contains: (n: never) => boolean} | null | undefined): boolean;
export interface NodoFoco {id?: string}
export interface ContenedorFoco {contains: (n: never) => boolean}
export function puedeTomarFoco(e: {activo: NodoFoco | null | undefined; cuerpo?: unknown; tarjeta?: ContenedorFoco | null; menu?: ContenedorFoco | null}): boolean;
export function reiniciarAlSalir(obtener: () => {reiniciar: () => unknown} | null | undefined): () => void;
export function eventoDeTeclado(e: {key: string; defaultPrevented: boolean; tagName: string; dentroDeTarjeta: boolean; propias: boolean; modificador: boolean}): {tipo: 'cerrar' | 'siguiente' | 'anterior'} | null;
