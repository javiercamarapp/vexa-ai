// Efecto de importación: fija VEXA_CCO_CATALOGO con el catálogo SINTÉTICO. Se importa PRIMERO en las pruebas que cargan módulos que leen el catálogo al iniciar
// (los imports ESM se evalúan en orden, así que este debe ir antes que cualquier otro que lo use).
import {usarCatalogoSintetico} from './cco-catalogo-sintetico.mjs';
usarCatalogoSintetico();
