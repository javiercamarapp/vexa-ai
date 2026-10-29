import {metadatosLanding, PaginaLandingIdioma} from '../../../components/landing/pagina';

/** Landing en español (rovaq.ai/). Página estática: el idioma sale de la URL, no de una cookie. En rovaq.ai la raíz se reescribe aquí (middleware); en el host de la app esta ruta existe con canonical a rovaq.ai. */
export const metadata = metadatosLanding('es');
export default function PaginaLanding() { return <PaginaLandingIdioma idioma="es" />; }
