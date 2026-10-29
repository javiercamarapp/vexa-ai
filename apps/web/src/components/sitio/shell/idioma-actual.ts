// Idioma de la petición en curso para componentes que no reciben params (la página no-encontrada de Next no los recibe).
// El layout lo fija al renderizar y los descendientes lo leen: React.cache da un objeto por render, así que no hay estado compartido
// entre rutas ni entre peticiones. No usa cookies ni encabezados, por lo que la ruta sigue siendo estática.
import {cache} from 'react';
import type {Lang} from './datos';

const caja = cache((): {lang: Lang} => ({lang: 'es'}));
export const fijarIdioma = (lang: Lang): void => {
  caja().lang = lang;
};
export const idiomaActual = (): Lang => caja().lang;
