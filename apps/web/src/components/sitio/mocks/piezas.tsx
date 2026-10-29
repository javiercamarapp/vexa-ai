// Piezas compartidas de los mockups (T9): ventana, sellos de clase, cifras y gráficas pequeñas. Componentes de servidor, sin style.
// Las clases propias llevan el prefijo s-mock-; se reutilizan las de T6 que ya son contrato: s-ventana, s-sello, s-indicador y s-raya.
import type {ReactNode} from 'react';
import {MONEDA, NOMBRE_CLASE, fmt} from './datos';
import type {Clase, Lang} from './datos';

export type Variante = 'completo' | 'apoyo' | 'miniatura';

/** Sello de clase de cifra: se distingue por relleno, rayado, punteado o guiones, y no por color. */
export function Sello({clase, lang, compacto = false}: {clase: Clase; lang: Lang; compacto?: boolean}) {
  return (
    <span className={`s-sello s-sello--${clase}${compacto ? ' s-mock-sello--compacto' : ''}`}>
      <span className="s-sello__icono" aria-hidden="true" />
      {NOMBRE_CLASE[clase][lang]}
    </span>
  );
}

/** Cifra sin dato: una raya larga y nunca un cero. */
export const Raya = () => <span className="s-raya" aria-hidden="true" />;

/** Único rojo de un mockup. En la miniatura no se pinta: la sección de seis pantallas va sin rojo. */
export const Alerta = ({visible}: {visible: boolean}) => (visible ? <span className="s-indicador" aria-hidden="true" /> : null);

/** Línea de tendencia de 100 por 24 sin ejes. Sirve para ver la forma; la cifra va escrita al lado. */
export function Tendencia({valores}: {valores: readonly number[]}) {
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const pts = valores.map((v, i) => `${((i / (valores.length - 1)) * 100).toFixed(2)},${(22 - ((v - min) / (max - min || 1)) * 20).toFixed(2)}`).join(' ');
  return (
    <svg className="s-mock-tendencia" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline className="s-mock-tendencia__linea" points={pts} />
      <polyline className="s-mock-tendencia__area" points={`0,24 ${pts} 100,24`} />
    </svg>
  );
}

/** Nivel de calor de 1 a 5 de un valor contra el máximo. */
export const nivelCalor = (v: number, min: number, max: number): 1 | 2 | 3 | 4 | 5 => (1 + Math.round(((v - min) / (max - min || 1)) * 4)) as 1 | 2 | 3 | 4 | 5;

export const Puntos = () => (
  <span className="s-mock-puntos" aria-hidden="true">
    <span />
    <span />
    <span />
  </span>
);

/**
 * Ventana de mockup. role img con la descripción accesible y el rótulo en la misma etiqueta; el rótulo se ve siempre,
 * también en la miniatura. La clase s-ventana trae el borde, el radio, el fondo y la sombra del tema de la sección.
 */
export function Ventana({id, variante, ruta, org, alt, rotulo, children}: {id: string; variante: Variante; ruta: string; org: string; alt: string; rotulo: string; children: ReactNode}) {
  return (
    <figure className={`s-ventana s-mock-raiz s-mock-raiz--${variante}`} role="img" aria-label={`${alt} ${rotulo}`} data-mock={id} data-variante={variante}>
      <div className="s-ventana__barra s-mock-barra">
        <Puntos />
        <span className="s-mock-ruta">{ruta}</span>
        <span className="s-mock-org">{org}</span>
      </div>
      <div className="s-mock-cuerpo" aria-hidden="true">
        {children}
      </div>
      <p className="s-mock-rotulo">{rotulo}</p>
    </figure>
  );
}

/** Importe en USD: el número en mono y la unidad más ligera. Una sola moneda por pantalla. */
export const Usd = ({n}: {n: number}) => (
  <>
    {fmt(n)}
    <span className="s-mock-unidad"> {MONEDA}</span>
  </>
);
