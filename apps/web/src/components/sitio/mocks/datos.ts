// Fuente única de los datos sintéticos de los seis mockups (T9) y de sus textos.
// Las cifras viven aquí, tipadas, y todo lo que se dibuja se calcula a partir de ellas: ninguna cifra se escribe a mano en el marcado.
// Los textos de cada pantalla salen del árbol publicable de T11 (LANDING.mockups); lo que T11 no define, la microcopia propia de
// las ilustraciones de interfaz, vive en UI, en los dos idiomas. Una moneda por pantalla: USD. Sin marcas ni nombres de clientes.
import {LANDING} from '../../../content/sitio/landing';
import {proyectarArbol, publicar} from '../../../lib/sitio/marcadores.mjs';

export type Lang = 'es' | 'en';
export type IdMock = 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6';
export const IDS_MOCK: readonly IdMock[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
export type Clase = 'observado' | 'estimado' | 'inferido' | 'sindato';

// ---------- Cifras ----------
export const MONEDA = 'USD';
export const INGRESO_BRUTO = 480_000;
export const REEMBOLSOS = 36_000;
export const DINERO_ATORADO = 9_000;
export const HILOS_MAS_24H = 14;
/** Subtotal conocido de exposición, inferido. Se muestra como subtotal, nunca como total ni como pérdida. */
export const EXPOSICION_SUBTOTAL = 21_600;
/** Ingreso en juego de la recomendación sobre el SKU principal. Inferido. */
export const INGRESO_EN_JUEGO = 8_200;
export const SKU_PRINCIPAL = 'HM-210';
/** Reembolsos de los diez SKU principales y su parte de REEMBOLSOS (67.9 %). */

/** Los diez SKU con más reembolsos de un catálogo de 62, de mayor a menor. Diez SKU inventados; suman 24,450 USD, el 67.9 % de REEMBOLSOS: los otros 52 SKU (ninguno mayor que el décimo) suman el resto. */
export const PARETO: readonly {sku: string; v: number}[] = [
  {sku: 'HM-210', v: 8_000},
  {sku: 'HM-160', v: 4_800},
  {sku: 'HM-130', v: 3_300},
  {sku: 'HM-190', v: 2_400},
  {sku: 'HM-150', v: 1_700},
  {sku: 'HM-120', v: 1_300},
  {sku: 'HM-180', v: 1_000},
  {sku: 'HM-140', v: 800},
  {sku: 'HM-170', v: 650},
  {sku: 'HM-200', v: 500},
];
/** SKU con reembolsos en el catálogo de ejemplo (el ranking muestra los diez primeros). */
export const SKU_TOTAL = 62;

/** Reembolsos liquidados por canal y mes. Las filas suman el total del canal, las columnas el del mes y todo suma REEMBOLSOS. */
export const CANALES: readonly {id: 'A' | 'B' | 'C'; meses: readonly [number, number, number]}[] = [
  {id: 'A', meses: [5_900, 6_200, 6_400]},
  {id: 'B', meses: [3_500, 3_700, 4_000]},
  {id: 'C', meses: [2_000, 2_100, 2_200]},
];

/** Tres problemas de ejemplo. La exposición es Inferido o Sin dato; Sin dato nunca es cero. */
export const PROBLEMAS: readonly {sev: 1 | 2 | 3; casos: number; clase: Clase}[] = [
  {sev: 3, casos: 124, clase: 'inferido'},
  {sev: 2, casos: 86, clase: 'inferido'},
  {sev: 2, casos: 41, clase: 'sindato'},
];

/** Intensidad de reembolso del SKU principal en los tres últimos meses completos, en porcentaje de las unidades vendidas, y el umbral de la regla. */
export const INTENSIDAD = {umbral: 5, meses: [6.1, 6.8, 7.4] as const};

/** Fuentes de la pantalla Confianza: el estado se dibuja por forma, no por color. */
export const FUENTES: readonly {estado: 'aldia' | 'manual'}[] = [{estado: 'aldia'}, {estado: 'manual'}, {estado: 'manual'}];

export const suma = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
export const totalCanal = (i: number): number => suma(CANALES[i].meses);
export const totalMes = (j: number): number => suma(CANALES.map((c) => c.meses[j]));
export const acumuladoPareto = (): number[] => { let a = 0; return PARETO.map((p) => (a += p.v)); };
export const REEMBOLSOS_TOP10 = PARETO.reduce((a, p) => a + p.v, 0);
export const fmt = (n: number): string => n.toLocaleString('en-US');
export const usd = (n: number): string => `${fmt(n)} ${MONEDA}`;

/** Serie diaria determinista que suma exactamente el total pedido, para las líneas de tendencia. Sin azar: el marcado es estable. */
export function serie(total: number, n: number, fase: number): number[] {
  const crudo = Array.from({length: n}, (_, i) => 1 + 0.16 * Math.sin(i * 0.42 + fase) + 0.1 * Math.sin(i * 0.17 + fase * 2) + 0.02 * i);
  const s = suma(crudo);
  const paso = total >= 10_000 ? 100 : 10;
  const v = crudo.map((x) => Math.round(((x / s) * total) / paso) * paso);
  v[n - 1] += total - suma(v);
  return v;
}
export const SERIE_INGRESO = serie(INGRESO_BRUTO, 30, 0.4);
export const SERIE_REEMBOLSOS = serie(REEMBOLSOS, 30, 2.1);

// ---------- Textos que vienen de T11 ----------
type Bi = {es: string; en: string};
const ARBOL = publicar(LANDING.mockups, {prefijo: 'mockups'}).arbol;
export const T = (lang: Lang) => proyectarArbol(ARBOL, lang) as {
  rotulo: string;
  organizacion: string;
  m1: {marco: string; boton: string; periodos: string[]; tarjetas: {t: string; v: string; clase: string}[]; atencionTitulo: string; atencion: string; siguienteTitulo: string; siguiente: string; sello: string; alt: string};
  m2: {marco: string; titular: string; grafica: string; canales: string[]; boton: string; notaBoton: string; noSe: string; alt: string};
  m3: {marco: string; filas: {t: string; sev: string; casos: string; expo: string}[]; citas: string[]; enmascarado: string; pie: string; alt: string};
  m4: {marco: string; pregunta: string; respuesta: string; tabla: {c: string; v: string}[]; sello: string; desplegable: string; pasos: string[]; notaPasos: string; sugerencias: string[]; alt: string};
  m5: {marco: string; tarjeta: string; porQue: string; evidencia: string; enJuego: string; origen: string; botones: string[]; aviso: string; alt: string};
  m6: {marco: string; indicador: string; filas: string[]; noSabemosTitulo: string; noSabemos: string[]; alt: string};
};

// ---------- Microcopia propia de las ilustraciones ----------
// Rótulos de columnas, ejes y navegación de las pantallas de ejemplo. Sin paréntesis, sin exclamaciones, sin siglas de modelos.
const UI_BI = {
  rutas: {m1: '/overview', m2: '/refunds', m3: '/problems', m4: '/preguntale', m5: '/recommendations', m6: '/connections'},
  periodo: {es: 'Periodo', en: 'Period'} as Bi,
  periodoActivo: 2, // 90 días: coherente con el trimestre de Pregúntale y con el periodo de Fuga de reembolsos
  conMarcador: {es: 'Corte de ejemplo', en: 'Example cut-off'} as Bi,
  sparkIngreso: {es: 'Últimos 30 días', en: 'Last 30 days'} as Bi,
  verPaquete: {es: 'Ver el paquete', en: 'See the package'} as Bi,
  hilo: [
    {es: 'Fuente y corte', en: 'Source and cut-off'},
    {es: 'Cifra rotulada', en: 'Labeled figure'},
    {es: 'Evidencia a la vista', en: 'Evidence in plain view'},
    {es: 'Sin dato, nunca cero', en: 'No data, never zero'},
    {es: 'Cada cifra, su origen', en: 'Every figure, its origin'},
    {es: 'Nada se envía solo', en: 'Nothing is sent on its own'},
    {es: 'Una persona decide', en: 'A person decides'},
  ] as Bi[],
  captura: {
    ejemplo: {es: 'Datos de ejemplo', en: 'Example data'} as Bi,
    devueltos: {es: 'devueltos en 90 días', en: 'returned in 90 days'} as Bi,
    ingreso: {es: 'de ingreso bruto en octubre', en: 'of gross revenue in October'} as Bi,
    ejeMarca: {es: '80 %', en: '80 %'} as Bi,
    barras: {es: 'Reembolsos por SKU, de mayor a menor', en: 'Refunds by SKU, highest to lowest'} as Bi,
    paso1: {hubspot: {es: 'HUBSPOT', en: 'HUBSPOT'}, real: {es: 'conexión real', en: 'real connection'}, exporte: {es: 'EXPORTE', en: 'EXPORT'}, aMano: {es: 'se carga a mano', en: 'uploaded by hand'}, csv: {es: 'CSV', en: 'CSV'}, corte: {es: 'corte 3 nov', en: 'cut-off 3 Nov'}} as Record<string, Bi>,
    paso2: {sueltas: {es: 'Conversaciones sueltas', en: 'Loose conversations'}, agrupadas: {es: 'Agrupadas en un problema', en: 'Grouped into one problem'}, correo: {es: 'm***@***', en: 'm***@***'}} as Record<string, Bi>,
    paso3: {cota: {es: 'Ingreso bruto expuesto · inferido · no se suma', en: 'Gross revenue exposed · inferred · not summed'}, nunca: {es: 'Nunca como pérdida', en: 'Never as a loss'}, subtotal: {es: 'subtotal conocido', en: 'known subtotal'}} as Record<string, Bi>,
    paso4: {registro: {es: 'Paquete preparado · pendiente de revisión por una persona', en: 'Package prepared · pending review by a person'}} as Record<string, Bi>,
    enEs: {es: 'Las capturas están en español; los datos son de ejemplo.', en: 'Screens are shown in Spanish; the data is example data.'} as Bi,
  },
  m2: {
    barras: {es: 'Reembolsos por SKU, de mayor a menor', en: 'Refunds by SKU, highest to lowest'} as Bi,
    acumulado: {es: 'Acumulado', en: 'Cumulative'} as Bi,
    canalTitulo: {es: 'Por canal y por mes', en: 'By channel and by month'} as Bi,
    meses: [{es: 'Mes 1', en: 'Month 1'}, {es: 'Mes 2', en: 'Month 2'}, {es: 'Mes 3', en: 'Month 3'}] as Bi[],
    total: {es: 'Total', en: 'Total'} as Bi,
    sku: {es: 'SKU', en: 'SKU'} as Bi,
    causa: {es: 'Causa', en: 'Cause'} as Bi,
  },
  m3: {
    lista: {es: 'Problemas por severidad', en: 'Problems by severity'} as Bi,
    ficha: {es: 'Citas de la ficha', en: 'Quotes on the record'} as Bi,
    exposicion: {es: 'Exposición, subtotal conocido', en: 'Exposure, known subtotal'} as Bi,
    seleccion: {es: 'Selección de ejemplo', en: 'Example selection'} as Bi,
  },
  m4: {
    pasosTitulo: {es: 'Pasos del cálculo', en: 'Calculation steps'} as Bi,
    total: {es: 'Total', en: 'Total'} as Bi,
    entrada: {es: 'Pregunta sobre tus datos', en: 'Ask about your data'} as Bi,
    reglas: {es: 'Reglas y herramientas de solo lectura', en: 'Rules and read-only tools'} as Bi,
  },
  m5: {
    porQue: {es: 'Por qué', en: 'Why'} as Bi,
    evidenciaTitulo: {es: 'Evidencia', en: 'Evidence'} as Bi,
    intensidad: {es: 'Intensidad de reembolso del SKU', en: 'SKU refund intensity'} as Bi,
    umbral: {es: 'Umbral de la regla', en: 'Rule threshold'} as Bi,
    meses: [{es: 'Mes 1', en: 'Month 1'}, {es: 'Mes 2', en: 'Month 2'}, {es: 'Mes 3', en: 'Month 3'}] as Bi[],
    enCola: {es: 'En la cola', en: 'In the queue'} as Bi,
  },
  m6: {
    fuente: {es: 'Fuente', en: 'Source'} as Bi,
    estado: {es: 'Estado', en: 'Status'} as Bi,
    leyenda: {es: 'Lo que no se sabe se dice, no se rellena', en: 'What is not known is stated, not filled in'} as Bi,
  },
};
export const UI = (lang: Lang) => ({
  rutas: UI_BI.rutas,
  periodoActivo: UI_BI.periodoActivo,
  periodo: UI_BI.periodo[lang],
  conMarcador: UI_BI.conMarcador[lang],
  sparkIngreso: UI_BI.sparkIngreso[lang],
  verPaquete: UI_BI.verPaquete[lang],
  hilo: UI_BI.hilo.map((x) => x[lang]),
  captura: {ejemplo: UI_BI.captura.ejemplo[lang], devueltos: UI_BI.captura.devueltos[lang], ingreso: UI_BI.captura.ingreso[lang], ejeMarca: UI_BI.captura.ejeMarca[lang], barras: UI_BI.captura.barras[lang], enEs: UI_BI.captura.enEs[lang],
    paso1: Object.fromEntries(Object.entries(UI_BI.captura.paso1).map(([k, v]) => [k, v[lang]])) as Record<string, string>,
    paso2: Object.fromEntries(Object.entries(UI_BI.captura.paso2).map(([k, v]) => [k, v[lang]])) as Record<string, string>,
    paso3: Object.fromEntries(Object.entries(UI_BI.captura.paso3).map(([k, v]) => [k, v[lang]])) as Record<string, string>,
    paso4: Object.fromEntries(Object.entries(UI_BI.captura.paso4).map(([k, v]) => [k, v[lang]])) as Record<string, string>},
  m2: {barras: UI_BI.m2.barras[lang], acumulado: UI_BI.m2.acumulado[lang], canalTitulo: UI_BI.m2.canalTitulo[lang], meses: UI_BI.m2.meses.map((x) => x[lang]), total: UI_BI.m2.total[lang], sku: UI_BI.m2.sku[lang], causa: UI_BI.m2.causa[lang]},
  m3: {lista: UI_BI.m3.lista[lang], ficha: UI_BI.m3.ficha[lang], exposicion: UI_BI.m3.exposicion[lang], seleccion: UI_BI.m3.seleccion[lang]},
  m4: {pasosTitulo: UI_BI.m4.pasosTitulo[lang], total: UI_BI.m4.total[lang], entrada: UI_BI.m4.entrada[lang], reglas: UI_BI.m4.reglas[lang]},
  m5: {porQue: UI_BI.m5.porQue[lang], evidenciaTitulo: UI_BI.m5.evidenciaTitulo[lang], intensidad: UI_BI.m5.intensidad[lang], umbral: UI_BI.m5.umbral[lang], meses: UI_BI.m5.meses.map((x) => x[lang]), enCola: UI_BI.m5.enCola[lang]},
  m6: {fuente: UI_BI.m6.fuente[lang], estado: UI_BI.m6.estado[lang], leyenda: UI_BI.m6.leyenda[lang]},
});

/** Nombre de la clase de cifra, en el idioma de la página. */
export const NOMBRE_CLASE: Record<Clase, Bi> = {
  observado: {es: 'Observado', en: 'Observed'},
  estimado: {es: 'Estimado', en: 'Estimated'},
  inferido: {es: 'Inferido', en: 'Inferred'},
  sindato: {es: 'Sin dato', en: 'No data'},
};
