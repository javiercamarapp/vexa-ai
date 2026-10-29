// Ayudas mínimas para módulos puros con traductor OPCIONAL: sin traductor sale el español canónico que fijan las pruebas; con él, el diccionario del idioma activo.
// El traductor es el de useT(): (clave, variables) -> texto. Las claves de este grupo son tr.lg.*.
/** Texto con traductor opcional: `es` ya viene interpolado (es lo que sale sin traductor). */
export const X = (t, clave, es, vars) => (t ? t(clave, vars) : es);
/** Idioma ('es' | 'en') que implica el traductor; sin traductor, español. Evita pasar el idioma aparte. */
export const idiomaDe = (t) => (t && t('tr.lg.idioma') === 'en' ? 'en' : 'es');
/** Singular/plural con claves distintas (el inglés y el español no pluralizan igual). */
export const P = (t, n, claveUno, claveVarios, esUno, esVarios, vars) => (n === 1 ? X(t, claveUno, esUno, vars) : X(t, claveVarios, esVarios, vars));
