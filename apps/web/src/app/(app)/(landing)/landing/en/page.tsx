import {metadatosLanding, PaginaLandingIdioma} from '../../../../../components/landing/pagina';

/** Landing en inglés (rovaq.ai/en). Misma estructura que la versión en español, con su propio canonical y hreflang. */
export const metadata = metadatosLanding('en');
export default function PaginaLandingEn() { return <PaginaLandingIdioma idioma="en" />; }
