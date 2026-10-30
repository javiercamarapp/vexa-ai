// Destino: apps/web/src/content/sitio/landing.ts (T11). Fuente de la narrativa de la portada de Rovaq AI, en español de México y en inglés de EE. UU.
// Cada hoja es { es, en }: las claves de los dos idiomas son las mismas por construcción (contrato K1, ver tipos.ts).
// Proyección a un idioma: proyectar(LANDING, 'es') devuelve el mismo árbol con cadenas.
// Nivel de cada hoja: PUBLICO por defecto, afirmable tal cual. MATIZ se declara con m(n, condición, hoja, extra): afirmable solo con la condición
// escrita, que no se corta del texto al maquetar. n = 0 es adyacencia (acompana); n = 1 a 13 son las verificaciones de P-D sección 5.
// Lo que exige revisión (req) o verificación (verifica) se publica solo con su aprobación atada al hash del texto, en aprobaciones.json;
// mientras no exista, se usa la hoja alterna o el campo no se publica. El cálculo vive en lib/sitio/marcadores.mjs.
// Regla editorial: sin paréntesis, sin signos de exclamación, sin emojis, sin superlativos, sin cifras reales.
// Las cadenas simples son identificadores que no se traducen, como id y mockup.
// Las cifras dentro de mockups son de ejemplo, van rotuladas y no se citan en ningún otro texto.
// Marcadores entre corchetes: [CORREO_DE_CONTACTO] y [CONTACT_EMAIL] se resuelven en el build desde SITE.contacto;
// [CORREO_DE_SEGURIDAD], [FECHA_DE_REVISION] y [RAZON_SOCIAL] bloquean la publicación de su campo mientras no se resuelvan.

import type { Bi, Nodo, Proy } from './tipos.ts';
import { m } from './ayudas.ts';

export type { Bi, Nodo, Proy } from './tipos.ts';
/** Alias de compatibilidad con el archivo del panel: una hoja bilingüe. */
export type L = Bi;

const esHoja = (n: unknown): n is Bi =>
  typeof n === 'object' && n !== null && typeof (n as Bi).es === 'string' && typeof (n as Bi).en === 'string';

export function proyectar<T extends Nodo>(nodo: T, lang: 'es' | 'en'): Proy<T> {
  const ir = (n: unknown): unknown => {
    if (typeof n === 'string') return n;
    if (esHoja(n)) return n[lang];
    if (Array.isArray(n)) return n.map(ir);
    return Object.fromEntries(Object.entries(n as object).map(([k, v]) => [k, ir(v)]));
  };
  return ir(nodo) as Proy<T>;
}

/** Las 13 condiciones de P-D sección 5. verificar = cómo se comprueba; si no se cumple = qué pasa con el texto. */
export const CONDICIONES = {
  1: { texto: 'Correo de contacto y de seguridad que reciban', verificar: 'Enviar un mensaje de prueba y recibirlo', siNo: 'Ningún botón de acceso se publica con la dirección muerta' },
  2: { texto: 'Pregúntale corre solo con reglas en producción', verificar: 'Revisar la bandera del modo con IA en producción', siNo: 'Reescribir esas cuatro piezas' },
  3: { texto: 'Extracción habilitada en la organización piloto', verificar: 'Contar extracciones en la organización piloto', siNo: 'Retirar la agrupación en problemas de la portada' },
  4: { texto: 'Migración del flujo de Acciones aplicada', verificar: 'Comparar migraciones del repositorio con la base de producción', siNo: 'Decir que el ciclo completo no está disponible' },
  5: { texto: 'Corridas exitosas del cron de HubSpot', verificar: 'Revisar el registro de corridas de las últimas semanas', siNo: 'Usar dAlterno y la respuesta sin la cifra de 5 minutos' },
  6: { texto: 'Dinero atorado viene del Tracker por carga manual', verificar: 'Hecho de producto; la condición va en el texto', siNo: 'Quitar la cifra de la tarjeta de Hoy' },
  7: { texto: 'Exposición solo con vínculos problema a pedido confirmados', verificar: 'Revisar el indicador de pedidos ligados de la organización', siNo: 'La pantalla ya dice No disponible; el texto no cambia' },
  8: { texto: 'Marketplaces entran por exporte con ayuda del equipo', verificar: 'Hecho de producto', siNo: 'Si hubiera autoservicio de exportes, se actualiza la frase' },
  9: { texto: 'HubSpot acreditado y cobertura limitada a lo que su API expone', verificar: 'Aceptación formal sobre una muestra', siNo: 'Quitar la prueba de hoy del hero' },
  10: { texto: 'Revisión de Responsable A', verificar: 'Visto bueno escrito', siNo: 'Usar tituloAlterno y retirar las respuestas' },
  11: { texto: 'Revisión de un abogado', verificar: 'Visto bueno escrito', siNo: 'Dejar los enlaces legales apagados y el texto como borrador' },
  12: { texto: 'Fecha de revisión y razón social', verificar: 'Llenar la fecha el día de la publicación y confirmar la razón social', siNo: 'El campo con marcador no se publica' },
  13: { texto: 'Nombre final de la pantalla Finanzas', verificar: 'Decisión del dueño sobre CFO o Panorama financiero', siNo: 'Usar el nombre descriptivo Finanzas, que ya está en el archivo' },
} as const;

