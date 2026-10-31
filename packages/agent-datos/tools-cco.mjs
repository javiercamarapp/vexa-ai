// Seis herramientas de catálogo cerrado para las preguntas del CCO (A a F). Solo lectura de los agregados insight_cco_* a través del puerto de datos.
// Sin SQL ni texto libre: todo argumento es enumerado o acotado (validateArgs). Se corren con reglas, sin modelo de lenguaje.
// Reglas de verdad: ingreso bruto; lo desconocido no es cero; monedas sin sumar; tasas solo en la ventana común del canal; exposición inferida no es pérdida.
import { faltanTexto, bodegasConocidas, LATENCIAS } from '../workspace-service/cco.mjs';

const NOMBRE_CANAL = { amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy', shopify: 'Shopify' };
const SUBCANAL_ES = { amazon_cumplido_por_piloto: 'Amazon cumplido por el cliente piloto', amazon_cumplido_por_amazon: 'Amazon cumplido por Amazon', amazon_com: 'Amazon.com', amazon_sin_subcanal: 'Amazon sin subcanal',
  walmart_cumplido_por_piloto: 'Walmart cumplido por el cliente piloto', walmart_cumplido_por_walmart: 'Walmart cumplido por Walmart', walmart_sin_subcanal: 'Walmart sin subcanal' };
const LAT_ES = { menos_de_1_dia: 'Menos de 1 día', '1_dia': '1 día', '2_dias': '2 días', '3_o_mas_dias': '3 días o más', sin_dato: 'Sin SLA registrado' };
const TIPO_GRUPOS = { garantia: ['Garantía de herramientas', 'Garantía de piezas'], reembolso: ['Reembolsos', 'Solicitudes de reembolso'], etiqueta_devolucion: ['Etiquetas de devolución'] };
const mes = (iso) => String(iso ?? '').slice(0, 7);

const VALOR_ES = { empresa: 'La empresa', marketplace: 'El marketplace', amazon: 'Amazon', walmart: 'Walmart', sin_dato: 'Sin dato' };
const GRUPO_ES = { vende: { empresa: 'Vende la empresa', marketplace: 'Vende el marketplace', sin_dato: 'Sin dato de quién vende' }, bodega: { empresa: 'Sale de la bodega de la empresa', marketplace: 'Sale de la bodega del marketplace', sin_dato: 'Sin dato de la bodega' } };
const MENOS = 'Menos de 5';
const subcanalEs = (c) => SUBCANAL_ES[c] ?? String(c).replace(/_/g, ' ');

export function crearToolsCco(h) {
  const { fig, col, noData, unavailable, money, tag, fmtInt, monthLabel, coverageOf, SRC } = h;
  const falla = (card, tool, missing) => (card?.indisponible ? unavailable(tool, card.indisponible === 'not_installed' ? 'Los agregados del CCO todavía no están instalados; no se muestra ninguna cifra y eso no significa cero.' : undefined) : null) ?? noData('No tengo datos suficientes para esta consulta.', missing);


  // E (quién vende) y F (de qué bodega sale): MISMA evidencia, distinto eje. Son casos del Tracker, no ventas: jamás devuelven «conviene X».
  const modalidadTool = (id) => {
    const eje = id === 'E' ? 'vende' : 'bodega', name = id === 'E' ? 'casos_por_subcanal' : 'envio_propio_vs_amazon', puerto = id === 'E' ? 'ccoSubcanal' : 'ccoEnvio';
    return {
      name, label: id === 'E' ? 'Contando casos por modalidad de venta' : 'Contando casos por bodega de origen', roles: ['analyst', 'owner'], restricted: true,
      parameters: { properties: {
        retailer: { type: 'string', enum: ['todos', 'amazon', 'walmart'], default: 'todos', description: 'Marketplace.' },
        vista: { type: 'string', enum: ['modalidad', 'sku'], default: 'modalidad', description: 'Por subcanal y modalidad, o por SKU.' },
        top: { type: 'integer', minimum: 1, maximum: 10, default: 7 } } },
      description: id === 'E'
        ? 'Modalidad de venta en Amazon y Walmart según el campo Retailer: quién vende, la empresa o el marketplace. Casos, reembolsos, defectos y despacho por subcanal y por SKU. Son casos con sesgo, no ventas: no decide qué SKU vender en cada modalidad.'
        : 'Modalidad de envío en Amazon y Walmart según el campo Retailer: de qué bodega sale, la de la empresa o la del marketplace. Casos, reembolsos, defectos y despacho por subcanal y por SKU. Son casos con sesgo, no ventas ni costos: no decide desde dónde enviar.',
      reads: ['tracker_row_heads (Retailer, SKU, hoja, defecto, WH, SLA Status; k>=5)'],
      method: 'Cuenta filas del Tracker por el subcanal que declara su columna Retailer y lo traduce a quién vende, de qué bodega sale y qué marketplace con una tabla cerrada; lo que la tabla no conoce queda como Sin dato. Los pedidos cumplidos por el marketplace casi no llegan al Tracker, así que la comparación está sesgada.', source: SRC.ccoTracker,
      async run({ port }, { retailer, vista, top }) {
        const r = await port[puerto](); const card = r?.card;
        if (!card || card.indisponible) return falla(card, name, faltanTexto(id));
        if (card.estado === 'falta') return noData('No hay casos de Amazon o Walmart con subcanal visible en el Tracker, así que no tengo nada que comparar por modalidad.', faltanTexto(id));
        const subs = card.subcanales.filter((x) => retailer === 'todos' || x.marketplace === retailer).slice(0, vista === 'modalidad' ? top : card.subcanales.length);
        if (!subs.length) return noData(`Ningún subcanal de ${VALOR_ES[retailer] ?? retailer} llega al mínimo de 5 casos.`, faltanTexto(id));
        const total = card.totalCasos, mostrados = subs.reduce((a, x) => a + x.casos, 0), cov = coverageOf(vista === 'modalidad' ? mostrados : total, total);
        const f0 = fig(name, 'Casos de Amazon y Walmart con subcanal visible', fmtInt(total), total, 'observed', coverageOf(card.cobertura[0].conocido, card.cobertura[0].elegible));
        const figEjes = card.ejes.map((e) => fig(name, GRUPO_ES[eje][e.valor], fmtInt(e.casos), e.casos, 'observed', coverageOf(e.casos, total)));
        const det = card.detalleIndisponible, cnt = (n) => (det ? 'Sin dato' : n === null ? MENOS : n);
        let block;
        if (vista === 'modalidad') {
          const des = (x) => (x.despacho === null ? 'Sin dato' : x.despacho.legibles === null ? MENOS : `${x.despacho.tresODias ?? MENOS} de ${x.despacho.legibles}`);
          block = { tool: name, title: id === 'E' ? 'Casos del Tracker por subcanal y modalidad de venta' : 'Casos del Tracker por subcanal y bodega de origen',
            columns: [col('subcanal', 'Subcanal'), col('quien', id === 'E' ? 'Quién vende' : 'Bodega de origen'), col('marketplace', 'Marketplace'), col('casos', 'Casos', 'integer'), col('reembolsos', 'Reembolsos'), col('garantias', 'Garantías'), col('defectos', 'Casos de defecto'), col('despacho3', 'Despacho de 3 días o más')],
            rows: subs.map((x) => ({ subcanal: subcanalEs(x.subcanal), quien: VALOR_ES[eje === 'vende' ? x.vende : x.bodega], marketplace: VALOR_ES[x.marketplace], casos: x.casos, reembolsos: cnt(x.reembolsos), garantias: cnt(x.garantias), defectos: cnt(x.defectos), despacho3: des(x) })),
            class: 'observed', coverage: cov, truncated: subs.length < card.subcanales.filter((x) => retailer === 'todos' || x.marketplace === retailer).length, note: 'Sesgo: solo hay casos atendidos y los pedidos cumplidos por el marketplace casi no llegan al Tracker. No son ventas ni hay costos.' };
        } else {
          if (det) return noData('El detalle por SKU y modalidad todavía no está instalado; solo tengo los conteos por subcanal.', faltanTexto(id));
          const valores = card.ejes.map((e) => e.valor).filter((v) => v !== 'sin_dato' || card.skus.some((x) => x.grupos.sin_dato));
          const celda = (g) => (g ? `${g.casos} (reembolsos ${g.reembolsos ?? MENOS}, defectos ${g.defectos ?? MENOS})` : MENOS);
          const filas = card.skus.slice(0, top);
          if (!filas.length) return noData('Ningún SKU llega al mínimo de 5 casos en estas modalidades.', faltanTexto(id));
          block = { tool: name, title: id === 'E' ? 'Casos por SKU según quién vende' : 'Casos por SKU según la bodega de origen',
            columns: [col('sku', 'SKU'), ...valores.map((v) => col('g_' + v, GRUPO_ES[eje][v]))], rows: filas.map((x) => ({ sku: x.sku, ...Object.fromEntries(valores.map((v) => ['g_' + v, celda(x.grupos[v])])) })),
            class: 'observed', coverage: coverageOf(filas.reduce((a, x) => a + Object.values(x.grupos).reduce((b, g) => b + (g?.casos ?? 0), 0), 0), total), truncated: card.skus.length > filas.length,
            note: 'Sesgo: casos atendidos, no ventas. Cada cifra cuenta solo las celdas visibles de al menos 5 casos, así que es un mínimo. El detalle por SKU suma Amazon y Walmart.' };
        }
        const faltan = id === 'E' ? 'la venta por SKU y por modalidad, el costo de cumplimiento, las tarifas del marketplace y el margen' : 'la venta por SKU y por origen, el costo de envío propio, el costo de cumplimiento del marketplace y el margen';
        const ejesTxt = card.ejes.map((e) => `${GRUPO_ES[eje][e.valor]} ${fmtInt(e.casos)}`).join(', ');
        const cierre = id === 'E' ? 'no puedo decir qué SKU conviene vender como vendedor de Amazon o a través del marketplace' : 'no puedo decir desde dónde conviene enviar cada SKU, con medios propios o con el cumplimiento del marketplace';
        return {
          status: 'ok', figures: [f0, ...figEjes], blocks: [block],
          summary: `Hay ${f0.display} casos de Amazon y Walmart con subcanal visible en el Tracker ${tag(f0)}: ${ejesTxt}. Son casos atendidos con sesgo, no ventas: ${cierre}, porque faltan ${faltan}.`,
          missing: faltanTexto(id),
          notes: [...card.salvedades.includes('walmartSoloBodega') ? ['Walmart no compra producto de la empresa: solo se vende a través de Walmart, así que para Walmart solo importa de qué bodega sale el pedido.'] : [],
            'Un Retailer cuyo subcanal no se conoce queda como Sin dato; no se asigna a ninguna modalidad.', 'El único tiempo medible es el de despacho de reposiciones y etiquetas, no el tiempo de resolución del caso.',
            ...(det ? ['El detalle por modalidad todavía no está instalado: reembolsos, garantías, defectos y despacho figuran como Sin dato.'] : [])],
        };
      },
    };
  };

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
      parameters: { properties: { dimension: { type: 'string', enum: ['latencia', 'motivo'], default: 'latencia', description: 'Tiempo de despacho o motivo del caso.' }, bodega: { type: 'string', enum: bodegasConocidas(), description: 'Una bodega del catálogo cargado (configuración externa VEXA_CCO_CATALOGO, leída al iniciar). Las familias de sufijo libre no se enumeran: sin este argumento salen todas.' } } },
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
    modalidadTool('E'),
    modalidadTool('F'),
  ];
}
