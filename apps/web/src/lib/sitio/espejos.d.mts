export function mapaEspejos(manifestMd?: Record<string, {url: string}>, base?: string): Map<string, {espejo: string; canonica: string}>;
export function espejoDeRuta(mapa: Map<string, {espejo: string; canonica: string}>): (ruta: string) => string | null;
export function rutaEspejoDe(id: string, lang: string, manifestMd?: Record<string, {url: string}>): string | null;
