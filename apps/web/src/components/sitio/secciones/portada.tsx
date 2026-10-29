// TODO-T8: stub de T7. T8 reemplaza este archivo completo por el marcado de S1 a S10 (leyendo publicar(), no LANDING directo).
// Solo fija el contrato: Portada recibe el idioma y rinde el contenido interior de <main id="contenido">, con un único h1.
import type {Lang} from '../shell/datos';

export function Portada({lang}: {lang: Lang}) {
  return (
    <section className="s-seccion" data-tema="oscuro">
      <div className="s-contenedor">
        <h1 className="s-h2-grande">{lang === 'es' ? 'Rovaq AI' : 'Rovaq AI'}</h1>
      </div>
    </section>
  );
}
