// Portada de rovaq.ai (T8): marcado de las diez secciones S1 a S10. Componente de servidor. Rinde el interior de <main id="contenido">;
// el marco (salto, cabecera, pie) lo pone T7. Todo texto viene de publicar() vía datos.ts; las imágenes, del manifest K3.
//
// Estructura (contrato de T6):
//   S1 hero + S2 horizonte · .s-hilo-zona [ data-hilo="" vacío para T10, S3 a S10 ]
// Cada sección lleva id, data-seccion y data-tema (oscuro o claro). Hay un solo h1 (el del hero) y un h2 por sección.
// Todo es legible sin JavaScript y con movimiento reducido: los estados ocultos viven en CSS bajo html[data-js].
import {textosPortada} from './datos';
import type {Lang} from './datos';
import {Hero} from './hero';
import {Problema, Valor} from './problema-valor';
import {Pantallas, Pasos} from './pasos-pantallas';
import {Puestos} from './puestos';
import {Cierre, Integraciones, Seguridad} from './seguridad-cierre';

/** Banda de cruce: hueco deliberado entre secciones por donde el hilo hace su S grande de un lado al otro. Sin contenido; inicio.js la mide. */
const Banda = ({n}: {n: number}) => <div className="s-banda" data-banda={n} aria-hidden="true" />;

export function Portada({lang}: {lang: Lang}) {
  const t = textosPortada(lang);
  return (
    <>
      <Hero lang={lang} t={t} />
      <div className="s-hilo-zona">
        {/* Contenedor del hilo: vacío; T10 (genera-hilo) inserta aquí el svg. */}
        <div data-hilo="" aria-hidden="true" />
        <Problema lang={lang} t={t} />
        <Banda n={1} />
        <Valor lang={lang} t={t} />
        <Banda n={2} />
        <Pasos lang={lang} t={t} />
        <Banda n={3} />
        <Pantallas lang={lang} t={t} />
        <Banda n={4} />
        <Puestos t={t} />
        <Banda n={5} />
        <Seguridad lang={lang} t={t} />
        <Banda n={6} />
        <Integraciones lang={lang} t={t} />
        <Banda n={7} />
        <Cierre lang={lang} t={t} />
      </div>
    </>
  );
}
