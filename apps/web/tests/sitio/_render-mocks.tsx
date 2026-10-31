// Ayudante de mocks.test.mjs y del arnés visual (no es una prueba: el prefijo _ lo deja fuera del glob). Se ejecuta con `node --import tsx`
// porque los componentes son TSX; renderiza cada mockup, diagrama e ícono con react-dom/server y escribe JSON en stdout.
import {renderToStaticMarkup} from 'react-dom/server';
import {Mock} from '../../src/components/sitio/mocks/mock';
import {IDS_MOCK} from '../../src/components/sitio/mocks/datos';
import * as D from '../../src/components/sitio/mocks/datos';
import {Diagrama, IDS_DIAGRAMA} from '../../src/components/sitio/diagramas/diagrama';
import {Icono, NOMBRES_ICONO, ICONOS_HILO} from '../../src/components/sitio/iconos/iconos';
import {Sello} from '../../src/components/sitio/mocks/piezas';

const salida: Record<string, unknown> = {mocks: {}, diagramas: {}, iconos: {}};
for (const lang of ['es', 'en'] as const) {
  for (const id of IDS_MOCK) {
    for (const variante of ['completo', 'apoyo', 'miniatura'] as const) {
      (salida.mocks as Record<string, string>)[`${id}:${lang}:${variante}`] = renderToStaticMarkup(<Mock id={id} lang={lang} variante={variante} />);
    }
  }
  for (const id of IDS_DIAGRAMA) (salida.diagramas as Record<string, string>)[`${id}:${lang}`] = renderToStaticMarkup(<Diagrama id={id} lang={lang} />);
}
for (const n of NOMBRES_ICONO) (salida.iconos as Record<string, string>)[n] = renderToStaticMarkup(<Icono nombre={n} />);
(salida.iconos as Record<string, string>)['__titulo'] = renderToStaticMarkup(<Icono nombre="lupa" titulo="Lupa" />);
salida.hilo = ICONOS_HILO;
salida.sellos = Object.fromEntries((['observado', 'estimado', 'inferido', 'sindato'] as const).map((c) => [c, renderToStaticMarkup(<Sello clase={c} lang="es" />)]));
salida.diagramasSolo = {};
salida.datos = {
  INGRESO_BRUTO: D.INGRESO_BRUTO, REEMBOLSOS: D.REEMBOLSOS, PARETO: D.PARETO, REEMBOLSOS_TOP10: D.REEMBOLSOS_TOP10, SKU_TOTAL: D.SKU_TOTAL, CANALES: D.CANALES, PROBLEMAS: D.PROBLEMAS,
  SERIE_INGRESO: D.SERIE_INGRESO, SERIE_REEMBOLSOS: D.SERIE_REEMBOLSOS, EXPOSICION_SUBTOTAL: D.EXPOSICION_SUBTOTAL, INGRESO_EN_JUEGO: D.INGRESO_EN_JUEGO,
  DINERO_ATORADO: D.DINERO_ATORADO, INTENSIDAD: D.INTENSIDAD,
  totalesCanal: D.CANALES.map((_, i) => D.totalCanal(i)), totalesMes: [0, 1, 2].map((j) => D.totalMes(j)),
  textos: {es: D.T('es'), en: D.T('en')},
};
process.stdout.write(JSON.stringify(salida));
