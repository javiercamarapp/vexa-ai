// Página mínima del sitio: T7 y T8 construyen la real. Sirve para fijar la ruta, el CSS propio y la prueba de estática.
import '../../../../styles/sitio/inicio.css';

export const dynamic = 'force-static';
export const dynamicParams = false;

export default function Inicio() {
  return (
    <main>
      <h1>Rovaq AI</h1>
    </main>
  );
}
