// Íconos de línea de 1 px sobre rejilla de 16 (T9): los del hilo y los de las secciones. Un solo trazo, sin relleno, sin color propio:
// heredan currentColor. Se dibujan sobre medios píxeles para que el trazo de 1 px caiga nítido a 16 px. Sin style, sin clases de color.
import type {ReactNode} from 'react';

export type NombreIcono =
  | 'conversacion'
  | 'pedido'
  | 'problema'
  | 'accion'
  | 'evidencia'
  | 'lupa'
  | 'sello'
  | 'candado'
  | 'persona'
  | 'fuentes'
  | 'flujo'
  | 'acceso';

const FORMAS: Record<NombreIcono, ReactNode> = {
  // Burbuja de conversación con dos líneas de texto
  conversacion: (
    <>
      <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
      <path d="M5 6.5h6M5 8.5h3.5" />
    </>
  ),
  // Caja de pedido con cinta
  pedido: (
    <>
      <path d="M2.5 5.5 8 3l5.5 2.5v6L8 14l-5.5-2.5z" />
      <path d="M2.5 5.5 8 8l5.5-2.5M8 8v6" />
    </>
  ),
  // Triángulo de advertencia con marca
  problema: (
    <>
      <path d="M8 2.5 14 13H2z" />
      <path d="M8 6.5v3.5M8 11.5v.5" />
    </>
  ),
  // Flecha que sale de un cuadro: una acción propuesta
  accion: (
    <>
      <path d="M6.5 3.5h-4v9h9v-4" />
      <path d="M8.5 2.5h5v5M13.5 2.5 7.5 8.5" />
    </>
  ),
  // Documento con una marca de verificación
  evidencia: (
    <>
      <path d="M3.5 2.5h6l3 3v8h-9z" />
      <path d="M9.5 2.5v3h3" />
      <path d="m5.5 9.5 1.7 1.7 3.3-3.4" />
    </>
  ),
  // Lupa
  lupa: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3.5 3.5" />
    </>
  ),
  // Sello: disco con borde doble y base
  sello: (
    <>
      <circle cx="8" cy="6.5" r="3.5" />
      <path d="M5.5 9.5 4.5 14l3.5-2 3.5 2-1-4.5" />
    </>
  ),
  // Candado cerrado: solo lectura
  candado: (
    <>
      <rect x="3.5" y="7.5" width="9" height="6" rx="1" />
      <path d="M5.5 7.5v-2a2.5 2.5 0 0 1 5 0v2M8 10v1.5" />
    </>
  ),
  // Persona: cabeza y hombros
  persona: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
    </>
  ),
  // Tres láminas dispersas
  fuentes: (
    <>
      <rect x="1.5" y="2.5" width="5" height="4" rx=".5" />
      <rect x="9.5" y="4.5" width="5" height="4" rx=".5" />
      <rect x="4.5" y="9.5" width="5" height="4" rx=".5" />
    </>
  ),
  // Cuatro pasos enlazados
  flujo: (
    <>
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="6.5" cy="8" r="1.5" />
      <circle cx="10.5" cy="8" r="1.5" />
      <circle cx="14" cy="8" r=".5" />
      <path d="M4 8h1M8 8h1M12 8h1" />
    </>
  ),
  // Flecha diagonal: solicitar acceso
  acceso: (
    <>
      <path d="M4 12 12 4" />
      <path d="M5.5 4H12v6.5" />
    </>
  ),
};

export const NOMBRES_ICONO = Object.keys(FORMAS) as NombreIcono[];

/** Los siete íconos de las notas del hilo, en el orden de la línea: fuentes dispersas, cada cifra con su sello, importa agrupa cuantifica decide,
 *  una pregunta por pantalla, lo que existe y lo que no, todas las respuestas con fuente y solicita acceso. */
export const ICONOS_HILO: readonly NombreIcono[] = ['fuentes', 'sello', 'flujo', 'conversacion', 'candado', 'evidencia', 'acceso'];

/**
 * Ícono de 16 por 16 con trazo de 1 px. Decorativo por defecto (aria-hidden); con titulo pasa a ser una imagen con nombre.
 */
export function Icono({nombre, tam = 16, titulo}: {nombre: NombreIcono; tam?: number; titulo?: string}) {
  const forma = FORMAS[nombre];
  if (!forma) throw new Error(`ICONO_DESCONOCIDO: ${String(nombre)}`);
  return (
    <svg
      className="s-diag-icono"
      width={tam}
      height={tam}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-icono={nombre}
      {...(titulo ? {role: 'img', 'aria-label': titulo} : {'aria-hidden': true, focusable: 'false'})}
    >
      {titulo ? <title>{titulo}</title> : null}
      {forma}
    </svg>
  );
}
