// Logo del sitio público (T7). SVG propio sin atributo style: las formas salen del kit de marca (anillo y palabra rellenos, sin trazos)
// y el punto rojo es el único color. Componente de servidor, sin estado.
//
// Variantes:
//   tono="auto"      una sola copia que hereda currentColor (la cabecera cambia de tinta con su data-tema).
//   tono="negativo"  tinta blanca fija, para fondos oscuros.
//   tono="positivo"  tinta negra fija, para fondos claros.
//   tono="doble"     las dos copias apiladas (.s-logo__negativo y .s-logo__positivo); el CSS muestra la que toca según el tema del contenedor.
//   variante="pie"   la marca gigante del pie: relleno degradado, contorno que se dibuja y punto, con las clases .s-marca__*.
import {LOGOS_SITIO} from './shell/logo-datos';

type Variante = 'horizontal' | 'simbolo' | 'pie';
type Tono = 'auto' | 'negativo' | 'positivo' | 'doble';

// Colores del kit (marca.mjs). El rojo también viene del CSS por la clase; el atributo cubre el caso de CSS ausente.
const TINTA = {negativo: '#FFFFFF', positivo: '#0E0E10'} as const;
const ROJO = '#E8241C';

type Props = {
  variante?: Variante;
  tono?: Tono;
  /** Nombre accesible. Con cadena vacía el logo es decorativo y se oculta a lectores de pantalla. */
  etiqueta?: string;
  /** Alto en px del logo horizontal o del símbolo; el ancho sale de la proporción del kit. */
  alto?: number;
};

function Formas({kit, relleno}: {kit: (typeof LOGOS_SITIO)['horizontal'] | (typeof LOGOS_SITIO)['simbolo']; relleno: string}) {
  return (
    <>
      {kit.tinta.map((d, i) => (
        <path key={i} fill={relleno} d={d} />
      ))}
      <circle className="s-logo__punto" fill={ROJO} cx={kit.punto.cx} cy={kit.punto.cy} r={kit.punto.r} />
    </>
  );
}

function Svg({kit, relleno, clase, etiqueta, alto}: {kit: (typeof LOGOS_SITIO)['horizontal'] | (typeof LOGOS_SITIO)['simbolo']; relleno: string; clase?: string; etiqueta: string; alto: number}) {
  const [, , w, h] = kit.viewBox.split(' ').map(Number);
  const ancho = Math.round(((alto * w) / h) * 100) / 100;
  const decorativo = etiqueta === '';
  return (
    <svg
      className={clase}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={kit.viewBox}
      width={ancho}
      height={alto}
      {...(decorativo ? {'aria-hidden': true, focusable: 'false'} : {role: 'img', 'aria-label': etiqueta})}
    >
      <Formas kit={kit} relleno={relleno} />
    </svg>
  );
}

export function LogoSitio({variante = 'horizontal', tono = 'auto', etiqueta = 'Rovaq', alto = 24}: Props) {
  if (variante === 'pie') return <MarcaPie />;
  const kit = LOGOS_SITIO[variante];
  if (tono === 'doble') {
    return (
      <span className="s-logo">
        <Svg kit={kit} relleno={TINTA.negativo} clase="s-logo__negativo" etiqueta={etiqueta} alto={alto} />
        <Svg kit={kit} relleno={TINTA.positivo} clase="s-logo__positivo" etiqueta="" alto={alto} />
      </span>
    );
  }
  const relleno = tono === 'auto' ? 'currentColor' : TINTA[tono];
  return (
    <span className="s-logo">
      <Svg kit={kit} relleno={relleno} etiqueta={etiqueta} alto={alto} />
    </span>
  );
}

// Marca gigante del pie: la palabra y el anillo reales (rellenos del kit). El relleno va en un grupo para que el degradado de máscara
// cubra todo el conjunto; el contorno repite las formas como trazo de 1 px con pathLength 1, que el CSS dibuja con dashoffset.
export function MarcaPie() {
  const kit = LOGOS_SITIO.horizontal;
  return (
    <svg className="s-pie__marca" xmlns="http://www.w3.org/2000/svg" viewBox={kit.viewBox} aria-hidden="true" focusable="false">
      <g className="s-marca__relleno">
        {kit.tinta.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {kit.tinta.map((d, i) => (
        <path key={i} className="s-marca__contorno" pathLength={1} d={d} />
      ))}
      <circle className="s-marca__punto" fill={ROJO} cx={kit.punto.cx} cy={kit.punto.cy} r={kit.punto.r} />
    </svg>
  );
}
