// Seis herramientas de catálogo cerrado para las preguntas del CCO (A a F). Solo lectura de los agregados insight_cco_* a través del puerto de datos.
// Sin SQL ni texto libre: todo argumento es enumerado o acotado (validateArgs). Se corren con reglas, sin modelo de lenguaje.
// Reglas de verdad: ingreso bruto; lo desconocido no es cero; monedas sin sumar; tasas solo en la ventana común del canal; exposición inferida no es pérdida.
import { faltanTexto, BODEGAS, LATENCIAS } from '../workspace-service/cco.mjs';

const NOMBRE_CANAL = { amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy', shopify: 'Shopify' };
const SUBCANAL_ES = { amazon_cumplido_por_clientex: 'Amazon cumplido por CLIENTEX', amazon_cumplido_por_amazon: 'Amazon cumplido por Amazon', amazon_com: 'Amazon.com', amazon_sin_subcanal: 'Amazon sin subcanal',
  walmart_cumplido_por_clientex: 'Walmart cumplido por CLIENTEX', walmart_cumplido_por_walmart: 'Walmart cumplido por Walmart', walmart_sin_subcanal: 'Walmart sin subcanal' };
const LAT_ES = { menos_de_1_dia: 'Menos de 1 día', '1_dia': '1 día', '2_dias': '2 días', '3_o_mas_dias': '3 días o más', sin_dato: 'Sin SLA registrado' };
const TIPO_GRUPOS = { garantia: ['Garantía de herramientas', 'Garantía de piezas'], reembolso: ['Reembolsos', 'Solicitudes de reembolso'], etiqueta_devolucion: ['Etiquetas de devolución'] };
const mes = (iso) => String(iso ?? '').slice(0, 7);

export function crearToolsCco(h) {
  const { fig, col, noData, unavailable, money, tag, fmtInt, monthLabel, coverageOf, SRC } = h;
  const falla = (card, tool, missing) => (card?.indisponible ? unavailable(tool, card.indisponible === 'not_installed' ? 'Los agregados del CCO todavía no están instalados; no se muestra ninguna cifra y eso no significa cero.' : undefined) : null) ?? noData('No tengo datos suficientes para esta consulta.', missing);

  return [
    {
      name: 'rendimiento_sku', label: 'Revisando el rendimiento por SKU', roles: ['analyst', 'owner'], restricted: true,
      parameters: { properties: {
        canal: { type: 'string', enum: ['amazon', 'walmart', 'bestbuy', 'shopify'], default: 'amazon', description: 'Canal de venta.' },
        orden: { type: 'string', enum: ['venta', 'reembolso', 'defectos'], default: 'venta', description: 'Orden de los SKU: ingreso bruto, reembolsos o casos de defecto.' },
        top: { type: 'integer', minimum: 1, maximum: 10, default: 5 } } },
      description: 'Rendimiento por SKU y canal: ingreso bruto, líneas de pedido, reembolsos y casos de defecto del Tracker, dentro de la ventana común del canal. Sin unidades ni reseñas.',
      reads: ['public.insight_order_revenue_month', 'public.insight_refund_by_sku_month', 'public.economic_source_versions (ventanas)', 'tracker_row_heads (casos de defecto, k>=5)'],
      method: 'Suma líneas e ingreso bruto por SKU solo en los meses completos de la ventana común de pedidos y devoluciones del canal; las devoluciones sin importe quedan sin dato; los casos de defecto salen del Tracker con mínimo de 5 por celda.', source: SRC.ccoLibro,
      async run({ port }, { canal, orden, top }) {
        const r = await port.ccoSku(); const card = r?.card;
        if (!card || card.estado === 'falta') return falla(card, 'rendimiento_sku', ['Pedidos y devoluciones del libro con meses completos']);
        const c = card.canales.find((x) => x.canal === canal);
        if (!c) return noData(`No hay una ventana común completa de pedidos y devoluciones para ${NOMBRE_CANAL[canal]}.`, ['Fuentes de pedidos y de devoluciones del canal con al menos un mes completo']);
        const m = [...c.monedas].sort((a, b) => b.skus - a.skus || a.moneda.localeCompare(b.moneda))[0];
        if (!m || !m.top.length) return noData(`No hay SKU con venta en la ventana común de ${NOMBRE_CANAL[canal]}.`, ['Pedidos con SKU del canal en la ventana común']);
        const nulos = (v) => (v === null || v === undefined ? -1 : v);
        const sorted = [...m.top].sort(orden === 'reembolso' ? (a, b) => nulos(b.reembolsos) - nulos(a.reembolsos) || a.sku.localeCompare(b.sku) : orden === 'defectos' ? (a, b) => nulos(b.defectos) - nulos(a.defectos) || a.sku.localeCompare(b.sku) : () => 0).slice(0, top);
        const cov = coverageOf(c.lineasConSku, c.lineas);
        const first = sorted[0];
        const f1 = fig('rendimiento_sku', `Ingreso bruto de ${first.sku} en ${NOMBRE_CANAL[canal]}`, money(first.brutoMinor, m.moneda, first.exponente), first.brutoMinor, 'observed', cov, { currency: m.moneda });
        const f2 = fig('rendimiento_sku', `Líneas de pedido de ${first.sku}`, fmtInt(first.lineas), first.lineas, 'observed', cov);
        const rows = sorted.map((r) => ({ sku: r.sku, lineas: r.lineas, ingreso: money(r.brutoMinor, m.moneda, r.exponente), reembolsos: r.reembolsos === null ? 'No disponible' : r.reembolsos, por100: r.porCien === null ? 'No disponible' : r.porCien,
          reembolsado: r.reembolsos === null ? 'No disponible' : r.reembolsoMinor === null ? 'Sin importe' : money(r.reembolsoMinor, m.moneda, r.exponente), defectos: r.defectos === null ? 'Menos de 5 o sin dato' : r.defectos }));
        const v = c.ventana, otras = c.monedas.filter((x) => x.moneda !== m.moneda).map((x) => x.moneda);
        const note = [`Ventana común de ${NOMBRE_CANAL[canal]}: ${monthLabel(mes(v.desde))} a ${monthLabel(mes(v.hasta))}, ${v.meses} meses completos; las fuentes del libro están marcadas incompletas.`, `Moneda de la tabla: ${m.moneda}; las monedas no se suman${otras.length ? ` (hay también ${otras.join(', ')})` : ''}.`,
          c.devolucionesDisponibles ? null : 'Este canal no tiene fuente de devoluciones cargada: sus devoluciones son desconocidas, no cero.', 'Ingreso bruto: sin costo ni margen. Los casos de defecto son una muestra de casos atendidos en el Tracker.'].filter(Boolean).join(' ');
        return {
          status: 'ok', figures: [f1, f2],
          blocks: [{ tool: 'rendimiento_sku', title: `Rendimiento por SKU · ${NOMBRE_CANAL[canal]} · ${m.moneda}`, columns: [col('sku', 'SKU'), col('lineas', 'Líneas', 'integer'), col('ingreso', 'Ingreso bruto'), col('reembolsos', 'Reembolsos'), col('por100', 'Por cada 100 líneas'), col('reembolsado', 'Importe reembolsado'), col('defectos', 'Casos de defecto del Tracker')], rows, class: 'observed', coverage: cov, truncated: m.top.length > sorted.length, note }],
          summary: `En ${NOMBRE_CANAL[canal]}, dentro de su ventana común, el SKU con más ${orden === 'venta' ? 'ingreso bruto' : orden === 'reembolso' ? 'reembolsos' : 'casos de defecto'} entre los mostrados es ${first.sku}, con ${f1.display} brutos en ${f2.display} líneas ${tag(f1)}. No hay unidades vendidas ni reseñas positivas, así que no mido venta en unidades ni satisfacción.`,
          missing: ['Unidades vendidas por línea', 'Reseñas positivas por marketplace'], notes: [note, ...(card.ventanasDistintas ? ['Cada canal tiene su propia ventana: las tasas no se comparan entre canales.'] : [])],
        };
      },
    },
    {
      name: 'candidatos_sin_venta', label: 'Buscando SKU sin venta reciente', roles: ['analyst', 'owner'], restricted: true,
      parameters: { properties: { meses_sin_venta: { type: 'string', enum: ['3', '6', '9'], default: '3', description: 'Meses sin venta: 3, 6 o 9.' }, top: { type: 'integer', minimum: 1, maximum: 10, default: 5 } } },
      description: 'SKU de Amazon y Walmart sin venta desde hace 3, 6 o 9 meses. Es una señal inferida, no una lista de descontinuados confirmados: no hay inventario ni estado de producto.',
      reads: ['public.insight_order_revenue_month (último mes con venta por SKU)'],
      method: 'Toma el último mes con venta de cada SKU y lo compara con el último mes completo con datos del libro; un SKU sin venta en estos dos canales puede venderse en otro.', source: SRC.ccoLibro,
      async run({ port }, { meses_sin_venta: n, top }) {
        const r = await port.ccoSinVenta(); const card = r?.card;
        if (!card || card.estado === 'falta' || Array.isArray(card.top)) return falla(card, 'candidatos_sin_venta', ['Pedidos de Amazon o Walmart con SKU']);
        const um = card.umbrales.find((u) => u.meses === Number(n)); const filas = card.top[n].slice(0, top);
        const f = fig('candidatos_sin_venta', `SKU sin venta desde hace ${n} meses o más`, `${fmtInt(um.skus)} de ${fmtInt(card.total)}`, um.skus, 'inferred', coverageOf(um.skus, card.total));
        if (!filas.length) return { status: 'ok', figures: [f], blocks: [], summary: `Ningún SKU de Amazon o Walmart supera ${n} meses sin venta ${tag(f)}.`, missing: faltanTexto('B'), notes: ['Inferido: no hay inventario, ni estado de producto, ni recurrencia de compra.'] };
        return {
          status: 'ok', figures: [f],
          blocks: [{ tool: 'candidatos_sin_venta', title: `SKU sin venta desde hace ${n} meses o más`, columns: [col('sku', 'SKU'), col('ultimo', 'Último mes con venta'), col('meses', 'Meses sin venta', 'integer'), col('lineas9', 'Líneas en 9 meses', 'integer'), col('canales', 'Canales')],
            rows: filas.map((x) => ({ sku: x.sku, ultimo: monthLabel(mes(x.ultimoMes)), meses: x.mesesSinVenta, lineas9: x.lineas9m, canales: x.canales.map((c) => NOMBRE_CANAL[c]).join(', ') })), class: 'inferred', coverage: coverageOf(um.skus, card.total), truncated: um.skus > filas.length,
            note: `Inferido. Referencia: último mes completo con datos, ${monthLabel(mes(card.referencia))}. Solo Amazon y Walmart traen SKU del vendedor; un SKU sin venta aquí puede venderse en otro canal. No es una lista de descontinuados confirmados.` }],
          summary: `${fmtInt(um.skus)} de ${fmtInt(card.total)} SKU de Amazon y Walmart no tienen venta desde hace ${n} meses o más ${tag(f)}. Es una señal inferida, no una confirmación de descontinuación: no tengo inventario, estado de producto ni recurrencia de compra.`,
          missing: faltanTexto('B'), notes: ['Inferido: un SKU sin venta en estos dos canales puede seguir vendiéndose en otro.'],
        };
      },
    },
    {
      name: 'eficiencia_bodegas', label: 'Revisando el despacho por bodega', roles: ['analyst', 'owner'], restricted: true,
      parameters: { properties: { dimension: { type: 'string', enum: ['latencia', 'motivo'], default: 'latencia', description: 'Tiempo de despacho o motivo del caso.' }, bodega: { type: 'string', enum: [...BODEGAS], description: 'Una bodega del catálogo cargado.' } } },
      description: 'Casos del Tracker por bodega: latencia de despacho de reposiciones de garantía y etiquetas de devolución, o motivo del caso. No hay transportista ni total de envíos.',
      reads: ['tracker_row_heads (WH, SLA Status, Contact_reason; k>=5)'],
      method: 'Cuenta filas del Tracker con bodega por clase de tiempo hasta que salió el rastreo; celdas con menos de 5 casos se ocultan. Es despacho, no entrega, y no hay denominador de envíos.', source: SRC.ccoTracker,
      async run({ port }, { dimension, bodega }) {
        const r = await port.ccoBodegas(); const card = r?.card;
        if (!card || card.estado === 'falta') return falla(card, 'eficiencia_bodegas', faltanTexto('C'));
        const lista = card.bodegas.filter((b) => !bodega || b.bodega === bodega);
        if (!lista.length) return noData(bodega ? `No hay casos visibles de la bodega ${bodega}.` : 'Ninguna bodega tiene suficientes casos para mostrarse sin exponer personas.', faltanTexto('C'));
        const cobertura = card.cobertura?.[0]; const cov = coverageOf(cobertura?.conocido ?? 0, cobertura?.elegible ?? 0);
        const claves = dimension === 'latencia' ? [...LATENCIAS] : [...new Set(lista.flatMap((b) => Object.keys(b.motivos)))].sort();
        const etiqueta = (c) => (dimension === 'latencia' ? LAT_ES[c] : c.replace(/_/g, ' '));
        const celdas = (b) => Object.fromEntries(claves.map((c) => [c, (dimension === 'latencia' ? b.latencia : b.motivos)[c] ?? 'Menos de 5']));
        const total = lista.reduce((a, b) => a + b.total, 0);
        const f = fig('eficiencia_bodegas', 'Casos visibles con bodega', fmtInt(total), total, 'observed', cov);
        return {
          status: 'ok', figures: [f],
          blocks: [{ tool: 'eficiencia_bodegas', title: dimension === 'latencia' ? 'Tiempo de despacho por bodega' : 'Motivo del caso por bodega', columns: [col('bodega', 'Bodega'), ...claves.map((c) => col(c, etiqueta(c), 'integer'))],
            rows: lista.map((b) => ({ bodega: b.bodega, ...celdas(b) })), class: 'observed', coverage: cov, truncated: false,
            note: 'Latencia de despacho: tiempo hasta que sale el rastreo, no tiempo de entrega. Sin transportista y sin total de envíos por bodega: los conteos no son tasas. Una celda con menos de 5 casos no se muestra.' }],
          summary: `Hay ${f.display} casos del Tracker con bodega visibles ${tag(f)}. Muestro cuánto tardó en salir el rastreo por bodega; no puedo decir qué transportista es mejor porque no existe ese dato, ni calcular tasas porque no hay total de envíos por bodega.`,
          missing: faltanTexto('C'), notes: ['Solo reposiciones de garantía y etiquetas de devolución; no incluye los pedidos de marketplace.'],
        };
      },
    },
    {
      name: 'casos_por_estado', label: 'Contando casos por estado', roles: ['analyst', 'owner'], restricted: true,
      parameters: { properties: { pais: { type: 'string', enum: ['US', 'MX'], default: 'US', description: 'País del estado.' }, tipo_caso: { type: 'string', enum: ['todos', 'garantia', 'reembolso', 'etiqueta_devolucion'], default: 'todos' } } },
      description: 'Casos del Tracker por estado de EE. UU. o México, tomados de la dirección en memoria. Sin volumen de pedidos ni venta por destino. Mínimo de 5 casos por celda.',
      reads: ['tracker_row_revisions (dirección leída en memoria; el texto se descarta)'],
      method: 'Deriva el estado de la dirección de cada caso del Tracker y cuenta casos; estados con menos de 5 casos se ocultan y el texto de la dirección nunca se guarda ni se devuelve.', source: SRC.ccoGeo,
      async run({ port }, { pais, tipo_caso: tipo }) {
        const r = await port.ccoEstados(); const g = r?.vista;
        if (!g || g.status === 'unavailable') return unavailable('casos_por_estado');
        if (g.status === 'empty' || !g.cobertura) return noData('No tengo casos con dirección legible para ubicar por estado.', faltanTexto('D'));
        const grupo = tipo === 'todos' ? null : TIPO_GRUPOS[tipo];
        const filas = g.estados.filter((e) => e.pais === pais).map((e) => ({ e, n: grupo ? e.tipos.items.filter((i) => grupo.includes(i.etiqueta)).reduce((a, i) => a + i.n, 0) : e.n })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.e.nombre.localeCompare(b.e.nombre, 'es')).slice(0, 15);
        if (!filas.length) return noData(`Ningún estado de ${pais === 'US' ? 'Estados Unidos' : 'México'} llega al mínimo de 5 casos${grupo ? ' para ese tipo de caso' : ''}.`, faltanTexto('D'));
        const cov = coverageOf(g.cobertura.interpretables, g.cobertura.conDireccion);
        const f = fig('casos_por_estado', `Casos en ${filas[0].e.nombre}`, fmtInt(filas[0].n), filas[0].n, 'observed', cov);
        return {
          status: 'ok', figures: [f],
          blocks: [{ tool: 'casos_por_estado', title: `Casos por estado · ${pais === 'US' ? 'Estados Unidos' : 'México'}`, columns: [col('estado', 'Estado'), col('casos', 'Casos', 'integer')], rows: filas.map((x) => ({ estado: x.e.nombre, casos: x.n })), class: 'observed', coverage: cov, truncated: false,
            note: `Cada fila del Tracker cuenta como un caso. Estados con menos de ${g.minimoPorCelda} casos no se muestran${grupo ? '; con un tipo de caso solo se cuentan las celdas visibles, así que puede quedar por debajo del total' : ''}. Sin volumen ni venta por destino.` }],
          summary: `El estado con más casos del Tracker es ${filas[0].e.nombre}, con ${f.display} ${tag(f)}. No puedo decir dónde conviene tener bodegas: los pedidos no traen estado de destino, así que no hay volumen ni venta por estado.`,
          missing: faltanTexto('D'), notes: ['Fuente provisional: el Tracker de Excel, no todos los pedidos ni tickets.'],
        };
      },
    },
    {
      name: 'casos_por_subcanal', label: 'Contando casos por subcanal de cumplimiento', roles: ['analyst', 'owner'], restricted: true,
      parameters: { properties: { retailer: { type: 'string', enum: ['todos', 'amazon', 'walmart'], default: 'todos' }, top: { type: 'integer', minimum: 1, maximum: 10, default: 7 } } },
      description: 'Casos del Tracker por subcanal de cumplimiento de Amazon y Walmart. Con sesgo y sin ventas de denominador: no decide qué SKU vender como vendedor de Amazon o directo.',
      reads: ['tracker_row_heads (Retailer; k>=5)'],
      method: 'Cuenta filas del Tracker por el subcanal que declara su columna Retailer; los pedidos cumplidos por Amazon casi no llegan al Tracker, así que la comparación está sesgada.', source: SRC.ccoTracker,
      async run({ port }, { retailer, top }) {
        const r = await port.ccoSubcanal(); const card = r?.card;
        if (!card || card.indisponible) return falla(card, 'casos_por_subcanal', faltanTexto('E'));
        const filas = card.subcanales.filter((x) => retailer === 'todos' || x.subcanal.startsWith(retailer)).slice(0, top);
        if (!filas.length) return noData('Ningún subcanal llega al mínimo de 5 casos.', faltanTexto('E'));
        const total = card.subcanales.reduce((a, x) => a + x.n, 0), cov = coverageOf(filas.reduce((a, x) => a + x.n, 0), total);
        const f = fig('casos_por_subcanal', SUBCANAL_ES[filas[0].subcanal], fmtInt(filas[0].n), filas[0].n, 'observed', cov);
        return {
          status: 'ok', figures: [f],
          blocks: [{ tool: 'casos_por_subcanal', title: 'Casos del Tracker por subcanal de cumplimiento', columns: [col('subcanal', 'Subcanal'), col('casos', 'Casos', 'integer')], rows: filas.map((x) => ({ subcanal: SUBCANAL_ES[x.subcanal], casos: x.n })), class: 'observed', coverage: cov, truncated: false,
            note: 'Sesgo: solo hay casos atendidos y los pedidos cumplidos por Amazon casi no llegan al Tracker. No hay ventas por subcanal para usar de denominador.' }],
          summary: `El subcanal con más casos del Tracker es ${SUBCANAL_ES[filas[0].subcanal]}, con ${f.display} ${tag(f)}. Con esto no puedo decir qué SKU conviene vender como vendedor de Amazon o directo: son casos con sesgo, no ventas.`,
          missing: faltanTexto('E'), notes: ['Los casos no son ventas ni son todos los pedidos.'],
        };
      },
    },
    {
      name: 'envio_propio_vs_amazon', label: 'Revisando si hay datos para decidir desde dónde enviar', roles: ['analyst', 'owner'], restricted: true, parameters: { properties: {} },
      description: 'Qué SKU enviar con medios propios por FedEx o UPS y cuáles con el cumplimiento de Amazon. Siempre responde que no hay dato y lista exactamente qué falta y a quién pedirlo.',
      reads: ['ninguna tabla: no existen costos de envío, costo de cumplimiento ni cumplimiento por pedido'],
      method: 'No calcula nada: devuelve sin dato con la lista de lo que hay que pedir, para no inventar una recomendación.', source: SRC.ccoTracker,
      async run() {
        return noData('No tengo costo de envío propio, costo de cumplimiento de Amazon ni el tipo de cumplimiento de cada pedido, así que no hay nada que sostenga una decisión de desde dónde enviar.', faltanTexto('F'));
      },
    },
  ];
}
