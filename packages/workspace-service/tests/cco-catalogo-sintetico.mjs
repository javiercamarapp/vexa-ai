// Catálogo de bodegas 100 % SINTÉTICO para las pruebas del CCO. En producción el catálogo real sale de VEXA_CCO_CATALOGO (fuera del repo);
// aquí hay nombres inventados que no corresponden a ninguna bodega real. Las pruebas lo fijan en el entorno antes de usar bodegaDe o las funciones SQL.
//   «DEMO-» es una familia de bodegas (cada sufijo es una bodega distinta, sufijoLibre); el resto son bodegas con etiqueta fija.
export const CATALOGO_SINTETICO = Object.freeze({
  bodegas: [
    {prefijo: 'DEMO-', sufijoLibre: true},
    {prefijo: 'ALFA', etiqueta: 'Bodega Alfa'},
    {prefijo: 'BET', etiqueta: 'Bodega Beta'},
    {prefijo: 'GAMMA', etiqueta: 'Bodega Gamma'},
    {prefijo: 'DELTA', etiqueta: 'Bodega Delta'},
  ],
});
export const CATALOGO_SINTETICO_JSON = JSON.stringify(CATALOGO_SINTETICO);
/** Fija VEXA_CCO_CATALOGO con el catálogo sintético (idempotente). */
export const usarCatalogoSintetico = () => { process.env.VEXA_CCO_CATALOGO = CATALOGO_SINTETICO_JSON; };