export const LANDING = {

  // ============================================================
  // 00. CARGA. Función: dar identidad antes del contenido. El anillo se revela, cae el punto rojo, aparece la palabra y sube la cortina.
  // La portada usa etiqueta, logoAlt y omitir. clases y linea se conservan para páginas internas.
  // Con prefers-reduced-motion no hay carga: se muestra el estado final. Duración 2.4 s; el overlay se oculta por CSS a los 3.5 s si nada lo retira.
  // ============================================================
  carga: {
    etiqueta: { es: 'Cargando Rovaq AI', en: 'Loading Rovaq AI' }, // PUBLICO. aria-live polite
    logoAlt: { es: 'Logotipo de Rovaq AI: un anillo, un punto rojo y la palabra Rovaq.', en: 'Rovaq AI logo: a ring, a red dot and the word Rovaq.' }, // PUBLICO. Decorativo: el anillo se revela por máscara, cae el punto y la palabra se descubre de izquierda a derecha
    clases: [
      { es: 'Observado', en: 'Observed' },
      { es: 'Estimado', en: 'Estimated' },
      { es: 'Inferido', en: 'Inferred' },
      { es: 'Sin dato', en: 'No data' },
    ], // PUBLICO. Clases de cifra, epistemic.mjs. Se encienden una a una bajo el logo
    linea: { es: 'Cada cifra, con su evidencia a la vista.', en: 'Every figure, with its evidence in plain view.' }, // PUBLICO. Titular de reserva, posicionamiento 4.5
    omitir: { es: 'Saltar animación', en: 'Skip animation' }, // PUBLICO
  },

  // ============================================================
  // 01. BARRA DE ANUNCIO. Función: señal de conducta en el primer pixel. Sustituye al anuncio de ronda de Handle.
  // ============================================================
  anuncio: {
    texto: { es: 'Los límites del producto, dichos de frente.', en: 'The limits of the product, stated plainly.' }, // PUBLICO. Sección Lo que Rovaq no hace
    enlace: { es: 'Leer lo que Rovaq no hace', en: 'Read what Rovaq does not do' }, // PUBLICO
    href: { es: '/#limites', en: '/en#limits' },
  },

  // ============================================================
  // 02. CABECERA en píldora de vidrio. Función: orientar y ofrecer la acción en todo momento.
  // ============================================================
  nav: {
    saltar: { es: 'Saltar al contenido', en: 'Skip to content' },
    producto: {
      etiqueta: { es: 'Producto', en: 'Product' },
      resumen: { es: 'Diez pantallas, cada una responde una pregunta.', en: 'Ten screens, each one answers a question.' }, // PUBLICO. Producto 01
      items: [
        { t: { es: 'Hoy', en: 'Today' }, d: { es: 'Qué requiere atención hoy.', en: 'What needs attention today.' }, href: { es: '/producto/hoy', en: '/en/product/today' } }, // PUBLICO. /overview
        { t: { es: 'Fuga de reembolsos', en: 'Refund leakage' }, d: { es: 'Dónde se concentra el dinero devuelto.', en: 'Where returned money concentrates.' }, href: { es: '/producto/fuga-de-reembolsos', en: '/en/product/refund-leakage' } }, // PUBLICO. /refunds
        { t: { es: 'Problemas', en: 'Problems' }, d: m(3, 'Estado al 2026-10-29: problem_conversations tiene 0 filas; se redacta como capacidad. /problems, extracción habilitada', { es: 'Qué problema priorizar y con qué casos.', en: 'Which problem to prioritize and with which cases.' }), href: { es: '/producto/problemas', en: '/en/product/problems' } }, // MATIZ. /problems, extracción habilitada
        { t: { es: 'Puntos de dolor', en: 'Pain points' }, d: { es: 'Qué motivo se repite y cuánto dinero arrastra.', en: 'Which reason repeats and how much money it carries.' }, href: { es: '/producto/puntos-de-dolor', en: '/en/product/pain-points' } }, // PUBLICO. /pain-points
        { t: { es: 'Pregúntale a tus datos', en: 'Ask your data' }, d: m(2, '/preguntale, modo de reglas', { es: 'Cómo se llegó a esta cifra.', en: 'How this figure was reached.' }), href: { es: '/producto/pregunta-a-tus-datos', en: '/en/product/ask-your-data' } }, // MATIZ. /preguntale, modo de reglas
        { t: { es: 'Por decidir', en: 'To decide' }, d: m(4, '/recommendations, migración del flujo', { es: 'Qué se propone y quién decide.', en: 'What is proposed and who decides.' }), href: { es: '/producto/por-decidir', en: '/en/product/to-decide' } }, // MATIZ. /recommendations, migración del flujo
        { t: { es: 'Carga y SLA', en: 'Workload and SLA' }, d: m(9, '/workload, solo HubSpot', { es: 'A qué hora hace falta gente y cuántos hilos pasan de 24 horas.', en: 'When people are needed and how many threads pass 24 hours.' }), href: { es: '/producto/carga-y-sla', en: '/en/product/workload' } }, // MATIZ. /workload, solo HubSpot
        { t: { es: 'Confianza de los datos', en: 'Data trust' }, d: { es: 'Cuánto fiarse de una cifra.', en: 'How much to trust a figure.' }, href: { es: '/producto/confianza-de-los-datos', en: '/en/product/data-trust' } }, // PUBLICO. /confianza
        { t: { es: 'Fuentes e importaciones', en: 'Sources and imports' }, d: m(8, '/connections, /imports', { es: 'Qué está cargado y desde cuándo.', en: 'What is loaded and since when.' }), href: { es: '/producto/fuentes-e-importaciones', en: '/en/product/sources-and-imports' } }, // MATIZ. /connections, /imports
        { t: { es: 'Finanzas', en: 'Finance' }, d: { es: 'Qué dice el informe por moneda.', en: 'What the report says by currency.' }, href: { es: '/producto/finanzas', en: '/en/product/finance' } }, // PUBLICO. /cfo, nombre pendiente de decisión
      ],
    },
    casos: {
      etiqueta: { es: 'Casos de uso', en: 'Use cases' },
      items: [
        { t: { es: 'Propietario', en: 'Owner' }, d: { es: 'Configura, decide y aprueba.', en: 'Configures, decides and approves.' }, href: { es: '/casos-de-uso/propietario', en: '/en/use-cases/owner' } },
        { t: { es: 'Analista', en: 'Analyst' }, d: { es: 'Investiga, prepara y propone.', en: 'Investigates, prepares and proposes.' }, href: { es: '/casos-de-uso/analista', en: '/en/use-cases/analyst' } },
        { t: { es: 'Operador', en: 'Operator' }, d: { es: 'Ejecuta las acciones que le asignan.', en: 'Carries out the actions assigned to them.' }, href: { es: '/casos-de-uso/operador', en: '/en/use-cases/operator' } },
        { t: { es: 'Lector', en: 'Viewer' }, d: { es: 'Consulta sin riesgo de cambiar nada.', en: 'Reads with no risk of changing anything.' }, href: { es: '/casos-de-uso/lector', en: '/en/use-cases/viewer' } },
      ], // PUBLICO. capabilities.ts, menú por rol
    },
    recursos: {
      etiqueta: { es: 'Recursos', en: 'Resources' },
      items: [
        { t: { es: 'Seguridad y privacidad', en: 'Security and privacy' }, d: { es: 'Lo que existe hoy y lo que todavía no.', en: 'What exists today and what does not yet.' }, href: { es: '/seguridad-y-privacidad', en: '/en/security-and-privacy' } },
        { t: { es: 'Integraciones', en: 'Integrations' }, d: { es: 'Qué se conecta hoy y qué viene después.', en: 'What connects today and what comes next.' }, href: { es: '/integraciones', en: '/en/integrations' } },
        { t: { es: 'Hoja de ruta', en: 'Roadmap' }, d: { es: 'Dirección, sin fechas.', en: 'Direction, without dates.' }, href: { es: '/hoja-de-ruta', en: '/en/roadmap' } },
        { t: { es: 'Blog', en: 'Blog' }, d: { es: 'Notas sobre evidencia, posventa y marketplaces.', en: 'Notes on evidence, post-purchase and marketplaces.' }, href: { es: '/blog', en: '/en/blog' } },
        { t: { es: 'Acerca de', en: 'About' }, d: { es: 'Tres principios guían el producto.', en: 'Three principles guide the product.' }, href: { es: '/acerca', en: '/en/about' } },
      ], // PUBLICO. Mapa del sitio, producto 04
    },
    cta: { es: 'Solicitar acceso', en: 'Request access' },
    idioma: { es: 'ES', en: 'EN' },
    idiomaAria: { es: 'Cambiar a inglés', en: 'Switch to Spanish' },
    menuAbrir: { es: 'Abrir el menú', en: 'Open the menu' },
    menuCerrar: { es: 'Cerrar el menú', en: 'Close the menu' },
  },

  // ============================================================
  // 03. HERO. Función: gancho y promesa, con el blindaje de verdad pegado al titular. Fondo oscuro #0E0E10.
  // El titular NUNCA se maqueta sin el subtítulo y la línea de límite debajo. Donde no quepan, usar titularReserva.
  // ============================================================
  hero: {
    id: 'inicio',
    eyebrow: { es: 'Inteligencia de ingresos de posventa para negocios que venden por marketplaces', en: 'Post-purchase revenue intelligence for businesses that sell on marketplaces' }, // PUBLICO. Categoría, posicionamiento 4.3
    titulo: m(0, 'Fuga de reembolsos y Brechas para lo observado; Problemas para lo inferido. Condición: va con subtítulo y línea de límite', { es: 'Sabe cuánto dinero se te va, y por qué.', en: 'Know how much money slips away, and why.' }, { acompana: ['hero.subtitulo','hero.limite'] }), // MATIZ. Fuga de reembolsos y Brechas para lo observado; Problemas para lo inferido. Condición: va con subtítulo y línea de límite
    lineas: [
      { es: 'Sabe cuánto', en: 'Know how much' },
      { es: 'dinero se te va,', en: 'money slips away,' },
      { es: 'y por qué.', en: 'and why.' },
    ], // Mismo texto del titular partido en tres líneas para la revelación palabra por palabra
    subtitulo: m(7, 'Clases y sello en Hoy; exposición en Problemas solo con vínculos confirmados por un propietario', { es: 'Rovaq AI mide los reembolsos observados y el ingreso expuesto a cada problema, con la evidencia a la vista y cada cifra rotulada como Observada, Estimada o Inferida.', en: 'Rovaq AI measures observed refunds and the revenue exposed to each problem, with the evidence in plain view and every figure labeled Observed, Estimated or Inferred.' }), // MATIZ. Clases y sello en Hoy; exposición en Problemas solo con vínculos confirmados por un propietario
    limite: { es: 'Siempre ingreso bruto, nunca margen. La exposición es una cifra inferida, no una pérdida.', en: 'Always gross revenue, never margin. Exposure is an inferred figure, not a loss.' }, // PUBLICO. Nota de ingreso bruto en Hoy, Brechas y CFO; clase Inferido
    titularReserva: { es: 'Cada cifra, con su evidencia a la vista.', en: 'Every figure, with its evidence in plain view.' }, // PUBLICO. Para título de pestaña, tarjetas sociales y anuncios sin subtítulo
    titularBusqueda: { es: 'Ve dónde se concentra el dinero devuelto.', en: 'See where returned money concentrates.' }, // PUBLICO. Para la página de Fuga de reembolsos y búsqueda
    cta: { es: 'Solicitar acceso', en: 'Request access' }, // PUBLICO. Condición operativa: el correo debe recibir
    ctaSecundario: { es: 'Ver cómo funciona', en: 'See how it works' }, // PUBLICO. Ancla a modulos
    micro: { es: 'El acceso se solicita por correo.', en: 'Access is requested by email.' }, // PUBLICO
    pruebaDeHoy: m(9, 'Ocupa el lugar de estrellas y número de clientes; sin clientes que citar. Condición: HubSpot acreditado sobre una muestra', { es: 'Disponible hoy: HubSpot en solo lectura, y archivos de Excel y CSV.', en: 'Available today: HubSpot, read-only, and Excel and CSV files.' }, { verifica: 9 }), // MATIZ. Ocupa el lugar de estrellas y número de clientes; sin clientes que citar. Condición: HubSpot acreditado sobre una muestra
    rotulo: { es: 'Datos de ejemplo. No son de un cliente.', en: 'Example data. Not from a customer.' }, // PUBLICO. Visible en cada ilustración
    scroll: { es: 'Desplázate para seguir', en: 'Scroll to continue' }, // PUBLICO. Señal de scroll
  },

  // ============================================================
  // 04. PUENTE. Función: cambio de lectura del titular a la tesis. Segundo titular y cuatro reglas en columnas (S1, p de 0.62 a 1).
  // H2 visible: tituloAlterno. puente.titulo, con la palabra insight, queda en el archivo pendiente de Responsable A y no se renderiza. No hay logos ni orbes.
  // ============================================================
  puente: {
    etiqueta: { es: 'Las reglas del producto', en: 'The rules of the product' }, // PUBLICO. Mono, mayúsculas por CSS
    titulo: m(10, 'Compara con una categoría, no con una marca. Revisión de Responsable A', { es: 'Lo que otros llaman insight, aquí se llama cifra con evidencia.', en: 'What others call an insight, here is a figure with evidence.' }, { req: ['responsable_a'], alterno: 'puente.tituloAlterno' }), // MATIZ. Compara con una categoría, no con una marca. Revisión de Responsable A
    tituloAlterno: m(7, 'Si Responsable A la juzga agresiva. Exposición solo con vínculos confirmados', { es: 'Cada problema, con su ingreso expuesto y su evidencia.', en: 'Every problem, with its exposed revenue and its evidence.' }), // MATIZ. Si Responsable A la juzga agresiva. Exposición solo con vínculos confirmados
    texto: m(7, 'Problemas y Confianza. Cambio del guardián: ingreso expuesto en lugar de monto, para no sugerir una pérdida', { es: 'Un tema repetido no es lo mismo que un tema que cuesta. Rovaq pone al lado de cada problema su ingreso expuesto, de dónde sale, hasta qué fecha llega y lo que todavía no se sabe.', en: 'A repeated theme is not the same as a theme that costs. Rovaq puts beside each problem its exposed revenue, where it comes from, the date it reaches and what is still unknown.' }), // MATIZ. Problemas y Confianza. Cambio del guardián: ingreso expuesto en lugar de monto, para no sugerir una pérdida
    cta: { es: 'Solicitar acceso', en: 'Request access' },
    reglas: [
      { es: 'Ingreso bruto, nunca margen.', en: 'Gross revenue, never margin.' }, // PUBLICO. Hoy, Brechas, CFO
      { es: 'Lo desconocido dice Sin dato, nunca cero.', en: 'What is unknown says No data, never zero.' }, // PUBLICO. Clase Sin dato
      { es: 'Monedas separadas, sin conversión.', en: 'Currencies kept apart, never converted.' }, // PUBLICO. CFO, ADAPTER.md
      { es: 'Una persona decide cada acción.', en: 'A person decides every action.' }, // PUBLICO. Acciones, nada se envía solo
    ],
  },

  // ============================================================
  // 05. EL PROBLEMA. Función: nombrar el dolor en términos del comprador. Titular que se ilumina palabra por palabra, cuatro columnas numeradas con ilustración.
  // Fondo claro #F7F7F8. La palabra resaltada no se colorea: al terminar la frase llega a --text y el resto baja a --muted. Un solo rojo en la sección, la marca de corte de la columna 2.
  // ============================================================
  problema: {
    id: 'problema',
    etiqueta: { es: 'El problema', en: 'The problem' }, // PUBLICO
    titulo: { es: 'La información que explica la fuga de ingreso está repartida.', en: 'The information that explains your revenue leaks is scattered.' }, // PUBLICO. README, El problema
    resaltada: { es: 'repartida', en: 'scattered' },
    apoyo: { es: 'Y nadie la cruza.', en: 'And nobody connects it.' }, // PUBLICO
    columnas: [
      {
        n: { es: '01', en: '01' },
        t: { es: 'Tres lugares, ninguna vista', en: 'Three places, no single view' },
        d: { es: 'Las conversaciones viven en una herramienta de soporte, los pedidos y reembolsos en cada marketplace, y los reportes en hojas de cálculo.', en: 'Conversations sit in a support tool, orders and refunds in each marketplace, and reports in spreadsheets.' }, // PUBLICO. README, El problema
        alt: { es: 'Diagrama de línea: tres grupos de nodos separados, uno por cada herramienta.', en: 'Line diagram: three separate groups of nodes, one for each tool.' },
      },
      {
        n: { es: '02', en: '02' },
        t: { es: 'Una fuga silenciosa', en: 'A silent leak' },
        d: { es: 'Los reembolsos que se pueden reclamar y no se reclaman son una fuga silenciosa. Sin verlos por canal y por producto, no hay dónde actuar.', en: 'Refunds that could be claimed and are not make a silent leak. Without seeing them by channel and by product, there is nowhere to act.' }, // PUBLICO. README; pantalla Fuga de reembolsos
        alt: { es: 'Diagrama de línea: una conexión interrumpida con una marca en el punto de corte.', en: 'Line diagram: a broken connection with a mark at the cut.' },
      },
      {
        n: { es: '03', en: '03' },
        t: { es: 'Un plazo que se vence', en: 'A deadline that passes' },
        d: { es: 'Los tiempos de respuesta incumplidos se notan cuando el cliente ya se quejó. Saber a qué hora llegan los hilos permite poner gente a tiempo.', en: 'Missed response times show up after the customer has already complained. Knowing when threads arrive makes it possible to staff in time.' }, // PUBLICO. README; pantalla Carga y SLA
        alt: { es: 'Diagrama de línea: una línea de tiempo con una marca después del plazo.', en: 'Line diagram: a timeline with a mark past the deadline.' },
      },
      {
        n: { es: '04', en: '04' },
        t: { es: 'Cifras que se leen como hechos', en: 'Figures that read as facts' },
        d: { es: 'Los reportes en hoja de cálculo suelen mezclar monedas, tratar el dato faltante como cero y presentar estimaciones como hechos.', en: 'Spreadsheet reports often mix currencies, treat missing data as zero and present estimates as facts.' }, // PUBLICO. README; contrasta con las reglas de CFO y de clases
        alt: { es: 'Diagrama de línea: cuatro nodos y una cifra sin ninguna etiqueta de clase.', en: 'Line diagram: four nodes and a figure with no class label.' },
      },
    ],
  },

  // ============================================================
  // 06. PROCEDENCIA. Función: mostrar el mecanismo de confianza. Equivale al bloque System of Record de Handle.
  // Diagrama: fuentes, libro de la organización, tu equipo. Interruptor Antes y Con Rovaq. Fondo oscuro.
  // ============================================================
  procedencia: {
    id: 'procedencia',
    etiqueta: { es: 'Procedencia', en: 'Provenance' },
    titulo: { es: 'Cada dato entra con su procedencia.', en: 'Every record comes in with its provenance.' }, // PUBLICO. Ingesta, 02 sección 3
    texto: { es: 'Trae conversaciones de HubSpot y pedidos o reembolsos en archivos de Excel y CSV. Cada registro conserva su fuente, su fecha de lectura y su huella de contenido.', en: 'Bring in HubSpot conversations and orders or refunds in Excel and CSV files. Every record keeps its source, its read date and its content fingerprint.' }, // PUBLICO. packages/ingestion, connectors
    fuentes: [
      { n: { es: 'HubSpot', en: 'HubSpot' }, estado: m(9, 'Solo lectura, alta con el equipo', { es: 'Disponible hoy', en: 'Available today' }) }, // MATIZ. Solo lectura, alta con el equipo
      { n: { es: 'Excel', en: 'Excel' }, estado: { es: 'Disponible hoy', en: 'Available today' } }, // PUBLICO. Importaciones
      { n: { es: 'CSV', en: 'CSV' }, estado: { es: 'Disponible hoy', en: 'Available today' } }, // PUBLICO. Importaciones
      { n: { es: 'Amazon', en: 'Amazon' }, estado: m(8, 'Conector en hoja de ruta', { es: 'Por exporte', en: 'By export' }) }, // MATIZ. Conector en hoja de ruta
      { n: { es: 'Walmart', en: 'Walmart' }, estado: m(8, 'Conector en hoja de ruta', { es: 'Por exporte', en: 'By export' }) }, // MATIZ. Conector en hoja de ruta
      { n: { es: 'Shopify', en: 'Shopify' }, estado: m(8, 'Conector en hoja de ruta', { es: 'Por exporte', en: 'By export' }) }, // MATIZ. Conector en hoja de ruta
    ],
    leyenda: { es: 'Por exporte: hoy se carga el archivo, con ayuda de nuestro equipo. El conector directo está en hoja de ruta.', en: 'By export: today the file is loaded, with help from our team. The direct connector is on the roadmap.' }, // PUBLICO. providers.mjs con transporte apagado
    nucleo: { es: 'Libro de tu organización', en: 'Your organization ledger' },
    nucleoNota: { es: 'Solo inserción. Una corrección agrega una revisión y no borra.', en: 'Insert-only. A correction adds a revision and deletes nothing.' }, // PUBLICO. ADAPTER.md, ledger de solo inserción
    equipo: { es: 'Tu equipo', en: 'Your team' },
    equipoNota: { es: 'Cuatro puestos, cada uno con su vista.', en: 'Four roles, each with its own view.' }, // PUBLICO. capabilities.ts
    campos: [
      { es: 'Fuente', en: 'Source' },
      { es: 'Fecha de lectura', en: 'Read date' },
      { es: 'Huella de contenido', en: 'Content fingerprint' },
    ], // PUBLICO
    cuarentena: { es: 'Un registro inválido va a cuarentena con su motivo. No se descarta en silencio ni cuenta como éxito.', en: 'An invalid record goes to quarantine with its reason. It is not silently dropped and does not count as a success.' }, // PUBLICO. estado.mjs, cuarentena con código
    antes: { etiqueta: { es: 'Antes', en: 'Before' }, texto: { es: 'Cada herramienta con su versión de la cifra.', en: 'Each tool with its own version of the figure.' } },
    con: { etiqueta: { es: 'Con Rovaq', en: 'With Rovaq' }, texto: { es: 'Una cifra con su clase, su fuente y su fecha de corte.', en: 'One figure with its class, its source and its cut-off date.' } }, // PUBLICO. Sello de cuatro campos
    enlace: { es: 'Ver fuentes e importaciones', en: 'See sources and imports' },
    href: { es: '/producto/fuentes-e-importaciones', en: '/en/product/sources-and-imports' },
  },

  // ============================================================
  // 07. CUATRO CLASES DE CIFRA. Función: el diferenciador, explicado como regla. Cuatro columnas con la palabra de la clase en grande.
  // Los sellos se distinguen por patrón, signo y posición, no por color. Sin dato va vacío y con borde discontinuo, porque no es cero. En la portada la explicación de las cuatro clases vive en la sección Cada cifra.
  // ============================================================
  clases: {
    id: 'clases',
    etiqueta: { es: 'Clases de cifra', en: 'Figure classes' },
    titulo: { es: 'Cuatro clases de cifra y una sola regla.', en: 'Four classes of figure and a single rule.' }, // PUBLICO. epistemic.mjs
    items: [
      {
        nombre: { es: 'Observado', en: 'Observed' },
        d: { es: 'Registrado en la fuente, como pedidos y reembolsos liquidados.', en: 'Recorded at the source, such as orders and settled refunds.' },
        sello: { es: 'Observado. Libro de ejemplo. Corte de ejemplo. Actualizado hace unos minutos.', en: 'Observed. Example ledger. Example cut-off. Updated a few minutes ago.' },
      },
      {
        nombre: { es: 'Estimado', en: 'Estimated' },
        d: { es: 'Calculado con un modelo o con supuestos que defines tú. No es un hecho registrado.', en: 'Calculated with a model or with assumptions you define. It is not a recorded fact.' },
        sello: { es: 'Estimado. Supuestos de ejemplo. Corte de ejemplo. Actualizado hace unos minutos.', en: 'Estimated. Example assumptions. Example cut-off. Updated a few minutes ago.' },
      },
      {
        nombre: { es: 'Inferido', en: 'Inferred' },
        d: { es: 'Vinculado por evidencia, como el ingreso de pedidos ligados a un problema. No equivale a pérdida y no se suma entre problemas.', en: 'Linked by evidence, such as the revenue of orders tied to a problem. It is not a loss and is not added across problems.' },
        sello: { es: 'Inferido. Vínculos de ejemplo. Corte de ejemplo. Actualizado hace unos minutos.', en: 'Inferred. Example links. Example cut-off. Updated a few minutes ago.' },
      },
      {
        nombre: { es: 'Sin dato', en: 'No data' },
        d: { es: 'No hay registros elegibles. Nunca se muestra como cero.', en: 'There are no eligible records. It is never shown as zero.' },
        sello: { es: 'Sin dato. Fuente de ejemplo. Corte desconocido. Sin hora de actualización.', en: 'No data. Example source. Cut-off unknown. No update time.' },
      },
    ], // PUBLICO las cuatro. Nota: la insignia vacía de la interfaz dice Sin datos en plural; el nombre de la clase es Sin dato
    reglaEtiqueta: { es: 'La regla', en: 'The rule' },
    regla: { es: 'Bajo cada cifra importante va su sello: clase, fuente, fecha de corte y antigüedad. Si no se sabe la fecha de corte, el sello lo dice.', en: 'Under every important figure goes its seal: class, source, cut-off date and age. If the cut-off date is unknown, the seal says so.' }, // PUBLICO. Sello de cuatro campos
    campos: [
      { es: 'Clase', en: 'Class' },
      { es: 'Fuente', en: 'Source' },
      { es: 'Corte', en: 'Cut-off' },
      { es: 'Actualizado', en: 'Updated' },
    ],
    enlace: { es: 'Ver la confianza de los datos', en: 'See data trust' },
    href: { es: '/producto/confianza-de-los-datos', en: '/en/product/data-trust' },
  },

  // ============================================================
  // 07b. VALOR Y SELLOS (S4). Función: mostrar la regla antes del producto. Ventana M1 Hoy con cota hacia un sello expandido.
  // Debajo, las cuatro clases de cifra de clases.items y la regla de clases.regla.
  // ============================================================
  valor: {
    id: 'valor',
    etiqueta: { es: 'Cada cifra', en: 'Every figure' },
    titulo: { es: 'Cada cifra dice de dónde viene.', en: 'Every figure says where it comes from.' }, // PUBLICO. Sello de cuatro campos
    cotaAlt: { es: 'Cota que une la cifra Ingreso bruto de la ventana con su sello expandido: clase, fuente, corte y antigüedad.', en: 'Dimension line joining the Gross revenue figure in the window to its expanded seal: class, source, cut-off and age.' },
    toque: { es: 'Toca una cifra para ver su sello.', en: 'Tap a figure to see its seal.' }, // Móvil: hoja inferior
  },

  // ============================================================
  // 07c. HILO (S3 a S10). Siete notas mono junto a los nodos de la línea que se dibuja con el scroll.
  // ============================================================
  hilo: {
    notas: [
      { es: 'Fuentes dispersas', en: 'Scattered sources' },
      { es: 'Cada cifra con su sello', en: 'Every figure with its seal' },
      { es: 'Importa, agrupa, cuantifica, decide', en: 'Import, group, quantify, decide' },
      { es: 'Una pregunta por pantalla', en: 'One question per screen' },
      { es: 'Lo que existe y lo que no', en: 'What exists and what does not' },
      { es: 'Todas las respuestas con fuente', en: 'Every answer with its source' },
      { es: 'Solicita acceso', en: 'Request access' },
    ], // PUBLICO. Las mayúsculas las pone el CSS
  },

  // ============================================================
  // 08. CUATRO MÓDULOS. Función: la sección que en Handle son los agentes. Aquí son módulos reales que preparan y proponen; no actúan solos.
  // Escena fija de cuatro pasos, uno por módulo, con su objeto y su mockup. Cada paso tiene exactamente 20 palabras en cada idioma.
  // ============================================================
  modulos: {
    id: 'modulos',
    etiqueta: { es: 'Cómo funciona', en: 'How it works' },
    titulo: { es: 'Cuatro módulos, y una persona que decide.', en: 'Four modules, and a person who decides.' }, // PUBLICO
    tituloEscena: { es: 'De los datos dispersos a la decisión, en cuatro pasos.', en: 'From scattered data to a decision, in four steps.' }, // PUBLICO. P3 S6
    apoyo: { es: 'Cada módulo hace una parte del trabajo con tus datos. No son agentes autónomos: proponen y preparan, y una persona aprueba cada acción.', en: 'Each module does one part of the work with your data. They are not autonomous agents: they propose and prepare, and a person approves every action.' }, // PUBLICO. Acciones, nada se envía solo; interventions OPERATIONS.md
    contador: [
      { es: 'Paso 1 de 4', en: 'Step 1 of 4' },
      { es: 'Paso 2 de 4', en: 'Step 2 of 4' },
      { es: 'Paso 3 de 4', en: 'Step 3 of 4' },
      { es: 'Paso 4 de 4', en: 'Step 4 of 4' },
    ],
    siguiente: { es: 'Siguiente paso', en: 'Next step' },
    anterior: { es: 'Paso anterior', en: 'Previous step' },
    respaldoSinMovimiento: { es: 'Cuatro pasos: importar con procedencia, agrupar en problemas, cuantificar en ingreso bruto, decidir y medir.', en: 'Four steps: import with provenance, group into problems, quantify in gross revenue, decide and measure.' }, // PUBLICO. Para versión estática y lectores de pantalla
    items: [
      {
        etiqueta: { es: 'Módulo 01', en: 'Module 01' },
        nombre: { es: 'Importación', en: 'Import' },
        titulo: { es: 'Importa con procedencia', en: 'Import with provenance' },
        texto: m(8, 'Fuentes conectadas e Importaciones. Condición: los marketplaces entran por exportes con ayuda de nuestro equipo', { es: 'Trae conversaciones de HubSpot y pedidos o reembolsos en Excel y CSV. Cada registro conserva su fuente y su corte.', en: 'Bring in HubSpot conversations and orders or refunds from Excel and CSV. Every record keeps its source and cut-off date.' }), // MATIZ. Fuentes conectadas e Importaciones. Condición: los marketplaces entran por exportes con ayuda de nuestro equipo
        limite: { es: 'Los marketplaces entran por exporte, con ayuda de nuestro equipo.', en: 'Marketplaces come in by export, with help from our team.' }, // PUBLICO. providers.mjs con transporte apagado
        pantallas: [
          { t: { es: 'Fuentes e importaciones', en: 'Sources and imports' }, href: { es: '/producto/fuentes-e-importaciones', en: '/en/product/sources-and-imports' } },
          { t: { es: 'Confianza de los datos', en: 'Data trust' }, href: { es: '/producto/confianza-de-los-datos', en: '/en/product/data-trust' } },
        ],
        mockup: 'm6',
      },
      {
        etiqueta: { es: 'Módulo 02', en: 'Module 02' },
        nombre: { es: 'Problemas', en: 'Problems' },
        titulo: { es: 'Agrupa en problemas', en: 'Group into problems' },
        texto: m(3, 'Estado al 2026-10-29: problem_conversations tiene 0 filas; se redacta como capacidad, con vínculos confirmados. Problemas y Puntos de dolor. Condición: extracción habilitada en la organización', { es: 'Cada problema presenta su volumen y evidencia cuando hay vínculos confirmados. Correos y teléfonos salen enmascarados. Ves qué se repite.', en: 'Each problem shows its volume and evidence when links are confirmed. Emails and phone numbers are masked. See what repeats.' }), // MATIZ. Problemas y Puntos de dolor. Condición: extracción habilitada en la organización
        limite: m(3, 'EXTRACTION-RUNTIME.md, apagada salvo habilitación', { es: 'La agrupación con modelos de IA se habilita por organización.', en: 'Grouping with AI models is enabled per organization.' }), // MATIZ. EXTRACTION-RUNTIME.md, apagada salvo habilitación
        pantallas: [
          { t: { es: 'Problemas', en: 'Problems' }, href: { es: '/producto/problemas', en: '/en/product/problems' } },
          { t: { es: 'Puntos de dolor', en: 'Pain points' }, href: { es: '/producto/puntos-de-dolor', en: '/en/product/pain-points' } },
        ],
        mockup: 'm3',
      },
      {
        etiqueta: { es: 'Módulo 03', en: 'Module 03' },
        nombre: { es: 'Exposición', en: 'Exposure' },
        titulo: { es: 'Cuantifica en ingreso bruto', en: 'Quantify in gross revenue' },
        texto: m(7, 'Fuga de reembolsos y Problemas. Condición: exposición solo con vínculos problema a pedido confirmados por un propietario', { es: 'Cada problema muestra ingreso bruto expuesto, rotulado Inferido y nunca como pérdida. Cada cifra lleva su clase, fuente y corte.', en: 'Each problem shows exposed gross revenue, labeled Inferred and never as a loss. Every figure carries class, source and cut-off.' }), // MATIZ. Fuga de reembolsos y Problemas. Condición: exposición solo con vínculos problema a pedido confirmados por un propietario
        limite: { es: 'La exposición se calcula solo con los vínculos entre problema y pedido que un propietario confirmó.', en: 'Exposure is calculated only with the problem-to-order links that an owner confirmed.' }, // PUBLICO. EXPOSURE.md, agent-datos CONTRACT.md
        pantallas: [
          { t: { es: 'Fuga de reembolsos', en: 'Refund leakage' }, href: { es: '/producto/fuga-de-reembolsos', en: '/en/product/refund-leakage' } },
          { t: { es: 'Finanzas', en: 'Finance' }, href: { es: '/producto/finanzas', en: '/en/product/finance' } },
        ],
        mockup: 'm2',
      },
      {
        etiqueta: { es: 'Módulo 04', en: 'Module 04' },
        nombre: { es: 'Acciones', en: 'Actions' },
        titulo: { es: 'Decide y mide', en: 'Decide and measure' },
        texto: m(4, 'Por decidir y En curso y resultados. Condición: migración del flujo de Acciones aplicada; la medición usa solo dato observado', { es: 'Cada recomendación trae su evidencia. Una persona decide: Proceder, Ajustar o Descartar. Nada se envía solo; el resultado se registra.', en: 'Each recommendation brings its evidence. A person decides: Proceed, Adjust or Dismiss. Nothing is sent automatically; the outcome is recorded.' }), // MATIZ. Por decidir y En curso y resultados. Condición: migración del flujo de Acciones aplicada; la medición usa solo dato observado
        limite: { es: 'Proceder crea la intervención y borradores que una persona revisa y envía.', en: 'Proceed creates the intervention and drafts that a person reviews and sends.' }, // PUBLICO. interventions OPERATIONS.md
        pantallas: [
          { t: { es: 'Por decidir', en: 'To decide' }, href: { es: '/producto/por-decidir', en: '/en/product/to-decide' } },
          { t: { es: 'Hoy', en: 'Today' }, href: { es: '/producto/hoy', en: '/en/product/today' } },
        ],
        mockup: 'm5',
      },
    ],
    enlaceLimites: { es: 'Ver lo que Rovaq no hace', en: 'See what Rovaq does not do' },
  },

  // ============================================================
  // 09. LO QUE CAMBIA. Función: beneficio sin cifras de resultado. Equivale al bloque de impacto de Handle, con cambios de método.
  // Transición a fondo claro. Cuatro bloques de dos columnas: etiqueta mono, título serif, párrafo.
  // ============================================================
  cambios: {
    id: 'cambios',
    etiqueta: { es: 'Lo que cambia', en: 'What changes' },
    titulo: { es: 'Lo que cambia es que cada número se puede discutir.', en: 'What changes is that every number can be debated.' }, // PUBLICO. Principio del producto
    items: [
      {
        etiqueta: { es: 'Cifras', en: 'Figures' },
        t: { es: 'Una cifra que se puede rastrear', en: 'A figure you can trace' },
        d: { es: 'Cada cifra importante trae su clase, su fuente, su fecha de corte y su antigüedad. Quien la lee puede ver de dónde sale.', en: 'Every important figure carries its class, its source, its cut-off date and its age. Whoever reads it can see where it comes from.' }, // PUBLICO. Sello de cuatro campos
      },
      {
        etiqueta: { es: 'Reembolsos', en: 'Refunds' },
        t: { es: 'Un paquete de evidencia a la mano', en: 'An evidence package at hand' },
        d: m(8, 'Fuga de reembolsos. Condición: datos de marketplaces por exporte cargado', { es: 'Ves qué canal y qué producto concentran el dinero devuelto y descargas el paquete. Tú lo revisas y lo presentas.', en: 'You see which channel and product concentrate returned money and download the package. You review it and you file it.' }), // MATIZ. Fuga de reembolsos. Condición: datos de marketplaces por exporte cargado
      },
      {
        etiqueta: { es: 'Problemas', en: 'Problems' },
        t: { es: 'Una prioridad con evidencia', en: 'A priority with evidence' },
        d: m(3, 'Estado al 2026-10-29: problem_conversations tiene 0 filas; se redacta como capacidad. Problemas. Condición: extracción habilitada; exposición solo con vínculos', { es: 'Cada problema se presenta con su volumen, sus citas enmascaradas y su exposición cuando hay vínculos confirmados. Un tema repetido no es un tema que cuesta.', en: 'Each problem is presented with its volume, its masked quotes and its exposure when links are confirmed. A repeated theme is not a theme that costs.' }), // MATIZ. Problemas. Condición: extracción habilitada; exposición solo con vínculos
      },
      {
        etiqueta: { es: 'Reportes', en: 'Reports' },
        t: { es: 'Un reporte que se puede auditar', en: 'A report you can audit' },
        d: { es: 'Exporta las cifras del periodo en CSV o PDF, con las mismas cifras de la pantalla y cada una con su fuente y su corte.', en: 'Export the figures of the period as CSV or PDF, with the same figures as the screen and each one with its source and cut-off.' }, // PUBLICO. CFO, informe CSV y PDF; solo propietario y analista
      },
    ],
    nota: { es: 'Son cambios de método. No publicamos cifras de ahorro, retorno ni recuperación.', en: 'These are changes of method. We do not publish figures of savings, return or recovery.' }, // PUBLICO. Regla del dueño
  },

  // ============================================================
  // 10. POR PUESTO. Función: el comprador se ve a sí mismo en el producto. Equivale a Clientes de Handle, sin clientes ni cifras.
  // Arco con cuatro pestañas y cápsula central. Al cambiar de pestaña el arco gira y el texto entra con desenfoque.
  // ============================================================
  puestos: {
    id: 'puestos',
    etiqueta: { es: 'Casos de uso', en: 'Use cases' },
    titulo: { es: 'Cada puesto ve lo que le corresponde.', en: 'Each role sees what belongs to it.' }, // PUBLICO. capabilities.ts
    capsulaAlt: { es: 'Cápsula de vidrio negro con borde fino que lleva el nombre del puesto elegido.', en: 'Black glass capsule with a thin border that carries the name of the chosen role.' },
    items: [
      {
        t: { es: 'Propietario', en: 'Owner' },
        d: { es: 'Configura, decide y aprueba. Administra equipo, avisos y retención.', en: 'Configures, decides and approves. Manages team, notices and retention.' },
        ve: { es: 'Todas las pantallas, el equipo, los avisos y la retención.', en: 'All screens, the team, notices and retention.' },
        href: { es: '/casos-de-uso/propietario', en: '/en/use-cases/owner' },
      },
      {
        t: { es: 'Analista', en: 'Analyst' },
        d: { es: 'Investiga, prepara y propone. Ve dinero e importa archivos.', en: 'Investigates, prepares and proposes. Sees money and imports files.' },
        ve: { es: 'Dinero, problemas, puntos de dolor e importaciones. Propone y no aprueba.', en: 'Money, problems, pain points and imports. Proposes and does not approve.' },
        href: { es: '/casos-de-uso/analista', en: '/en/use-cases/analyst' },
      },
      {
        t: { es: 'Operador', en: 'Operator' },
        d: { es: 'Ejecuta las acciones que le asignan. Ve problemas y acciones, sin cifras de dinero.', en: 'Carries out the actions assigned to them. Sees problems and actions, without money figures.' },
        ve: { es: 'Problemas, acciones asignadas y evidencia. Sin cifras de dinero.', en: 'Problems, assigned actions and evidence. No money figures.' },
        href: { es: '/casos-de-uso/operador', en: '/en/use-cases/operator' },
      },
      {
        t: { es: 'Lector', en: 'Viewer' },
        d: { es: 'Consulta en solo lectura, sin riesgo de cambiar nada.', en: 'Reads with read-only access, with no risk of changing anything.' },
        ve: { es: 'Las pantallas que le corresponden, sin poder modificar datos, conexiones ni decisiones.', en: 'The screens that apply to them, unable to modify data, connections or decisions.' },
        href: { es: '/casos-de-uso/lector', en: '/en/use-cases/viewer' },
      },
    ], // PUBLICO las cuatro. Matriz de capacidades; no se afirma qué datos personales ve el lector, candidato RLS-01 abierto
    lideres: {
      titulo: { es: 'Finanzas y experiencia del cliente leen el mismo problema: el dinero que se devuelve y la razón por la que se devuelve.', en: 'Finance and customer experience read the same problem: the money that is returned and the reason it is returned.' }, // PUBLICO. Dos ángulos, sin cifras de correlación
      finanzas: {
        t: { es: 'Finanzas', en: 'Finance' },
        d: m(7, 'Exposición solo con vínculos problema a pedido confirmados por un propietario; sin ellos la pantalla dice No disponible', { es: 'Quien responde por el ingreso expuesto y los reembolsos ve cuánto dinero se devuelve por canal, producto y mes, con cada cifra rotulada por su clase, su fuente y su corte.', en: 'Whoever answers for exposed revenue and refunds sees how much money is returned by channel, product and month, with every figure labeled by class, source and cut-off.' }),
        href: { es: '/producto/fuga-de-reembolsos', en: '/en/product/refund-leakage' },
      },
      cx: {
        t: { es: 'Experiencia del cliente', en: 'Customer experience' },
        d: m(0, 'Va junto a su salvedad: hoy solo responde con salvedad el rendimiento por SKU y los casos por estado; lo demás requiere datos adicionales que no están cargados', { es: 'Quien responde por los problemas, los puntos de dolor y la atención ve qué motivo se repite y cuánto dinero arrastra, junto a Puntos de dolor.', en: 'Whoever answers for problems, pain points and support sees which reason repeats and how much money it carries, next to Pain points.' }, { acompana: ['puestos.lideres.cx.salvedad'] }),
        salvedad: { es: 'Hoy responde con salvedad el rendimiento por SKU y los casos por estado. Lo demás requiere datos adicionales que todavía no están cargados.', en: 'Today it answers, with caveats, performance by SKU and cases by state. Anything else requires additional data that is not loaded yet.' },
        href: { es: '/producto/puntos-de-dolor', en: '/en/product/pain-points' },
      },
    },
    enlaceItem: { es: 'Ver el puesto', en: 'See the role' },
    cierre: { es: 'La autorización se decide en el servidor. Ocultar un elemento del menú no protege una pantalla.', en: 'Authorization is decided on the server. Hiding a menu item does not protect a screen.' }, // PUBLICO. Producto 01, regla del menú
  },

  // ============================================================
  // 11. SEIS PANTALLAS. Función: la demostración. Handle muestra un video; Rovaq muestra sus pantallas con datos de ejemplo, rotuladas.
  // Tarjeta de producto grande con pestañas y los seis mockups. Un mockup por pantalla.
  // ============================================================
  pantallas: {
    id: 'pantallas',
    etiqueta: { es: 'Producto', en: 'Product' },
    titulo: { es: 'Seis pantallas, cada una con una pregunta que responde.', en: 'Six screens, each built to answer one question.' }, // PUBLICO
    apoyo: { es: 'Recorre el producto con datos de ejemplo. Ningún dato es de un cliente.', en: 'Walk through the product with example data. No data is from a customer.' }, // PUBLICO
    items: [
      {
        t: { es: 'Hoy', en: 'Today' },
        pregunta: { es: 'Qué requiere atención hoy.', en: 'What needs attention today.' },
        d: m(6, '/overview. Condición: dinero atorado viene del Tracker de Excel por carga manual; respuestas de más de 24 horas, de HubSpot', { es: 'Cuatro cifras clave según las fuentes que tengas cargadas: ingreso bruto, reembolsos, dinero atorado y respuestas de más de 24 horas, cada una con periodo, fórmula y cobertura.', en: 'Four key figures based on the sources you have loaded: gross revenue, refunds, stuck money and replies over 24 hours, each with period, formula and coverage.' }), // MATIZ. /overview. Condición: dinero atorado viene del Tracker de Excel por carga manual; respuestas de más de 24 horas, de HubSpot
        mockup: 'm1',
        href: { es: '/producto/hoy', en: '/en/product/today' },
      },
      {
        t: { es: 'Fuga de reembolsos', en: 'Refund leakage' },
        pregunta: { es: 'Dónde se concentra el dinero devuelto.', en: 'Where returned money concentrates.' },
        d: m(8, '/refunds, el paquete se arma en el navegador y no envía nada. Condición: Amazon, Walmart y Shopify entran por exportes', { es: 'Ve dónde se concentra el dinero devuelto por canal y producto, y descarga un paquete de evidencia. Tú lo revisas y lo presentas.', en: 'See where returned money concentrates by channel and product, and download an evidence package. You review it and you file it.' }), // MATIZ. /refunds, el paquete se arma en el navegador y no envía nada. Condición: Amazon, Walmart y Shopify entran por exportes
        mockup: 'm2',
        href: { es: '/producto/fuga-de-reembolsos', en: '/en/product/refund-leakage' },
      },
      {
        t: { es: 'Problemas con evidencia', en: 'Problems with evidence' },
        pregunta: { es: 'Qué problema priorizar y con qué casos.', en: 'Which problem to prioritize and with which cases.' },
        d: m(7, 'Estado al 2026-10-29: problem_conversations tiene 0 filas. /problems. Condición: exposición solo con vínculos confirmados; sin ellos dice No disponible', { es: 'Cada problema se presenta con su volumen y su evidencia cuando hay vínculos confirmados. La exposición económica es una cifra Inferida: ingreso de pedidos ligados al problema, no una pérdida.', en: 'Each problem is presented with its volume and its evidence when links are confirmed. Economic exposure is an Inferred figure: revenue from orders linked to the problem, not a loss.' }), // MATIZ. /problems. Condición: exposición solo con vínculos confirmados; sin ellos dice No disponible
        mockup: 'm3',
        href: { es: '/producto/problemas', en: '/en/product/problems' },
      },
      {
        t: { es: 'Pregúntale a tus datos', en: 'Ask your data' },
        pregunta: { es: 'Cómo se llegó a esta cifra.', en: 'How this figure was reached.' },
        d: m(2, '/preguntale, catálogo cerrado de 12 herramientas de solo lectura. Condición: confirmar que el modo con IA no está encendido en producción', { es: 'Escribe una pregunta y recibe cifras, tablas y gráficas. Corre con reglas, sin modelo de lenguaje, muestra cómo calculó y dice cuando no tiene el dato.', en: 'Type a question and get figures, tables and charts. It runs on rules, without a language model, shows how it calculated and says when it does not have the data.' }), // MATIZ. /preguntale, catálogo cerrado de 12 herramientas de solo lectura. Condición: confirmar que el modo con IA no está encendido en producción
        mockup: 'm4',
        href: { es: '/producto/pregunta-a-tus-datos', en: '/en/product/ask-your-data' },
      },
      {
        t: { es: 'Por decidir', en: 'To decide' },
        pregunta: { es: 'Qué se propone y quién decide.', en: 'What is proposed and who decides.' },
        d: m(4, '/recommendations. Condición: migración del flujo de Acciones aplicada', { es: 'Cada propuesta llega con su evidencia y su motivo. Una persona decide: Proceder, Ajustar o Descartar, y el resultado queda registrado.', en: 'Every proposal arrives with its evidence and its reason. A person decides: Proceed, Adjust or Dismiss, and the outcome is recorded.' }), // MATIZ. /recommendations. Condición: migración del flujo de Acciones aplicada
        mockup: 'm5',
        href: { es: '/producto/por-decidir', en: '/en/product/to-decide' },
      },
      {
        t: { es: 'Confianza de los datos', en: 'Data trust' },
        pregunta: { es: 'Cuánto fiarse de una cifra.', en: 'How much to trust a figure.' },
        d: { es: 'Un semáforo por fuente, la frescura de cada cifra, su cobertura y una lista de lo que todavía no se sabe. Es confianza en los datos, no una certificación.', en: 'A traffic light per source, the freshness of each figure, its coverage and a list of what is still unknown. It is trust in the data, not a certification.' }, // PUBLICO. /confianza
        mockup: 'm6',
        href: { es: '/producto/confianza-de-los-datos', en: '/en/product/data-trust' },
      },
    ],
    enlaceItem: { es: 'Ver la pantalla', en: 'See the screen' },
    enlaceTodas: { es: 'Ver las diez pantallas', en: 'See all ten screens' },
    hrefTodas: { es: '/producto', en: '/en/product' },
  },

  // ============================================================
  // 12. SEGURIDAD Y CONFIANZA. Función: reaseguro para TI y finanzas con buenas prácticas verificables, sin certificaciones.
  // Diagrama de tres organizaciones separadas por reglas en la base de datos, franja mono de cuatro hechos y dos paneles de vidrio oscuro sin color: Lo que existe y Lo que todavía no existe.
  // La fecha de la última revisión se llena y se actualiza el mismo día en que cambie un control.
  // ============================================================
  seguridad: {
    id: 'seguridad',
    etiqueta: { es: 'Seguridad y privacidad', en: 'Security and privacy' },
    titulo: { es: 'Seguridad descrita con lo que existe hoy y lo que todavía no.', en: 'Security described by what exists today and what does not yet.' }, // PUBLICO
    hechos: [
      { es: 'Aislamiento por organización', en: 'Isolation per organization' },
      { es: 'Cuatro roles', en: 'Four roles' },
      { es: 'Conexiones de lectura', en: 'Read connections' },
      { es: 'Registro de administración', en: 'Administration record' },
    ], // PUBLICO. Misma lista que la respuesta de seguridad del FAQ
    hayEtiqueta: { es: 'Lo que existe', en: 'What exists' },
    hay: [
      { es: 'Cada organización queda separada de las demás por reglas en la base de datos, no solo por la aplicación.', en: 'Each organization is kept apart from the others by rules in the database, not only by the application.' }, // PUBLICO. RLS forzada en tablas de negocio. No citar números de tablas ni de pruebas
      { es: 'Cuatro roles con permisos mínimos. El permiso de administración de plataforma es independiente y no da lectura de los datos de negocio de otras organizaciones.', en: 'Four roles with least-privilege permissions. The platform administration permission is separate and does not grant read access to the business data of other organizations.' }, // PUBLICO. capabilities.ts, platform-administration.md
      { es: 'La entrada es por enlace enviado al correo, con confirmación de correo, y las sesiones usan cookies protegidas.', en: 'Sign-in is by a link sent to your email, with email confirmation, and sessions use protected cookies.' }, // PUBLICO. Auth por enlace, cookies httpOnly. No decir que el acceso es solo por invitación
      m(9, 'Solo cierto para HubSpot, la única conexión directa', { es: 'Las conexiones a tus fuentes piden permisos de lectura.', en: 'Connections to your sources request read permissions.' }), // MATIZ. Solo cierto para HubSpot, la única conexión directa
      { es: 'Los exportes de puntos de dolor y de reclamos se generan sin datos personales.', en: 'Pain-point and claim exports are generated without personal data.' }, // PUBLICO. fuga-archivos.mjs
      { es: 'Quedan registradas las operaciones de administración, los cambios de equipo y los borrados por retención.', en: 'Administration operations, team changes and retention deletions are recorded.' }, // PUBLICO. platform audit, team_audit, retention_ledger. No decir que se registra cada lectura
      m(3, 'La IA con modelo está detrás de banderas', { es: 'Cuando la IA interviene, clasifica y redacta. No produce importes, y una persona decide.', en: 'When AI is involved, it classifies and drafts. It does not produce amounts, and a person decides.' }), // MATIZ. La IA con modelo está detrás de banderas
    ],
    noHayEtiqueta: { es: 'Lo que todavía no existe', en: 'What does not exist yet' },
    noHay: [
      { es: 'No tenemos certificación SOC 2 ni ISO 27001, y no afirmamos cumplimiento de GDPR.', en: 'We do not hold SOC 2 or ISO 27001 certification, and we do not claim GDPR compliance.' }, // PUBLICO. Ausencia declarada, excepción permitida
      { es: 'No se ha hecho una prueba de penetración externa.', en: 'No external penetration test has been performed.' }, // PUBLICO
      { es: 'La verificación en dos pasos para propietarios está en nuestra hoja de ruta. Hoy no se exige.', en: 'Two-step verification for owners is on our roadmap. It is not required today.' }, // PUBLICO
      { es: 'No ofrecemos inicio de sesión único ni una vista de auditoría para el cliente.', en: 'We do not offer single sign-on or a customer-facing audit view.' }, // PUBLICO
      { es: 'Hay respaldos diarios de nuestro proveedor, sin recuperación a un punto en el tiempo, y no ofrecemos compromisos de disponibilidad.', en: 'There are daily provider backups, without point-in-time recovery, and we make no availability commitments.' }, // PUBLICO. RB-03
    ],
    fecha: { es: 'Esta sección describe el estado a la fecha de la última revisión: [FECHA_DE_REVISION].', en: 'This section describes the state as of the last review date: [REVIEW_DATE].' }, // PUBLICO. Condición 12: se publica solo con [FECHA_DE_REVISION] resuelta
    enlace: { es: 'Leer la página de Seguridad y privacidad', en: 'Read the Security and privacy page' },
    href: { es: '/seguridad-y-privacidad', en: '/en/security-and-privacy' },
    reportar: { es: 'Reportar una vulnerabilidad', en: 'Report a vulnerability' },
    hrefReportar: { es: '/.well-known/security.txt', en: '/.well-known/security.txt' }, // Condición: el buzón de seguridad debe recibir correo
    contactoSeguridad: { es: 'Contacto de seguridad: [CORREO_DE_SEGURIDAD]', en: 'Security contact: [SECURITY_EMAIL]' }, // Condiciones 1 y 12: se publica solo cuando exista un buzón de seguridad que reciba. Nunca se imprime como mailto
    diagrama: {
      organizaciones: [
        { es: 'Organización A', en: 'Organization A' },
        { es: 'Organización B', en: 'Organization B' },
        { es: 'Organización C', en: 'Organization C' },
      ],
      barrera: { es: 'Reglas en la base de datos', en: 'Rules in the database' },
      alt: { es: 'Diagrama de línea: tres grupos de nodos, uno por organización, separados por barreras verticales rotuladas con reglas en la base de datos.', en: 'Line diagram: three groups of nodes, one per organization, separated by vertical barriers labeled rules in the database.' },
    }, // PUBLICO. Describe el aislamiento por organización; no cita números de tablas ni de pruebas
  },

  // ============================================================
  // 13. INTEGRACIONES. Función: decir qué se conecta hoy y qué no, sin logos. Equivale a las marquesinas de Handle.
  // Dos filas de chips en marquesina: fila 1 sólida, fila 2 en contorno con etiqueta Hoja de ruta. Marcas solo como texto.
  // ============================================================
  integraciones: {
    id: 'integraciones',
    etiqueta: { es: 'Integraciones', en: 'Integrations' },
    titulo: { es: 'Qué se conecta hoy y qué viene después.', en: 'What connects today and what comes next.' }, // PUBLICO
    subtitulo: { es: 'HubSpot en solo lectura y archivos de Excel y CSV. Los marketplaces entran hoy por sus exportes.', en: 'HubSpot, read-only, and Excel and CSV files. Marketplaces come in today through their exports.' }, // PUBLICO
    hoyEtiqueta: { es: 'Disponible hoy', en: 'Available today' },
    hoy: [
      {
        n: { es: 'HubSpot', en: 'HubSpot' },
        d: m(5, 'Condición: publicar la cifra de 5 minutos solo tras verificar corridas exitosas del cron; mientras tanto usar dAlterno', { es: 'Lectura de conversaciones, en solo lectura, con sincronización programada cada 5 minutos. No es tiempo real y la cobertura se limita a lo que expone la API de HubSpot: cada pantalla muestra su fecha de corte. La conexión se configura con nuestro equipo.', en: 'Reading of conversations, read-only, with a scheduled sync every 5 minutes. It is not real time and coverage is limited to what the HubSpot API exposes: every screen shows its cut-off date. The connection is set up with our team.' }, { alterno: 'integraciones.hoy[0].dAlterno', verifica: 5 }), // MATIZ. Condición: publicar la cifra de 5 minutos solo tras verificar corridas exitosas del cron; mientras tanto usar dAlterno
        dAlterno: m(9, 'Sin la cifra', { es: 'Lectura de conversaciones, en solo lectura, con sincronización programada. No es tiempo real: cada pantalla muestra su fecha de corte. La conexión se configura con nuestro equipo.', en: 'Reading of conversations, read-only, with a scheduled sync. It is not real time: every screen shows its cut-off date. The connection is set up with our team.' }), // MATIZ. Sin la cifra
      },
      {
        n: { es: 'Excel y CSV', en: 'Excel and CSV' },
        d: m(8, '/imports. Condición: no hay carga autoservicio de exportes de marketplaces', { es: 'Carga de archivos con vista previa y validación antes de ingerir. Los exportes de marketplaces se cargan con ayuda de nuestro equipo.', en: 'File upload with preview and validation before ingesting. Marketplace exports are loaded with help from our team.' }), // MATIZ. /imports. Condición: no hay carga autoservicio de exportes de marketplaces
      },
    ],
    rutaEtiqueta: { es: 'En hoja de ruta', en: 'On the roadmap' },
    ruta: [
      { es: 'Conectores directos con Amazon, Walmart y Shopify. Hoy se cargan sus exportes.', en: 'Direct connectors for Amazon, Walmart and Shopify. Today their exports are loaded.' }, // PUBLICO. Marcas solo en texto
      { es: 'Mapa de problemas completo por dirección de envío, que requiere esos conectores.', en: 'A full problem map by shipping address, which requires those connectors.' }, // PUBLICO
      { es: 'Verificación en dos pasos para propietarios.', en: 'Two-step verification for owners.' }, // PUBLICO
    ],
    posicion: { es: 'Rovaq no reemplaza tu herramienta de soporte. Lee las conversaciones de HubSpot en solo lectura y las cruza con los pedidos y reembolsos que cargas.', en: 'Rovaq does not replace your support tool. It reads HubSpot conversations in read-only mode and connects them with the orders and refunds you load.' }, // PUBLICO. Transporte que solo emite GET
    chipsFila1: [
      { es: 'HubSpot', en: 'HubSpot' },
      { es: 'Excel', en: 'Excel' },
      { es: 'CSV', en: 'CSV' },
    ],
    chipsFila2: [
      { es: 'Amazon', en: 'Amazon' },
      { es: 'Walmart', en: 'Walmart' },
      { es: 'Shopify', en: 'Shopify' },
    ],
    chipEtiquetaRuta: { es: 'Hoja de ruta', en: 'Roadmap' },
    diagrama: {
      central: { es: 'Rovaq', en: 'Rovaq' },
      rutaEtiqueta: { es: 'Hoja de ruta', en: 'Roadmap' },
      alt: { es: 'Diagrama de línea: un nodo central con dos conexiones continuas hacia HubSpot y hacia archivos de Excel y CSV, y tres conexiones discontinuas rotuladas hoja de ruta hacia Amazon, Walmart y Shopify. Los nombres son texto.', en: 'Line diagram: a central node with two solid connections to HubSpot and to Excel and CSV files, and three dashed connections labeled roadmap to Amazon, Walmart and Shopify. The names are text.' },
    }, // PUBLICO. Nombres solo como texto, nunca logos
    enlace: { es: 'Ver las integraciones', en: 'See the integrations' },
    href: { es: '/integraciones', en: '/en/integrations' },
    enlaceRuta: { es: 'Ver la hoja de ruta', en: 'See the roadmap' },
    hrefRuta: { es: '/hoja-de-ruta', en: '/en/roadmap' },
  },

  // ============================================================
  // 14. LO QUE ROVAQ NO HACE. Función: la pieza de posicionamiento. Ningún competidor revisado publica sus límites.
  // Filas numeradas con línea de 1 px que se dibuja al entrar. Fondo oscuro.
  // ============================================================
  limites: {
    id: 'limites',
    titulo: { es: 'Lo que Rovaq no hace.', en: 'What Rovaq does not do.' }, // PUBLICO
    subtitulo: { es: 'Los límites también son parte del producto.', en: 'The limits are part of the product too.' }, // PUBLICO
    items: [
      { es: 'No calcula margen ni utilidad. Todo es ingreso bruto.', en: 'It does not calculate margin or profit. Everything is gross revenue.' }, // PUBLICO. Hoy, Brechas, CFO
      { es: 'No convierte monedas ni las suma. USD, CAD y MXN van por separado.', en: 'It does not convert currencies or add them. USD, CAD and MXN are kept apart.' }, // PUBLICO. CFO, ADAPTER.md
      { es: 'No presenta una exposición como pérdida. Es una cifra inferida y no se suma entre problemas.', en: 'It does not present exposure as a loss. It is an inferred figure and is not added across problems.' }, // PUBLICO. EXPOSURE.md, Problemas
      { es: 'No es un agente autónomo. Prepara el paquete y el borrador; una persona presenta el reclamo y decide cada acción.', en: 'It is not an autonomous agent. It prepares the package and the draft; a person files the claim and decides every action.' }, // PUBLICO. Fuga de reembolsos, Acciones, OPERATIONS.md
      { es: 'No promete recuperación, ahorro ni retorno. Lo recuperable es una estimación con supuestos que escribes tú.', en: 'It does not promise recovery, savings or return. What is recoverable is an estimate based on assumptions you enter.' }, // PUBLICO. Estimador con candado
      { es: 'No trabaja en tiempo real. La sincronización es programada y cada pantalla muestra su fecha de corte.', en: 'It does not work in real time. Sync is scheduled and every screen shows its cut-off date.' }, // PUBLICO. vercel.json, Confianza
      { es: 'No se conecta de forma directa con Amazon, Walmart ni Shopify. Hoy se cargan sus exportes.', en: 'It does not connect directly with Amazon, Walmart or Shopify. Today their exports are loaded.' }, // PUBLICO. providers.mjs con transporte apagado
      m(11, 'redact.mjs. Condición: IA sobre texto depende de banderas; revisión de Responsable A y abogado', { es: 'No anonimiza tus datos. Cuando se usa IA sobre texto, se enmascaran correos y teléfonos, y la redacción no equivale a anonimización.', en: 'It does not anonymize your data. When AI is used on text, emails and phone numbers are masked, and redaction is not anonymization.' }, { req: ['responsable_a','abogado'] }), // MATIZ. redact.mjs. Condición: IA sobre texto depende de banderas; revisión de Responsable A y abogado
      m(2, 'agent/server.ts, modelo de reglas. Si cambia el modo de Pregúntale, esta fila se reescribe', { es: 'No usa un modelo de lenguaje para responder en Pregúntale a tus datos y no busca en internet.', en: 'It does not use a language model to answer in Ask your data and it does not search the internet.' }), // MATIZ. agent/server.ts, modelo de reglas. Si cambia el modo de Pregúntale, esta fila se reescribe
      { es: 'No tiene certificación SOC 2 ni ISO 27001, no afirma cumplimiento de GDPR y la verificación en dos pasos de propietarios está en hoja de ruta.', en: 'It holds no SOC 2 or ISO 27001 certification, does not claim GDPR compliance, and two-step verification for owners is on the roadmap.' }, // PUBLICO. Seguridad 03, sección 3
      { es: 'No reemplaza tu herramienta de soporte. Lee las conversaciones de HubSpot en solo lectura y no escribe en tu CRM.', en: 'It does not replace your support tool. It reads HubSpot conversations in read-only mode and does not write to your CRM.' }, // PUBLICO. Transporte solo GET
    ],
    cierre: { es: 'Si algo de esta lista cambia, se dirá aquí.', en: 'If anything on this list changes, it will be stated here.' }, // PUBLICO. Hoja de ruta
    enlace: { es: 'Ver la hoja de ruta', en: 'See the roadmap' },
    href: { es: '/hoja-de-ruta', en: '/en/roadmap' },
  },

  // ============================================================
  // 15. PREGUNTAS FRECUENTES. Función: quitar la última fricción. Acordeón con signo más que gira 45 grados al abrir.
  // Las siete primeras son idénticas a faq-inicio.mjs y alimentan el JSON-LD. Las tres últimas no entran al JSON-LD.
  // ============================================================
  faq: {
    id: 'faq',
    etiqueta: { es: 'Preguntas frecuentes', en: 'Frequently asked questions' },
    titulo: { es: 'Preguntas frecuentes', en: 'Frequently asked questions' },
    items: [
      {
        q: { es: '¿Qué es Rovaq AI?', en: 'What is Rovaq AI?' },
        a: { es: 'Es inteligencia de ingresos para negocios que venden por marketplaces y atienden por varios canales. Cruza conversaciones, pedidos y reembolsos, y muestra cada cifra con su clase, su fuente y su fecha de corte.', en: 'It is revenue intelligence for businesses that sell on marketplaces and support customers across channels. It connects conversations, orders and refunds, and shows every figure with its class, source and cut-off date.' }, // PUBLICO. Manifiesto, README
      },
      {
        q: { es: '¿Con qué fuentes funciona hoy?', en: 'Which sources does it work with today?' },
        a: { es: 'Con HubSpot, en solo lectura, y con archivos de Excel y CSV. Amazon, Walmart y Shopify están en hoja de ruta: hoy se cargan sus exportes con ayuda de nuestro equipo.', en: 'With HubSpot, read-only, and with Excel and CSV files. Amazon, Walmart and Shopify are on the roadmap: today their exports are loaded with help from our team.' }, // PUBLICO. 02 sección 2
      },
      {
        q: { es: '¿Los datos se actualizan en tiempo real?', en: 'Is the data updated in real time?' },
        a: m(5, 'vercel.json, sello. Condición: verificar corridas exitosas del cron antes de publicar la cifra', { es: 'No. HubSpot se sincroniza de forma programada cada 5 minutos y las cargas de archivos son manuales. Cada cifra muestra hasta qué fecha llegan sus datos y hace cuánto se actualizó.', en: 'No. HubSpot syncs on a schedule every 5 minutes and file uploads are manual. Every figure shows the date its data reaches and how long ago it was updated.' }, { alterno: 'faq.items[2].aAlterno', verifica: 5 }), // MATIZ. vercel.json, sello. Condición: verificar corridas exitosas del cron antes de publicar la cifra
        aAlterno: m(9, 'Sin la cifra de 5 minutos, mientras no haya corridas verificadas del cron', { es: 'No. HubSpot se sincroniza de forma programada y las cargas de archivos son manuales. Cada cifra muestra hasta qué fecha llegan sus datos y hace cuánto se actualizó.', en: 'No. HubSpot syncs on a schedule and file uploads are manual. Every figure shows the date its data reaches and how long ago it was updated.' }),
      },
      {
        q: { es: '¿Rovaq calcula mi margen o cuánto dinero pierdo?', en: 'Does Rovaq calculate my margin or how much money I lose?' },
        a: { es: 'No calcula margen: todo es ingreso bruto. Los reembolsos son cifras observadas. La exposición por problema es una cifra inferida: el ingreso de pedidos ligados a ese problema, que no equivale a una pérdida.', en: 'It does not calculate margin: everything is gross revenue. Refunds are observed figures. Exposure per problem is an inferred figure: the revenue of orders linked to that problem, which is not the same as a loss.' }, // PUBLICO. EXPOSURE.md. Contrapeso del titular
      },
      {
        q: { es: '¿Rovaq usa IA y dónde?', en: 'Does Rovaq use AI and where?' },
        a: m(2, 'agent-datos CONTRACT.md. Condición: no se mide ni se promete precisión; no se nombra proveedor', { es: 'Pregúntale a tus datos responde con reglas y herramientas de solo lectura, sin modelo de lenguaje, y muestra sus pasos. La agrupación y clasificación de conversaciones puede usar modelos de IA cuando la organización lo habilita. La IA no crea importes y una persona decide cada acción.', en: 'Ask your data answers with rules and read-only tools, without a language model, and shows its steps. Grouping and classifying conversations can use AI models when the organization enables it. AI does not create amounts and a person decides every action.' }), // MATIZ. agent-datos CONTRACT.md. Condición: no se mide ni se promete precisión; no se nombra proveedor
      },
      {
        q: { es: '¿Rovaq reclama los reembolsos por mí?', en: 'Does Rovaq claim refunds for me?' },
        a: { es: 'No. Arma un paquete de evidencia agregada y un borrador de mensaje. Tú los revisas y presentas el reclamo. Nada se envía solo y no se promete ningún monto recuperado.', en: 'No. It assembles a package of aggregated evidence and a draft message. You review them and file the claim. Nothing is sent on its own and no recovered amount is promised.' }, // PUBLICO. fuga-archivos.mjs
      },
      {
        q: { es: '¿Qué tan seguro es y qué certificaciones tienen?', en: 'How secure is it and what certifications do you hold?' },
        a: { es: 'Hay aislamiento por organización en la base de datos, cuatro roles, conexiones de lectura y registro de operaciones de administración. No tenemos SOC 2 ni ISO 27001, no hemos hecho una prueba de penetración externa y la verificación en dos pasos de propietarios está en hoja de ruta. El detalle está en la página de Seguridad.', en: 'There is isolation per organization in the database, four roles, read connections and a record of administration operations. We hold no SOC 2 or ISO 27001, we have not run an external penetration test and two-step verification for owners is on the roadmap. The detail is on the Security page.' }, // PUBLICO. 03 secciones 2 y 3
      },
      {
        q: { es: '¿Rovaq reemplaza mi herramienta de soporte?', en: 'Does Rovaq replace my support tool?' },
        a: { es: 'No. Lee las conversaciones de HubSpot en solo lectura y las cruza con los pedidos y reembolsos que cargas. No escribe en tu CRM ni responde a tus clientes.', en: 'No. It reads HubSpot conversations in read-only mode and connects them with the orders and refunds you load. It does not write to your CRM or reply to your customers.' }, // PUBLICO. Transporte solo GET; nada se envía solo
      },
      {
        q: m(11, 'Pregunta pendiente de revisión de Responsable A y de un abogado: fuera de publicación, de sitemap y de JSON-LD hasta que ambos aprueben', { es: '¿Qué pasa con los datos personales cuando se usa IA?', en: 'What happens to personal data when AI is used?' }, { req: ['responsable_a', 'abogado'] }),
        a: m(11, 'redact.mjs, preprocess.mjs. Condición: revisión de Responsable A y abogado; la IA sobre texto depende de banderas', { es: 'Antes de usar IA sobre texto se enmascaran correos y teléfonos. Eso es redactar y no anonimizar: los nombres y las direcciones no se enmascaran por defecto, y por eso no decimos que tus datos estén anonimizados.', en: 'Before AI is used on text, emails and phone numbers are masked. That is redaction and not anonymization: names and addresses are not masked by default, and that is why we do not say your data is anonymized.' }, { req: ['responsable_a','abogado'] }), // MATIZ. redact.mjs, preprocess.mjs. Condición: revisión de Responsable A y abogado; la IA sobre texto depende de banderas
      },
      {
        q: { es: '¿Cómo pido acceso y cuánto cuesta?', en: 'How do I request access and what does it cost?' },
        a: { es: 'Escríbenos a [CORREO_DE_CONTACTO] con tu rol y las herramientas que usas. Revisamos tu caso y te decimos qué se puede cargar o conectar hoy. El precio todavía no está publicado.', en: 'Write to us at [CONTACT_EMAIL] with your role and the tools you use. We review your case and tell you what can be loaded or connected today. Pricing is not published yet.' }, // PUBLICO. Condición: el correo debe recibir; fuera del JSON-LD por el marcador y el precio
      },
    ],
  },

  // ============================================================
  // 16. CIERRE. Función: la acción, con el reaseguro de honestidad. Oscuro, objeto héroe a la derecha entrando desde abajo.
  // ============================================================
  cierre: {
    id: 'cierre',
    titulo: { es: 'Solicita acceso y revisa tus cifras con su evidencia.', en: 'Request access and review your figures with their evidence.' }, // PUBLICO
    texto: { es: 'Escríbenos por correo. Te decimos con claridad qué se puede cargar hoy y qué sigue en hoja de ruta.', en: 'Write to us by email. We tell you plainly what can be loaded today and what is still on the roadmap.' }, // PUBLICO
    cta: { es: 'Solicitar acceso', en: 'Request access' },
    ctaSecundario: { es: 'Leer lo que Rovaq no hace', en: 'Read what Rovaq does not do' },
    precio: { es: 'El precio todavía no está publicado.', en: 'Pricing is not published yet.' }, // PUBLICO
    correoAsunto: { es: 'Solicitar acceso a Rovaq AI', en: 'Request access to Rovaq AI' },
    correoCuerpo: { es: 'Hola, quiero solicitar acceso a Rovaq AI.\n\nMi puesto:\nCanales por los que vendemos:\nHerramienta con la que atendemos clientes:\n\nGracias.', en: 'Hello, I would like to request access to Rovaq AI.\n\nMy role:\nChannels we sell through:\nTool we use to support customers:\n\nThank you.' }, // Sin marcadores entre corchetes: las líneas vacías las llena quien escribe
    ayudaCorreo: { es: 'Si tu correo no se abre, escribe a [CORREO_DE_CONTACTO].', en: 'If your email app does not open, write to [CONTACT_EMAIL].' },
    incluir: [
      { es: 'Tu puesto', en: 'Your role' },
      { es: 'Los canales por los que vendes', en: 'The channels you sell through' },
      { es: 'Tu herramienta de conversaciones', en: 'Your conversations tool' },
      { es: 'Si tienes exportes de pedidos y reembolsos', en: 'Whether you have order and refund exports' },
      { es: 'El idioma de tu equipo', en: 'Your team language' },
    ], // PUBLICO. Lista de lo que conviene incluir, posicionamiento 6.8
    objetoAlt: { es: 'Objeto de adorno: un anillo de grafito con un disco de vidrio esmerilado y una pequeña cuenta roja, que evoca una lente de evidencia.', en: 'Decorative object: a graphite ring holding a frosted glass disc with a small red bead, evoking an evidence lens.' }, // Mismo objeto que imagenes.hero
  },

  // ============================================================
  // 17. PIE Y ANIMACIÓN FINAL. Función: orientar y cerrar con el nombre. Cinco columnas y la marca gigante cortada en el borde inferior.
  // Los enlaces legales aparecen solo cuando un abogado los aprueba. Sin redes sociales hasta que existan cuentas. Sin logos de terceros.
  // ============================================================
  pie: {
    columnas: [
      {
        t: { es: 'Producto', en: 'Product' },
        items: [
          { t: { es: 'Las diez pantallas', en: 'The ten screens' }, href: { es: '/producto', en: '/en/product' } },
          { t: { es: 'Hoy', en: 'Today' }, href: { es: '/producto/hoy', en: '/en/product/today' } },
          { t: { es: 'Fuga de reembolsos', en: 'Refund leakage' }, href: { es: '/producto/fuga-de-reembolsos', en: '/en/product/refund-leakage' } },
          { t: { es: 'Pregúntale a tus datos', en: 'Ask your data' }, href: { es: '/producto/pregunta-a-tus-datos', en: '/en/product/ask-your-data' } },
          { t: { es: 'Confianza de los datos', en: 'Data trust' }, href: { es: '/producto/confianza-de-los-datos', en: '/en/product/data-trust' } },
        ],
      },
      {
        t: { es: 'Casos de uso', en: 'Use cases' },
        items: [
          { t: { es: 'Propietario', en: 'Owner' }, href: { es: '/casos-de-uso/propietario', en: '/en/use-cases/owner' } },
          { t: { es: 'Analista', en: 'Analyst' }, href: { es: '/casos-de-uso/analista', en: '/en/use-cases/analyst' } },
          { t: { es: 'Operador', en: 'Operator' }, href: { es: '/casos-de-uso/operador', en: '/en/use-cases/operator' } },
          { t: { es: 'Lector', en: 'Viewer' }, href: { es: '/casos-de-uso/lector', en: '/en/use-cases/viewer' } },
        ],
      },
      {
        t: { es: 'Recursos', en: 'Resources' },
        items: [
          { t: { es: 'Seguridad y privacidad', en: 'Security and privacy' }, href: { es: '/seguridad-y-privacidad', en: '/en/security-and-privacy' } },
          { t: { es: 'Integraciones', en: 'Integrations' }, href: { es: '/integraciones', en: '/en/integrations' } },
          { t: { es: 'Hoja de ruta', en: 'Roadmap' }, href: { es: '/hoja-de-ruta', en: '/en/roadmap' } },
          { t: { es: 'Blog', en: 'Blog' }, href: { es: '/blog', en: '/en/blog' } },
        ],
      },
      {
        t: { es: 'Empresa', en: 'Company' },
        items: [
          { t: { es: 'Acerca de', en: 'About' }, href: { es: '/acerca', en: '/en/about' } },
          { t: { es: 'Solicitar acceso', en: 'Request access' }, href: { es: '/solicitar-acceso', en: '/en/request-access' } },
          { t: { es: 'Estado', en: 'Status' }, href: { es: '/estado', en: '/en/status' } },
          { t: { es: 'Reportar una vulnerabilidad', en: 'Report a vulnerability' }, href: { es: '/.well-known/security.txt', en: '/.well-known/security.txt' } },
        ],
      },
      {
        t: { es: 'Legal', en: 'Legal' },
        items: [
          { t: { es: 'Aviso de privacidad', en: 'Privacy notice' }, href: { es: '/aviso-de-privacidad', en: '/en/privacy-notice' } },
          { t: { es: 'Términos', en: 'Terms' }, href: { es: '/terminos', en: '/en/terms' } },
        ], // Condición: solo se enlazan cuando un abogado los apruebe
      },
    ],
    linea: { es: 'Rovaq AI. Cada cifra, con su evidencia a la vista.', en: 'Rovaq AI. Every figure, with its evidence in plain view.' }, // PUBLICO
    derechos: { es: '© 2026 [RAZON_SOCIAL]. Todos los derechos reservados.', en: '© 2026 [LEGAL_NAME]. All rights reserved.' }, // Condición 12: se publica solo con la razón social confirmada y resuelta
    revision: { es: 'Última revisión: [FECHA_DE_REVISION]', en: 'Last reviewed: [REVIEW_DATE]' },
    marca: { es: 'ROVAQ', en: 'ROVAQ' },
    marcaAlt: { es: 'Rovaq', en: 'Rovaq' },
    final: {
      lineas: [
        { es: 'Cada cifra,', en: 'Every figure,' },
        { es: 'con su evidencia', en: 'with its evidence' },
        { es: 'a la vista.', en: 'in plain view.' },
      ], // PUBLICO. Se revelan una a una al llegar al final de la página; la marca gigante sube después
      subtitulo: { es: 'Gracias por revisar cómo trabajamos.', en: 'Thank you for reviewing how we work.' }, // PUBLICO
      volver: { es: 'Volver arriba', en: 'Back to top' },
    },
  },

  // ============================================================
  // 18. MOCKUPS. Seis ilustraciones de interfaz hechas en HTML, CSS y SVG, siempre rotuladas Datos de ejemplo.
  // Organización inventada, una moneda por pantalla, SKU inventados y canales genéricos en lugar de marcas de marketplace.
  // Ninguna cifra de los mockups se cita en otro texto de la portada. Un solo acento rojo por marco.
  // ============================================================
  mockups: {
    rotulo: { es: 'Datos de ejemplo. No son de un cliente.', en: 'Example data. Not from a customer.' },
    organizacion: { es: 'Organización de ejemplo', en: 'Example organization' },
    m1: {
      marco: { es: 'Hoy', en: 'Today' },
      boton: { es: 'Exportar informe', en: 'Export report' },
      periodos: [
        { es: 'Este mes', en: 'This month' },
        { es: '30 días', en: '30 days' },
        { es: '90 días', en: '90 days' },
        { es: '12 meses', en: '12 months' },
      ],
      tarjetas: [
        { t: { es: 'Ingreso bruto', en: 'Gross revenue' }, v: { es: '480,000 USD', en: '480,000 USD' }, clase: { es: 'Observado', en: 'Observed' } },
        { t: { es: 'Reembolsos', en: 'Refunds' }, v: { es: '36,000 USD', en: '36,000 USD' }, clase: { es: 'Observado', en: 'Observed' } },
        { t: { es: 'Dinero atorado', en: 'Stuck money' }, v: { es: '9,000 USD', en: '9,000 USD' }, clase: { es: 'Observado', en: 'Observed' } },
        { t: { es: 'Respuestas de más de 24 horas', en: 'Replies over 24 hours' }, v: { es: '14 hilos', en: '14 threads' }, clase: { es: 'Observado', en: 'Observed' } },
      ],
      atencionTitulo: { es: 'Requiere tu atención', en: 'Needs your attention' },
      atencion: { es: 'Fuga de reembolsos en el SKU HM-210', en: 'Refund leak on SKU HM-210' },
      siguienteTitulo: { es: 'Siguiente acción sugerida', en: 'Suggested next action' }, // Cambio del guardián: la interfaz dice Siguiente mejor acción; se evita el superlativo en la landing
      siguiente: { es: 'Preparar el paquete de reclamo del SKU HM-210', en: 'Prepare the claim package for SKU HM-210' },
      sello: { es: 'Observado. Libro de ejemplo. Corte de ejemplo. Actualizado hace unos minutos.', en: 'Observed. Example ledger. Example cut-off. Updated a few minutes ago.' },
      alt: { es: 'Ilustración de la pantalla Hoy con cuatro cifras de ejemplo y un aviso de atención. Los datos son inventados.', en: 'Illustration of the Today screen with four example figures and an attention notice. The data is invented.' },
    }, // PUBLICO. /overview
    m2: {
      marco: { es: 'Fuga de reembolsos', en: 'Refund leakage' },
      titular: { es: '36,000 USD devueltos en el periodo', en: '36,000 USD returned in the period' },
      grafica: { es: 'Pareto de 10 SKU, de HM-120 a HM-210, con línea de porcentaje acumulado', en: 'Pareto of 10 SKUs, HM-120 to HM-210, with a cumulative percentage line' },
      canales: [
        { es: 'Canal A', en: 'Channel A' },
        { es: 'Canal B', en: 'Channel B' },
        { es: 'Canal C', en: 'Channel C' },
      ],
      boton: { es: 'Generar paquete de evidencia', en: 'Generate evidence package' },
      notaBoton: { es: 'Se arma en tu navegador. No se envía nada.', en: 'It is built in your browser. Nothing is sent.' },
      noSe: { es: 'Causa del reembolso: sin dato.', en: 'Refund cause: no data.' },
      alt: { es: 'Gráfica de Pareto de reembolsos por SKU de ejemplo y un botón para generar el paquete de evidencia.', en: 'Pareto chart of refunds by example SKU and a button to generate the evidence package.' },
    }, // PUBLICO. /refunds
    m3: {
      marco: { es: 'Problemas', en: 'Problems' },
      filas: [
        { t: { es: 'Entrega marcada como completa sin recibirse', en: 'Delivery marked complete but not received' }, sev: { es: 'Severidad alta', en: 'High severity' }, casos: { es: '124 casos', en: '124 cases' }, expo: { es: 'Exposición: Inferido', en: 'Exposure: Inferred' } },
        { t: { es: 'Pieza distinta a la publicada', en: 'Item differs from the listing' }, sev: { es: 'Severidad media', en: 'Medium severity' }, casos: { es: '86 casos', en: '86 cases' }, expo: { es: 'Exposición: Inferido', en: 'Exposure: Inferred' } },
        { t: { es: 'Cobro duplicado', en: 'Duplicate charge' }, sev: { es: 'Severidad media', en: 'Medium severity' }, casos: { es: '41 casos', en: '41 cases' }, expo: { es: 'Exposición: Sin dato', en: 'Exposure: No data' } },
      ], // La fila 3 en Sin dato muestra a propósito el caso sin vínculos confirmados
      citas: [
        { es: '«Mi pedido figura como entregado y no llegó. Ya escribí dos veces por correo.»', en: '«My order shows as delivered and never arrived. I have already written twice by email.»' },
        { es: '«Es la segunda vez que pido el reemplazo. Dejé mi teléfono y nadie llamó.»', en: '«This is the second time I ask for the replacement. I left my phone number and nobody called.»' },
      ],
      enmascarado: { es: 'Correos y teléfonos de las citas, enmascarados.', en: 'Emails and phone numbers in the quotes, masked.' },
      pie: { es: 'Exposición mostrada como subtotal conocido, no como total.', en: 'Exposure shown as a known subtotal, not as a total.' },
      alt: m(3, '/problems. Condición: extracción habilitada; exposición solo con vínculos confirmados', { es: 'Lista de tres problemas de ejemplo con severidad, casos y clase de cifra, y una ficha con dos citas de ejemplo con datos enmascarados.', en: 'List of three example problems with severity, cases and figure class, and a record with two example quotes with masked data.' }),
    }, // MATIZ. /problems. Condición: extracción habilitada; exposición solo con vínculos confirmados
    m4: {
      marco: { es: 'Pregúntale a tus datos', en: 'Ask your data' },
      pregunta: { es: '¿Qué canal concentra más reembolsos este trimestre?', en: 'Which channel concentrates the most refunds this quarter?' },
      respuesta: { es: 'Canal A concentra la mayor parte de los reembolsos liquidados del trimestre de ejemplo.', en: 'Channel A concentrates most of the settled refunds of the example quarter.' },
      tabla: [
        { c: { es: 'Canal A', en: 'Channel A' }, v: { es: '18,500 USD', en: '18,500 USD' } },
        { c: { es: 'Canal B', en: 'Channel B' }, v: { es: '11,200 USD', en: '11,200 USD' } },
        { c: { es: 'Canal C', en: 'Channel C' }, v: { es: '6,300 USD', en: '6,300 USD' } },
      ],
      sello: { es: 'Observado. Libro de ejemplo. Corte de ejemplo. Actualizado hace unos minutos.', en: 'Observed. Example ledger. Example cut-off. Updated a few minutes ago.' },
      desplegable: { es: 'Cómo llegué a esto', en: 'How I got here' },
      pasos: [
        { es: 'Consultar reembolsos liquidados por canal', en: 'Query settled refunds by channel' },
        { es: 'Sumar por canal, sin mezclar monedas', en: 'Sum by channel, without mixing currencies' },
        { es: 'Ordenar de mayor a menor', en: 'Sort from highest to lowest' },
      ],
      notaPasos: { es: 'Pasos registrados por el sistema. Cifras calculadas con reglas, sin modelo de lenguaje.', en: 'Steps recorded by the system. Figures calculated with rules, without a language model.' },
      sugerencias: [
        { es: '¿Cuál es la tendencia de reembolsos?', en: 'What is the refund trend?' },
        { es: '¿Qué fuentes tienen huecos?', en: 'Which sources have gaps?' },
      ],
      alt: m(2, '/preguntale. No poner el rótulo IA en este marco', { es: 'Conversación de ejemplo con una pregunta, una respuesta con tabla de tres canales y el desplegable con los pasos del cálculo.', en: 'Example conversation with a question, an answer with a three-channel table and the dropdown with the calculation steps.' }),
    }, // MATIZ. /preguntale. No poner el rótulo IA en este marco
    m5: {
      marco: { es: 'Por decidir', en: 'To decide' },
      tarjeta: { es: 'Preparar el paquete de reclamo del SKU HM-210.', en: 'Prepare the claim package for SKU HM-210.' },
      porQue: { es: 'La intensidad de reembolso del SKU supera el umbral de la regla en los últimos meses completos.', en: 'The SKU refund intensity exceeds the rule threshold over the last complete months.' },
      evidencia: { es: '3 meses completos. Fuente: libro de ejemplo.', en: '3 complete months. Source: example ledger.' },
      enJuego: { es: 'Ingreso en juego: 8,200 USD. Inferido.', en: 'Revenue at stake: 8,200 USD. Inferred.' },
      origen: { es: 'Propuesta por regla.', en: 'Proposed by rule.' },
      botones: [
        { es: 'Proceder', en: 'Proceed' },
        { es: 'Ajustar', en: 'Adjust' },
        { es: 'Descartar', en: 'Dismiss' },
      ],
      estadoDescartada: { es: 'Descartada', en: 'Dismissed' }, // Diccionario de la app, d-recs.ts: Dismiss y Dismissed
      aviso: { es: 'Decide una persona. No se envía nada solo.', en: 'A person decides. Nothing is sent automatically.' },
      alt: m(4, '/recommendations. No se rotula recomendada por IA. Condición: migración del flujo de Acciones', { es: 'Tarjeta de recomendación de ejemplo con su evidencia, su ingreso en juego inferido y tres botones de decisión.', en: 'Example recommendation card with its evidence, its inferred revenue at stake and three decision buttons.' }),
    }, // MATIZ. /recommendations. No se rotula recomendada por IA. Condición: migración del flujo de Acciones
    m6: {
      marco: { es: 'Confianza', en: 'Trust' },
      indicador: { es: 'Fuentes al día: 1 de 3.', en: 'Sources up to date: 1 of 3.' },
      filas: [
        { es: 'CRM. Al día. Último éxito: hace unos minutos.', en: 'CRM. Up to date. Last success: a few minutes ago.' },
        { es: 'Exportes de marketplace. Carga manual.', en: 'Marketplace exports. Manual load.' },
        { es: 'Hoja de seguimiento. Carga manual.', en: 'Tracking sheet. Manual load.' },
      ],
      noSabemosTitulo: { es: 'Qué no sabemos', en: 'What we do not know' },
      noSabemos: [
        { es: 'Hoja de seguimiento sin fecha de corte. Cierra cargando la fecha en la importación.', en: 'Tracking sheet without a cut-off date. Close it by entering the date in the import.' },
        { es: 'Reembolsos sin monto: el dinero devuelto es un piso.', en: 'Refunds without an amount: returned money is a floor.' },
      ],
      alt: { es: 'Estado de tres fuentes de ejemplo con su semáforo y una lista de lo que todavía no se sabe.', en: 'Status of three example sources with their traffic light and a list of what is not yet known.' },
    }, // PUBLICO. /confianza, /connections
  },

  // ============================================================
  // 19. IMÁGENES Y OBJETOS. Texto alternativo de cada pieza visual que no es un mockup.
  // Regla: un objeto decorativo lleva alt vacío cuando el texto de al lado ya dice lo mismo; el texto de aquí es la descripción para quien la pida.
  // ============================================================
  imagenes: {
    hero: { es: 'Objeto de adorno: un anillo de grafito con un disco de vidrio esmerilado y una pequeña cuenta roja, que evoca una lente de evidencia.', en: 'Decorative object: a graphite ring holding a frosted glass disc with a small red bead, evoking an evidence lens.' }, // SPEC 4.2. S1, S10, nodo 05 del hilo y 404
    o1: { es: 'Objeto de adorno: tres láminas de vidrio esmerilado unidas por un hilo fino, que evoca datos importados de varias fuentes.', en: 'Decorative object: three frosted glass plates joined by a fine thread, evoking data imported from several sources.' }, // Paso 1 Importa, nodo 01 del hilo, orbe del Analista
    o2: { es: 'Objeto de adorno: tres cúmulos de pequeñas esferas de vidrio unidos por líneas finas, que evoca datos agrupados en problemas.', en: 'Decorative object: three clusters of small glass spheres joined by fine lines, evoking data grouped into problems.' }, // Paso 2 Agrupa, orbe del Operador
    o3: { es: 'Objeto de adorno: una probeta graduada de vidrio llena de partículas hasta la mitad, con una marca de nivel roja, que evoca una cifra medida.', en: 'Decorative object: a graduated glass cylinder half filled with particles and a red level mark, evoking a measured figure.' }, // Paso 3 Cuantifica, orbe del Propietario
    o4: { es: 'Objeto de adorno: un disco de grafito con tres muescas y una esfera de vidrio en la central, que evoca una decisión entre tres opciones.', en: 'Decorative object: a graphite disc with three notches and a glass sphere in the central one, evoking a choice among three options.' }, // Paso 4 Decide, orbe del Lector
    nubeDePuntos: { es: 'Forma hecha de puntos de luz que cambia de un objeto a otro al avanzar los cuatro pasos.', en: 'Shape made of points of light that changes from one object to another as the four steps advance.' },
    lineaDeScroll: { es: 'Línea fina que se dibuja al desplazarte y que une los títulos de la página.', en: 'Fine line that draws itself as you scroll and joins the titles of the page.' },
    arcoDePuestos: { es: 'Arco delgado que sostiene cuatro esferas pequeñas, una por puesto.', en: 'Thin arc holding four small spheres, one for each role.' },
    horizonte: { es: 'Degradado suave de negro a gris claro que marca el cambio de una sección oscura a una clara.', en: 'Soft gradient from black to light gray marking the change from a dark section to a light one.' },
    marcaGigante: { es: 'Rovaq', en: 'Rovaq' },
    og: { es: 'Rovaq AI. Cada cifra, con su evidencia a la vista. Ilustración con datos de ejemplo.', en: 'Rovaq AI. Every figure, with its evidence in plain view. Illustration with example data.' },
  },

  // ============================================================
  // 20. MICROCOPYS. Botones, etiquetas y estados reutilizables.
  // ============================================================
  micro: {
    botones: {
      acceso: { es: 'Solicitar acceso', en: 'Request access' },
      verComoFunciona: { es: 'Ver cómo funciona', en: 'See how it works' },
      verPantalla: { es: 'Ver la pantalla', en: 'See the screen' },
      leerArticulo: { es: 'Leer el artículo', en: 'Read the article' },
      volverInicio: { es: 'Volver al inicio', en: 'Back to home' },
    },
    etiquetas: {
      hoy: { es: 'Disponible hoy', en: 'Available today' },
      ruta: { es: 'En hoja de ruta', en: 'On the roadmap' },
      porExporte: { es: 'Por exporte', en: 'By export' },
      piso: { es: 'Piso, no total', en: 'Floor, not a total' },
      parcial: { es: 'Parcial', en: 'Partial' },
      ingresoBruto: { es: 'Ingreso bruto', en: 'Gross revenue' },
      alDia: { es: 'Al día', en: 'Up to date' },
      cargaManual: { es: 'Carga manual', en: 'Manual load' },
      atrasada: { es: 'Atrasada', en: 'Delayed' },
      alerta: { es: 'Alerta', en: 'Alert' },
      enPausa: { es: 'En pausa', en: 'Paused' },
    },
    pagina404: {
      titulo: { es: 'No encontramos esa página', en: 'We could not find that page' },
      texto: { es: 'Puede que se haya movido. Vuelve al inicio o revisa el producto.', en: 'It may have moved. Go back home or look at the product.' },
      botonInicio: { es: 'Volver al inicio', en: 'Back to home' },
      botonProducto: { es: 'Ver el producto', en: 'See the product' },
    },
  },

  // ============================================================
  // 21. TÍTULOS DE PESTAÑA Y DESCRIPCIONES SEO. Página y una entrada por sección.
  // La página usa el título y la descripción ya probados del registro. Cada sección tiene los suyos para el enlace con ancla,
  // la tarjeta al compartir ese enlace y el título de pestaña cuando la sección activa se escribe en document.title.
  // Reglas verificadas: título de 50 a 60 caracteres, descripción de 140 a 155, sin paréntesis, sin tiempo real, sin cifras.
  // ============================================================
  seo: {
    pagina: {
      titulo: { es: 'Rovaq AI | Inteligencia de ingresos de posventa', en: 'Rovaq AI | Post-Purchase Revenue Intelligence' }, // Spec 5.3: 47 y 45 caracteres. Solo la portada puede bajar de 50
      descripcion: { es: 'Rovaq AI cruza conversaciones, pedidos y reembolsos para mostrar dónde se concentra el ingreso en riesgo. Cada cifra trae su fuente y su fecha de corte.', en: 'Rovaq AI connects conversations, orders and refunds to show where revenue is at risk. Every figure comes with its source and its cut-off date.' },
    },
    secciones: {
      problema: {
        titulo: { es: 'El problema | Datos de posventa repartidos | Rovaq AI', en: 'The Problem | Scattered Post-Purchase Data | Rovaq AI' },
        descripcion: { es: 'Las conversaciones, los pedidos y los reembolsos viven en lugares distintos y nadie los cruza. Así se ve la fuga de ingreso antes de ordenar la evidencia.', en: 'Conversations, orders and refunds sit in different places and nobody connects them. This is how a revenue leak looks before the evidence is put in order.' },
        href: { es: '/#problema', en: '/en#problem' },
        enlaces: [
          { t: { es: 'Fuga de reembolsos', en: 'Refund leakage' }, href: { es: '/producto/fuga-de-reembolsos', en: '/en/product/refund-leakage' } },
          { t: { es: 'Carga y SLA', en: 'Workload and SLA' }, href: { es: '/producto/carga-y-sla', en: '/en/product/workload' } },
        ],
      },
      procedencia: {
        titulo: { es: 'Procedencia | Cada dato entra con su fuente | Rovaq AI', en: 'Provenance | Every Record Keeps Its Source | Rovaq AI' },
        descripcion: { es: 'Conversaciones de HubSpot y archivos de Excel y CSV entran con su fuente, su fecha de lectura y su huella. Los marketplaces se cargan hoy por exporte.', en: 'HubSpot conversations and Excel and CSV files come in with their source, read date and fingerprint. Marketplaces are loaded today through exports.' },
        href: { es: '/#procedencia', en: '/en#provenance' },
        enlaces: [
          { t: { es: 'Fuentes e importaciones', en: 'Sources and imports' }, href: { es: '/producto/fuentes-e-importaciones', en: '/en/product/sources-and-imports' } },
          { t: { es: 'Integraciones', en: 'Integrations' }, href: { es: '/integraciones', en: '/en/integrations' } },
        ],
      },
      clases: {
        titulo: { es: 'Clases de cifra | Observado, Estimado, Inferido | Rovaq AI', en: 'Figure Classes | Observed, Estimated, Inferred | Rovaq AI' },
        descripcion: { es: 'Cuatro clases de cifra y una regla: Observado, Estimado, Inferido y Sin dato. Cada una con su fuente y su fecha de corte. Lo desconocido no es cero.', en: 'Four figure classes and one rule: Observed, Estimated, Inferred and No data. Each with its source, cut-off date and age. What is unknown is never zero.' },
        href: { es: '/#clases', en: '/en#classes' },
        enlaces: [
          { t: { es: 'Confianza de los datos', en: 'Data trust' }, href: { es: '/producto/confianza-de-los-datos', en: '/en/product/data-trust' } },
          { t: { es: 'Acerca de Rovaq AI', en: 'About Rovaq AI' }, href: { es: '/acerca', en: '/en/about' } },
        ],
      },
      modulos: {
        titulo: { es: 'Cómo funciona | Cuatro módulos y una persona que decide', en: 'How It Works | Four Modules and a Person Who Decides' },
        descripcion: { es: 'Importa con procedencia, agrupa en problemas, cuantifica en ingreso bruto y decide con evidencia. Cuatro módulos que proponen; una persona aprueba.', en: 'Import with provenance, group into problems, quantify in gross revenue and decide with evidence. Four modules that propose; a person approves every action.' },
        href: { es: '/#modulos', en: '/en#modules' },
        enlaces: [
          { t: { es: 'Las diez pantallas', en: 'The ten screens' }, href: { es: '/producto', en: '/en/product' } },
          { t: { es: 'Por decidir', en: 'To decide' }, href: { es: '/producto/por-decidir', en: '/en/product/to-decide' } },
        ],
      },
      cambios: {
        titulo: { es: 'Lo que cambia | Cada número se puede discutir | Rovaq AI', en: 'What Changes | Every Number Can Be Debated | Rovaq AI' },
        descripcion: { es: 'Una cifra rastreable, un paquete de evidencia, una prioridad con citas y un reporte auditable. Cambios de método, sin cifras de ahorro ni de retorno.', en: 'A traceable figure, an evidence package, a priority with quotes and a report you can audit. Changes of method, with no figures of savings or return.' },
        href: { es: '/#cambios', en: '/en#changes' },
        enlaces: [
          { t: { es: 'Finanzas', en: 'Finance' }, href: { es: '/producto/finanzas', en: '/en/product/finance' } },
          { t: { es: 'Problemas', en: 'Problems' }, href: { es: '/producto/problemas', en: '/en/product/problems' } },
        ],
      },
      puestos: {
        titulo: { es: 'Casos de uso | Cada puesto ve lo que le corresponde', en: 'Use Cases | Each Role Sees What Belongs to It | Rovaq AI' },
        descripcion: { es: 'Propietario, analista, operador y lector ven solo lo que les toca. La autorización se decide en el servidor y ocultar un menú no protege una pantalla.', en: 'Owner, analyst, operator and viewer each see only what applies to them. Authorization is decided on the server and hiding a menu does not protect a screen.' },
        href: { es: '/#puestos', en: '/en#roles' },
        enlaces: [
          { t: { es: 'Casos de uso', en: 'Use cases' }, href: { es: '/casos-de-uso', en: '/en/use-cases' } },
          { t: { es: 'Propietario', en: 'Owner' }, href: { es: '/casos-de-uso/propietario', en: '/en/use-cases/owner' } },
        ],
      },
      pantallas: {
        titulo: { es: 'Seis pantallas | Cada una responde una pregunta | Rovaq AI', en: 'Six Screens | Each One Answers a Question | Rovaq AI' },
        descripcion: { es: 'Hoy, Fuga de reembolsos, Problemas, Pregúntale a tus datos, Por decidir y Confianza, con datos de ejemplo. Cada pantalla responde una pregunta.', en: 'Today, Refund leakage, Problems, Ask your data, To decide and Data trust, with example data. Each screen answers one question and shows its origin.' },
        href: { es: '/#pantallas', en: '/en#screens' },
        enlaces: [
          { t: { es: 'Producto', en: 'Product' }, href: { es: '/producto', en: '/en/product' } },
          { t: { es: 'Pregúntale a tus datos', en: 'Ask your data' }, href: { es: '/producto/pregunta-a-tus-datos', en: '/en/product/ask-your-data' } },
        ],
      },
      seguridad: {
        titulo: { es: 'Seguridad y privacidad | Lo que existe y lo que no', en: 'Security and Privacy | What Exists and What Does Not' },
        descripcion: { es: 'Aislamiento por organización, cuatro roles y conexiones de lectura. Sin certificaciones que no tenemos y con las brechas dichas de frente y fechadas.', en: 'Isolation per organization, four roles and read connections. No certifications we do not hold, with the gaps stated plainly and the review date shown.' },
        href: { es: '/#seguridad', en: '/en#security' },
        enlaces: [
          { t: { es: 'Seguridad y privacidad', en: 'Security and privacy' }, href: { es: '/seguridad-y-privacidad', en: '/en/security-and-privacy' } },
          { t: { es: 'Hoja de ruta', en: 'Roadmap' }, href: { es: '/hoja-de-ruta', en: '/en/roadmap' } },
        ],
      },
      integraciones: {
        titulo: { es: 'Integraciones | HubSpot y Excel hoy, marketplaces después', en: 'Integrations | HubSpot and Excel Today, Marketplaces Next' },
        descripcion: { es: 'Hoy se conecta HubSpot en solo lectura y se cargan archivos de Excel y CSV. Amazon, Walmart y Shopify están en hoja de ruta; sus exportes se cargan hoy.', en: 'Today you connect HubSpot read-only and load Excel and CSV files. Amazon, Walmart and Shopify are on the roadmap; their exports load today with help.' },
        href: { es: '/#integraciones', en: '/en#integrations' },
        enlaces: [
          { t: { es: 'Integraciones', en: 'Integrations' }, href: { es: '/integraciones', en: '/en/integrations' } },
          { t: { es: 'Fuentes e importaciones', en: 'Sources and imports' }, href: { es: '/producto/fuentes-e-importaciones', en: '/en/product/sources-and-imports' } },
        ],
      },
      limites: {
        titulo: { es: 'Lo que Rovaq AI no hace | Los límites del producto', en: 'What Rovaq AI Does Not Do | The Limits of the Product' },
        descripcion: { es: 'Sin margen, sin conversión de monedas, sin exposición como pérdida, sin agentes autónomos y sin certificaciones. Los límites son parte del producto.', en: 'No margin, no currency conversion, no exposure presented as a loss, no autonomous agents and no certifications. The limits are part of the product too.' },
        href: { es: '/#limites', en: '/en#limits' },
        enlaces: [
          { t: { es: 'Hoja de ruta', en: 'Roadmap' }, href: { es: '/hoja-de-ruta', en: '/en/roadmap' } },
          { t: { es: 'Finanzas', en: 'Finance' }, href: { es: '/producto/finanzas', en: '/en/product/finance' } },
        ],
      },
      faq: {
        titulo: { es: 'Preguntas frecuentes | Fuentes, IA, seguridad y acceso', en: 'Frequently Asked Questions | Sources, AI, Security, Access' },
        descripcion: { es: 'Respuestas directas sobre fuentes, actualización, ingreso bruto, uso de IA, reembolsos, seguridad y acceso. El precio todavía no está publicado.', en: 'Direct answers on sources, updates, gross revenue, AI use, refund claims, security and how to request access by email. Pricing is not published yet.' },
        href: { es: '/#faq', en: '/en#faq' },
        enlaces: [
          { t: { es: 'Seguridad y privacidad', en: 'Security and privacy' }, href: { es: '/seguridad-y-privacidad', en: '/en/security-and-privacy' } },
          { t: { es: 'Solicitar acceso', en: 'Request access' }, href: { es: '/solicitar-acceso', en: '/en/request-access' } },
        ],
      },
      cierre: {
        titulo: { es: 'Solicitar acceso | Revisa tus cifras con su evidencia', en: 'Request Access | Review Your Figures With Their Evidence' },
        descripcion: { es: 'Escríbenos con tu puesto y las herramientas que usas. Te decimos qué se puede cargar hoy y qué sigue en hoja de ruta. El precio no está publicado.', en: 'Write to us with your role and the tools you use. We tell you plainly what can load today and what is on the roadmap. Pricing is not published yet.' },
        href: { es: '/#cierre', en: '/en#closing' },
        enlaces: [
          { t: { es: 'Solicitar acceso', en: 'Request access' }, href: { es: '/solicitar-acceso', en: '/en/request-access' } },
          { t: { es: 'Acerca de Rovaq AI', en: 'About Rovaq AI' }, href: { es: '/acerca', en: '/en/about' } },
        ],
      },
    },
  },
} as const satisfies Nodo;

/** Qué claves alimentan cada sección de la portada (spec sección 6). */
export const PORTADA = {
  S1: ['hero', 'puente'],
  S3: ['problema'],
  S4: ['valor', 'clases'],
  S5: ['modulos'],
  S6: ['pantallas'],
  S7: ['puestos'],
  S8: ['seguridad', 'limites'],
  S9: ['integraciones', 'faq'],
  S10: ['cierre', 'pie'],
  transversal: ['carga', 'nav', 'mockups', 'imagenes', 'micro', 'hilo', 'seo'],
} as const;

/** Retirado de la portada y conservado para las páginas internas (spec 5.1.7). */
export const RETIRADAS_DE_PORTADA = ['anuncio', 'procedencia', 'cambios', 'carga.clases', 'carga.linea'] as const;
