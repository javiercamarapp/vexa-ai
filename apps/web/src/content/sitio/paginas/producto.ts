// Producto: el índice y una subpágina por pantalla (T11). Fuente: landing/producto/01-PANTALLAS-Y-FUNCIONES.md y seo/02-PLAN-POR-URL-DETALLE.md.
// Español de México y inglés de EE. UU. Sin paréntesis, sin signos de exclamación, sin emojis, sin cifras reales.
// Las páginas con una condición MATIZ sin verificar quedan pendientes de revisión.
import type { Pagina } from '../tipos.ts';
import { b, m } from '../ayudas.ts';
import { LANDING } from '../landing.ts';

const ROTULO = b('Datos de ejemplo. No son de un cliente.', 'Example data. Not from a customer.');
const CTA = b('Solicitar acceso', 'Request access');

const si = b('Sí', 'Yes');
const no = b('No', 'No');

export const PRODUCTO_INDICE: Pagina = {
  id: 'producto',
  estado: 'pendiente-de-revision',
  pendiente: 'El índice enlaza pantallas con condiciones MATIZ sin verificar: Problemas (condición 7), Carga y SLA y Fuentes e importaciones (condiciones 8 y 9).',
  seo: {
    titulo: b('Producto | Diez pantallas con una pregunta cada una', 'Product | Ten Screens, Each With One Question | Rovaq AI'),
    descripcion: b(
      'Recorre las diez pantallas de Rovaq AI: reembolsos, problemas, puntos de dolor, finanzas y más. Cada una responde una pregunta y muestra su origen.',
      'Walk through the ten Rovaq AI screens: refunds, problems, pain points, finance and more. Each answers one question and shows where its figure comes from.',
    ),
  },
  h1: b('Diez pantallas, cada una responde una pregunta', 'Ten screens, each one answers a question'),
  subtitulo: b(
    'Del resumen del día a la acción registrada, con cada cifra rotulada por su clase, su fuente y su fecha de corte.',
    'From the daily summary to the recorded action, with every figure labeled by class, source and cut-off date.',
  ),
  bloques: [
    { tipo: 'enlaces', titulo: b('Qué pregunta responde cada pantalla', 'The question each screen answers'), items: LANDING.nav.producto.items },
    {
      tipo: 'matriz',
      titulo: b('Qué puesto puede hacer qué', 'What each role can do'),
      columnas: [b('Administrador del espacio', 'Workspace administrator'), b('Analista', 'Analyst'), b('Operador', 'Operator'), b('Lectura', 'Read-only')],
      filas: [
        { t: b('Leer las pantallas que le corresponden', 'Read the screens that apply'), celdas: [si, si, si, si] },
        { t: b('Exportar descargas', 'Export downloads'), celdas: [si, si, si, si] },
        { t: b('Importar archivos', 'Import files'), celdas: [si, si, no, no] },
        { t: b('Proponer recomendaciones', 'Propose recommendations'), celdas: [si, si, si, no] },
        { t: b('Aprobar', 'Approve'), celdas: [si, no, no, no] },
        { t: b('Ejecutar intervenciones', 'Carry out interventions'), celdas: [si, no, si, no] },
        { t: b('Configurar conexiones, retención y equipo', 'Configure connections, retention and team'), celdas: [si, no, no, no] },
        { t: b('Ver cifras de dinero', 'See money figures'), celdas: [si, si, no, no] },
      ],
    },
    {
      tipo: 'texto',
      titulo: b('De dónde sale cada cifra', 'Where each figure comes from'),
      texto: b(
        'Bajo cada cifra importante va su sello: clase, fuente, fecha de corte y antigüedad. Si no se sabe la fecha de corte, el sello lo dice y no la rellena.',
        'Under every important figure goes its seal: class, source, cut-off date and age. If the cut-off date is unknown, the seal says so and does not fill it in.',
      ),
    },
    {
      tipo: 'limites',
      titulo: b('Lo que esta lista no incluye', 'What this list does not include'),
      items: [
        b('El mapa de problemas completo por dirección de envío está en la hoja de ruta. Hoy hay un mapa provisional con los casos del Tracker.', 'The full problem map by shipping address is on the roadmap. Today there is a provisional map built from Tracker cases.'),
        b('Las pantallas de administración de plataforma son del equipo de Rovaq y no forman parte del producto del cliente.', 'The platform administration screens belong to the Rovaq team and are not part of the customer product.'),
      ],
    },
  ],
  cta: CTA,
  rotulo: ROTULO,
};

/** Constructor de una subpágina por pantalla. */
function pantalla(a: Pagina): Pagina {
  return { rotulo: ROTULO, cta: CTA, ...a };
}

export const PRODUCTO_HOY: Pagina = pantalla({
  id: 'producto/hoy',
  estado: 'publicable',
  seo: {
    titulo: b('Hoy | Cuatro cifras con periodo, fórmula y cobertura', 'Today | Four Figures With Period, Formula, Coverage'),
    descripcion: b(
      'La pantalla Hoy reúne cuatro cifras con periodo, fórmula y cobertura. Si una cifra es parcial, Rovaq AI lo dice y no la presenta como un total completo.',
      'The Today screen gathers four figures with period, formula and coverage. When a figure is partial, Rovaq AI says so and never shows it as a full total.',
    ),
  },
  h1: b('Hoy: cuatro cifras con periodo, fórmula y cobertura', 'Today: four figures with period, formula and coverage'),
  subtitulo: b('Qué requiere atención hoy, con cada cifra rotulada por su clase y su fuente.', 'What needs attention today, with every figure labeled by its class and its source.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Qué muestra la pantalla', 'What the screen shows'),
      items: [
        b('Cuatro cifras clave: ingreso bruto, reembolsos, dinero atorado y respuestas de más de 24 horas, cada una con su periodo.', 'Four key figures: gross revenue, refunds, stuck money and replies over 24 hours, each with its period.'),
        b('Un bloque Requiere tu atención con alertas, como una fuga en un producto, solicitudes vencidas o hilos sin respuesta.', 'A Needs your attention block with alerts, such as a leak on one product, overdue requests or threads without a reply.'),
        b('La Siguiente acción sugerida y un botón para exportar el informe.', 'The Suggested next action and a button to export the report.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Cómo se lee una cifra parcial', 'How to read a partial figure'),
      texto: m(
        6,
        'Dinero atorado viene del Tracker de Excel por carga manual; las respuestas de más de 24 horas, de HubSpot. Es un hecho de producto: la condición va en el texto.',
        b(
          'Dinero atorado viene de un Tracker de Excel que se carga a mano y no trae fecha de corte. Las respuestas de más de 24 horas vienen de HubSpot. Cada cifra dice su cobertura y lo que todavía no se sabe.',
          'Stuck money comes from an Excel Tracker that is loaded by hand and carries no cut-off date. Replies over 24 hours come from HubSpot. Every figure states its coverage and what is still unknown.',
        ),
      ),
    },
    {
      tipo: 'limites',
      titulo: b('Qué no calcula', 'What it does not calculate'),
      items: [
        b('No calcula margen ni utilidad: el ingreso es bruto.', 'It does not calculate margin or profit: revenue is gross.'),
        b('No suma ni convierte monedas distintas, porque no hay un tipo de cambio aprobado.', 'It does not add or convert different currencies, because there is no approved exchange rate.'),
        b('Un estado vacío dice que no hay datos todavía y nunca lo muestra como cero.', 'An empty state says there is no data yet and never shows it as zero.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Quién la ve', 'Who sees it'),
      texto: b(
        'Los cuatro puestos, con vistas distintas. Administrador del espacio y analista ven las cuatro cifras. Operador y lectura ven una vista propia, sin cifras de dinero.',
        'All four roles, with different views. Workspace administrator and analyst see the four figures. The operator and read-only roles see a view of their own, without money figures.',
      ),
    },
  ],
});

export const PRODUCTO_FUGA: Pagina = pantalla({
  id: 'producto/fuga-de-reembolsos',
  estado: 'pendiente-de-revision',
  pendiente: 'Revisión de Responsable A. Condición 8: los marketplaces entran por exporte con ayuda del equipo; si hubiera autoservicio de exportes, se actualiza la frase.',
  seo: {
    titulo: b('Fuga de reembolsos | Dónde se concentra el dinero devuelto', 'Refund Leakage | Where Returned Money Concentrates'),
    descripcion: b(
      'Ve dónde se concentra el dinero devuelto por canal, producto y mes, y arma un paquete de evidencia para reclamar. Tú lo presentas; nada se envía solo.',
      'See where refunded money concentrates by channel, product and month, and build an evidence package for claims. You file it yourself; nothing is sent alone.',
    ),
  },
  h1: b('Fuga de reembolsos: dónde se concentra el dinero devuelto', 'Refund leakage: where returned money concentrates'),
  subtitulo: b('Una fuga que se puede localizar por canal, por producto y por mes.', 'A leak you can locate by channel, by product and by month.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Reembolsos por canal, producto y mes', 'Refunds by channel, product and month'),
      items: [
        b('Dónde se concentra el dinero devuelto y cuánto está atorado.', 'Where returned money concentrates and how much is stuck.'),
        b('Cambios entre meses completos comparables. Si todavía no hay dos meses completos, la pantalla lo dice.', 'Changes between comparable complete months. If there are not yet two complete months, the screen says so.'),
        b('Contacto repetido y un estimador con candado, que trabaja solo con los supuestos que escribes tú y no promete ningún monto.', 'Repeated contact and a locked estimator, which works only with the assumptions you enter and promises no amount.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('El paquete de evidencia', 'The evidence package'),
      texto: m(
        8,
        'El paquete se arma en el navegador y no envía nada. Los datos de Amazon, Walmart y Shopify entran por exportes cargados con ayuda del equipo.',
        b(
          'Genera un paquete de evidencia por producto, en HTML y CSV, y una lista de productos para el proveedor. Todo se arma en tu navegador y la pantalla confirma que no se envió nada. Tú lo revisas y presentas el reclamo.',
          'Generate an evidence package per product, as HTML and CSV, and a list of products for the supplier. Everything is built in your browser and the screen confirms that nothing was sent. You review it and you file the claim.',
        ),
      ),
    },
    {
      tipo: 'limites',
      titulo: b('Qué no promete', 'What it does not promise'),
      items: [
        b('No promete ningún monto recuperado. Lo recuperable es una estimación con supuestos tuyos.', 'It does not promise any recovered amount. What is recoverable is an estimate with assumptions of yours.'),
        b('No calcula la tasa de reembolso por producto, el margen, la pérdida neta ni la causa raíz, porque faltan datos en los exportes.', 'It does not calculate the refund rate per product, margin, net loss or root cause, because the exports lack the data.'),
        b('Hoy no hay conectores directos con Amazon, Walmart ni Shopify: sus exportes se cargan con ayuda de nuestro equipo.', 'Today there are no direct connectors for Amazon, Walmart or Shopify: their exports are loaded with help from our team.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Quién la ve', 'Who sees it'),
      texto: b('Administrador del espacio y analista. Operador y lectura no ven cifras de dinero.', 'Workspace administrator and analyst. The operator and read-only roles do not see money figures.'),
    },
  ],
});

export const PRODUCTO_PROBLEMAS: Pagina = pantalla({
  id: 'producto/problemas',
  estado: 'pendiente-de-revision',
  pendiente: 'Condición 7: exposición solo con vínculos de problema a pedido confirmados; problem_conversations tiene 0 filas al 2026-10-29. Revisión de Responsable A.',
  seo: {
    titulo: b('Problemas | Lo que dicen tus clientes, con evidencia', 'Problems | What Your Customers Say, With Evidence | Rovaq AI'),
    descripcion: b(
      'Rovaq AI agrupa lo que dicen tus clientes en problemas con citas enmascaradas y una exposición inferida de ingreso. Es una estimación, no una pérdida.',
      'Rovaq AI groups what your customers say into problems with masked quotes and an inferred revenue exposure. It is an estimate, not a confirmed loss.',
    ),
  },
  h1: b('Problemas: lo que dicen tus clientes, con evidencia', 'Problems: what your customers say, with evidence'),
  subtitulo: b('Qué problema atender primero y con qué casos.', 'Which problem to tackle first and with which cases.'),
  bloques: [
    {
      tipo: 'texto',
      titulo: b('De conversaciones a problemas', 'From conversations to problems'),
      texto: m(
        3,
        'Estado al 2026-10-29: la extracción corre en producción, casi toda por lotes, y problem_conversations tiene 0 filas. Se redacta como capacidad y sin extracción en vivo por conversación nueva.',
        b(
          'Cada problema se presenta con su volumen, su estado de cobertura y su evidencia cuando hay vínculos confirmados. La agrupación con modelos de IA se habilita por organización, se procesa por lotes y una persona la revisa.',
          'Each problem is presented with its volume, its coverage status and its evidence when links are confirmed. Grouping with AI models is enabled per organization, runs in batches and a person reviews it.',
        ),
      ),
    },
    {
      tipo: 'lista',
      titulo: b('Citas enmascaradas', 'Masked quotes'),
      items: [
        b('Cada problema abre una ficha con cifras, tendencia mensual y citas con correos y teléfonos enmascarados, cuando hay vínculos confirmados.', 'Each problem opens a record with figures, a monthly trend and quotes with masked emails and phone numbers, when links are confirmed.'),
        b('La evidencia se puede recorrer hasta la fila de origen y la ficha dice qué acceso se comprobó en cada paso.', 'The evidence can be followed to the source row and the record says which access was checked at each step.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Exposición inferida, no pérdida', 'Inferred exposure, not loss'),
      texto: m(
        7,
        'La exposición solo existe con vínculos de problema a pedido confirmados por un administrador del espacio; sin ellos la pantalla dice No disponible.',
        b(
          'La exposición económica es una cifra Inferida: el ingreso de los pedidos ligados al problema. No equivale a una pérdida y no se suma entre problemas. Sin vínculos confirmados por un administrador del espacio, la pantalla dice que no está disponible y no la muestra como cero.',
          'Economic exposure is an Inferred figure: the revenue of the orders linked to the problem. It is not a loss and is not added across problems. Without links confirmed by a workspace administrator, the screen says it is not available and does not show it as zero.',
        ),
      ),
    },
    {
      tipo: 'texto',
      titulo: b('Quién la ve', 'Who sees it'),
      texto: b('Los cuatro puestos. El dinero y la exposición, solo administrador del espacio y analista.', 'All four roles. Money and exposure, workspace administrator and analyst only.'),
    },
  ],
});

export const PRODUCTO_PUNTOS: Pagina = pantalla({
  id: 'producto/puntos-de-dolor',
  estado: 'publicable',
    seo: {
    titulo: b('Puntos de dolor | Qué motivo se repite y cuánto arrastra', 'Pain Points | Which Reason Repeats and What It Carries'),
    descripcion: b(
      'De las conversaciones de soporte a un mapa de burbujas por volumen o por dinero. Exporta sin datos personales y separa lo que se repite de lo que importa.',
      'From support conversations to a bubble map by volume or money. Export without personal data and tell what merely repeats from what really matters.',
    ),
  },
  h1: b('Puntos de dolor: qué motivo se repite y cuánto arrastra', 'Pain points: which reason repeats and what it carries'),
  subtitulo: b('Separa lo que se repite de lo que cuesta.', 'Tell what repeats from what costs.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Mapa de burbujas', 'Bubble map'),
      items: [
        b('Cada burbuja es un punto de dolor. Su tamaño es el dinero devuelto en dólares brutos o el volumen, a elegir.', 'Each bubble is a pain point. Its size is returned money in gross dollars or volume, your choice.'),
        b('Los ocho mayores salen en la gráfica y en una tabla accesible, con filtro por tema.', 'The eight largest appear in the chart and in an accessible table, with a topic filter.'),
        b('Cada fila abre su evidencia hasta la fila de origen.', 'Each row opens its evidence down to the source row.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Exportación sin datos personales', 'Export without personal data'),
      texto: b(
        'Exporta la evidencia en CSV por punto de dolor, sin datos personales. Lo que no se sabe dice Sin dato y nunca cero.',
        'Export the evidence as CSV per pain point, without personal data. What is not known says No data and never zero.',
      ),
    },
    {
      tipo: 'limites',
      titulo: b('Qué no hace', 'What it does not do'),
      items: [
        b('Un tema repetido no es un tema que cuesta: la pantalla pone al lado el dinero que arrastra, cuando existe.', 'A repeated theme is not a theme that costs: the screen puts the money it carries beside it, when it exists.'),
        b('Si una fuente no respondió, esos puntos salen como No disponible ahora y no como cero.', 'If a source did not respond, those points show as Not available now and not as zero.'),
      ],
    },
  ],
});

export const PRODUCTO_PREGUNTALE: Pagina = pantalla({
  id: 'producto/pregunta-a-tus-datos',
  estado: 'publicable',
  seo: {
    titulo: b('Pregúntale a tus datos | Cifras calculadas, pasos visibles', 'Ask Your Data | Calculated Figures, Visible Steps | Rovaq AI'),
    descripcion: b(
      'Pregunta por tus ventas y clientes y recibe cifras calculadas con los pasos a la vista. Usa reglas y herramientas de solo lectura, con presupuesto mensual.',
      'Ask about your sales and customers and get calculated figures with every step in view. It uses rules and read-only tools and respects a monthly budget.',
    ),
  },
  h1: b('Pregúntale a tus datos: cifras calculadas, pasos visibles', 'Ask your data: calculated figures, visible steps'),
  subtitulo: b('Cómo se llegó a esta cifra, a la vista.', 'How this figure was reached, in plain view.'),
  bloques: [
    {
      tipo: 'texto',
      titulo: b('Cómo se calcula una respuesta', 'How an answer is calculated'),
      texto: m(
        2,
        'Verificada por código el 2026-10-29: el agente general corre en modo determinista, sin interruptor de IA. Si se agrega un rol data_agent al gateway, esta página se reescribe.',
        b(
          'Escribes una pregunta y recibes cifras, tablas y gráficas, cada una con su clase y su cobertura. Las cifras salen de herramientas de solo lectura y se calculan con reglas, sin modelo de lenguaje.',
          'You type a question and get figures, tables and charts, each with its class and coverage. Figures come from read-only tools and are calculated with rules, without a language model.',
        ),
      ),
    },
    {
      tipo: 'lista',
      titulo: b('Pasos a la vista', 'Steps in view'),
      items: [
        b('Cada respuesta se puede abrir en Cómo llegué a esto, con los pasos, los parámetros, el método y la fuente.', 'Each answer can be opened in How I got here, with the steps, the parameters, the method and the source.'),
        b('Los pasos los registró el sistema; no son el razonamiento interno de un modelo.', 'The steps were recorded by the system; they are not the internal reasoning of a model.'),
        b('Puedes copiar, descargar en CSV, valorar la respuesta y adjuntar un archivo de hasta 1 MB que se analiza solo en tu navegador.', 'You can copy, download as CSV, rate the answer and attach a file of up to 1 MB that is analyzed only in your browser.'),
      ],
    },
    {
      tipo: 'limites',
      titulo: b('Qué no hace', 'What it does not do'),
      items: [
        b('Esto describe el agente general de esta pantalla. El modo de Finanzas tiene su propio motor y no afirmamos que sea solo de reglas.', 'This describes the general agent of this screen. The Finance mode has its own engine and we do not claim it is rules only.'),
        b('No usa un modelo de lenguaje para responder y no busca en internet.', 'It does not use a language model to answer and does not search the internet.'),
        b('Cuando no tiene el dato, lo dice y no lo inventa. Si la pregunta no corresponde a una consulta disponible, pide aclararla.', 'When it does not have the data, it says so and does not invent it. If the question does not match an available query, it asks you to clarify.'),
        b('El presupuesto mensual limita las consultas; al agotarse quedan las consultas directas.', 'The monthly budget limits queries; when it runs out, direct queries remain.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Quién la ve', 'Who sees it'),
      texto: b('Los cuatro puestos. El operador recibe totales y no clientes concretos.', 'All four roles. The operator receives totals and not specific customers.'),
    },
  ],
});

export const PRODUCTO_POR_DECIDIR: Pagina = pantalla({
  id: 'producto/por-decidir',
  estado: 'publicable',
  seo: {
    titulo: b('Por decidir | Propuesta, decisión de una persona y resultado', 'To Decide | Proposal, a Person Decides, Outcome Recorded'),
    descripcion: b(
      'Cada propuesta llega con su evidencia, un responsable y el registro del resultado. Una persona decide con Proceder, Ajustar o Descartar; nada corre solo.',
      'Each proposal comes with evidence, a responsible person and a recorded outcome. A person decides with Proceed, Adjust or Dismiss; nothing runs on its own.',
    ),
  },
  h1: b('Por decidir: propuesta, decisión de una persona y resultado', 'To decide: proposal, a person decides, outcome recorded'),
  subtitulo: b('Qué se propone y quién decide.', 'What is proposed and who decides.'),
  bloques: [
    {
      tipo: 'texto',
      titulo: b('El ciclo de una propuesta', 'The life of a proposal'),
      texto: m(
        4,
        'Migración del flujo aplicada en producción al 2026-10-29, pero con 0 eventos: se describe solo lo que el producto permite, sin resultados ni casos.',
        b(
          'Cada recomendación trae su evidencia, por qué se sugiere y qué se espera lograr. Una persona decide, y el resultado queda registrado con su medición antes y después, solo con dato observado.',
          'Each recommendation brings its evidence, why it is suggested and what is expected. A person decides, and the outcome is recorded with its before and after measurement, using observed data only.',
        ),
      ),
    },
    {
      tipo: 'lista',
      titulo: b('Proceder, Ajustar o Descartar', 'Proceed, Adjust or Dismiss'),
      items: [
        b('Proceder crea la intervención y los borradores que una persona revisa y envía. Nada se envía solo.', 'Proceed creates the intervention and the drafts that a person reviews and sends. Nothing is sent automatically.'),
        b('Ajustar y Descartar piden una razón, que queda registrada. Reabrir una propuesta descartada crea un evento nuevo y no borra nada.', 'Adjust and Dismiss ask for a reason, which is recorded. Reopening a dismissed proposal creates a new event and deletes nothing.'),
        b('Proponer: administrador del espacio, analista y operador. Aprobar: solo el administrador del espacio. Ejecutar: administrador del espacio y operador.', 'Propose: workspace administrator, analyst and operator. Approve: workspace administrator only. Carry out: workspace administrator and operator.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Registro del resultado', 'Outcome record'),
      texto: b(
        'En curso muestra el responsable, el compromiso, las etapas y los borradores. Resultados mide antes y después y nunca presenta un ahorro supuesto.',
        'In progress shows the workspace administrator, the commitment, the stages and the drafts. Outcomes measures before and after and never presents an assumed saving.',
      ),
    },
  ],
});

export const PRODUCTO_CARGA: Pagina = pantalla({
  id: 'producto/carga-y-sla',
  estado: 'pendiente-de-revision',
  pendiente: 'Condición 9: HubSpot acreditado sobre una muestra. La cobertura de HubSpot aparece incompleta en producción al 2026-10-29. Hoy es la única fuente de conversaciones.',
  seo: {
    titulo: b('Carga y SLA | Horas pico y riesgo de pasar de 24 horas', 'Workload and SLA | Peak Hours and 24-Hour Risk | Rovaq AI'),
    descripcion: b(
      'Mide la carga de tu equipo de atención por hora y detecta qué conversaciones corren riesgo de pasar de 24 horas sin respuesta. Hoy con datos de HubSpot.',
      'Measure your support team workload by hour and spot which conversations risk passing 24 hours without a reply. Available today with HubSpot data only.',
    ),
  },
  h1: b('Carga y SLA: horas pico y riesgo de pasar de 24 horas', 'Workload and SLA: peak hours and 24-hour risk'),
  subtitulo: b('A qué hora hace falta gente y cuántos hilos pasan de 24 horas.', 'When people are needed and how many threads pass 24 hours.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Carga por hora', 'Workload by hour'),
      items: [
        b('Un mapa de calor de conversaciones nuevas por hora y por día, en hora de la Ciudad de México y solo con meses completos.', 'A heat map of new conversations by hour and day, in Mexico City time and with complete months only.'),
        b('Cierre y reaperturas, hilos abiertos por edad y primera respuesta con su base de cálculo.', 'Closing and reopenings, open threads by age and first reply with its calculation basis.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Conversaciones en riesgo', 'Conversations at risk'),
      texto: b(
        'Cuenta cuántos hilos medibles corren riesgo de pasar de 24 horas sin una primera respuesta de agente, para poner gente a tiempo.',
        'It counts how many measurable threads risk passing 24 hours without a first agent reply, so you can staff in time.',
      ),
    },
    {
      tipo: 'texto',
      titulo: b('Fuente de datos disponible hoy', 'Data source available today'),
      texto: m(
        9,
        'Solo HubSpot, en solo lectura, con cobertura limitada a lo que su API expone.',
        b(
          'La fuente es HubSpot, en solo lectura. Cuando la cobertura es baja, la pantalla avisa que no sirve para planear turnos y no estima lo que falta.',
          'The source is HubSpot, read-only. When coverage is low, the screen warns that it is not suitable for planning shifts and does not estimate what is missing.',
        ),
      ),
    },
    {
      tipo: 'texto',
      titulo: b('Quién la ve', 'Who sees it'),
      texto: b('Administrador del espacio y analista.', 'Workspace administrator and analyst.'),
    },
  ],
});

export const PRODUCTO_CONFIANZA: Pagina = pantalla({
  id: 'producto/confianza-de-los-datos',
  estado: 'publicable',
  seo: {
    titulo: b('Confianza de los datos | Frescura, cobertura y lo que falta', 'Data Trust | Freshness, Coverage and What Is Unknown'),
    descripcion: b(
      'Antes de decidir, revisa hasta qué fecha llegan tus datos, qué cubren y qué no se sabe. Es confianza en los datos, no una certificación de seguridad.',
      'Before you decide, check the date your data reaches, how much it covers and what is still unknown. It is trust in the data, not a security certification.',
    ),
  },
  h1: b('Confianza de los datos: frescura, cobertura y lo que no se sabe', 'Data trust: freshness, coverage and what is unknown'),
  subtitulo: b('Cuánto fiarse de una cifra.', 'How much to trust a figure.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Frescura y cobertura', 'Freshness and coverage'),
      items: [
        b('Un semáforo por fuente: Al día, Carga manual, Atrasada, Alerta, En pausa o Sin datos.', 'A traffic light per source: Up to date, Manual load, Delayed, Alert, Paused or No data.'),
        b('La frescura de cada cifra: cuándo se recalculó y hasta qué fecha llegan sus datos.', 'The freshness of each figure: when it was recalculated and the date its data reaches.'),
        b('La cobertura, con ventanas por canal.', 'Coverage, with windows per channel.'),
        b('Un panel Cómo se calculó en cada cifra, con su origen, su periodo y su fórmula.', 'A How it was calculated panel on each figure, with its origin, period and formula.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Lo que aún no se sabe', 'What is still unknown'),
      texto: b(
        'Qué no sabemos es una lista de tareas: la cifra afectada, qué la cierra y su base. Una fuente que nunca corrió aparece como Sin datos y no como Al día. Las cargas manuales no generan alerta.',
        'What we do not know is a task list: the affected figure, what closes it and its basis. A source that never ran appears as No data and not as Up to date. Manual loads do not raise an alert.',
      ),
    },
    {
      tipo: 'texto',
      titulo: b('Confianza de datos no es certificación', 'Data trust is not certification'),
      texto: b(
        'Esta pantalla habla de la calidad de las cifras. No es una certificación de seguridad ni de cumplimiento.',
        'This screen is about the quality of the figures. It is not a security or compliance certification.',
      ),
    },
  ],
});

export const PRODUCTO_FUENTES: Pagina = pantalla({
  id: 'producto/fuentes-e-importaciones',
  estado: 'pendiente-de-revision',
  pendiente: 'Condiciones 8 y 9: marketplaces por exporte con ayuda del equipo; HubSpot acreditado sobre una muestra.',
  seo: {
    titulo: b('Fuentes e importaciones | HubSpot y archivos hoy | Rovaq AI', 'Sources and Imports | HubSpot and Files Today | Rovaq AI'),
    descripcion: b(
      'Conecta HubSpot en solo lectura y carga exportes de Excel y CSV con vista previa y procedencia por fila. Los marketplaces entran hoy por exporte.',
      'Connect HubSpot read-only and load Excel and CSV exports with preview and per-row provenance. Marketplaces come in today as exports, not connectors.',
    ),
  },
  h1: b('Fuentes e importaciones: HubSpot y archivos hoy', 'Sources and imports: HubSpot and files today'),
  subtitulo: b('Qué está cargado y desde cuándo.', 'What is loaded and since when.'),
  bloques: [
    {
      tipo: 'texto',
      titulo: b('HubSpot en solo lectura', 'HubSpot, read-only'),
      texto: m(
        9,
        'Conexión de solo lectura que alta el equipo de Rovaq con la credencial del cliente; cobertura limitada a lo que la API de HubSpot expone.',
        b(
          'Fuentes conectadas muestra las cuentas autorizadas, con qué permisos y cuándo se sincronizó por última vez. La conexión se hace entre el administrador del espacio y nuestro equipo; el acceso nunca se escribe en pantalla.',
          'Connected sources shows the authorized accounts, with which permissions and when they last synced. The connection is made between the workspace administrator and our team; the access key is never typed on screen.',
        ),
      ),
    },
    {
      tipo: 'lista',
      titulo: b('Importar Excel y CSV con vista previa', 'Import Excel and CSV with preview'),
      items: [
        b('Archivos CSV o Excel de hasta 20 MiB, con configuración de columnas y vista previa de las filas leídas.', 'CSV or Excel files up to 20 MiB, with column setup and a preview of the rows read.'),
        b('Validar no es lo mismo que ingerir: primero revisas la vista previa y después cargas.', 'Validating is not the same as ingesting: you review the preview first and load afterwards.'),
        b('Cada registro conserva su fuente, su fecha de lectura y su huella de contenido. Un registro inválido va a cuarentena con su motivo.', 'Every record keeps its source, its read date and its content fingerprint. An invalid record goes to quarantine with its reason.'),
        b('El progreso de cada carga se actualiza solo y los errores se descargan en CSV.', 'Progress for each load refreshes by itself and errors can be downloaded as CSV.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Marketplaces por exporte', 'Marketplaces by export'),
      texto: m(
        8,
        'Hoy no hay carga de autoservicio para los exportes de marketplaces; entran con ayuda del equipo.',
        b(
          'Los pedidos y reembolsos de Amazon, Walmart y Shopify se cargan como archivos de exporte, con ayuda de nuestro equipo. Los conectores directos están en la hoja de ruta.',
          'Orders and refunds from Amazon, Walmart and Shopify are loaded as export files, with help from our team. Direct connectors are on the roadmap.',
        ),
      ),
    },
    {
      tipo: 'texto',
      titulo: b('Quién carga', 'Who loads'),
      texto: b('Ven los cuatro puestos. Cargan administrador del espacio y analista. Configura la conexión solo el administrador del espacio.', 'All four roles can see. Workspace administrator and analyst load. Only the workspace administrator configures the connection.'),
    },
  ],
});

export const PRODUCTO_FINANZAS: Pagina = pantalla({
  id: 'producto/finanzas',
  estado: 'publicable',
  seo: {
    titulo: b('Finanzas | Informe por moneda, sin mezclar bases | Rovaq AI', 'Finance | A Report by Currency, Bases Never Mixed | Rovaq AI'),
    descripcion: b(
      'Informes de ingreso bruto por moneda y por corte, sin mezclar bases. Rovaq AI no calcula margen y marca como parcial toda cifra sin conciliación completa.',
      'Gross revenue reports by currency and by cutoff, bases never mixed. Rovaq AI does not calculate margin and flags any figure with incomplete reconciliation.',
    ),
  },
  h1: b('Finanzas: informe por moneda, sin mezclar bases', 'Finance: a report by currency, bases never mixed'),
  subtitulo: b('Qué dice el informe por moneda.', 'What the report says by currency.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Ingreso bruto por moneda', 'Gross revenue by currency'),
      items: [
        b('Ingresos, pedidos, reembolsos y tasa de reembolso por moneda, con una serie de 12 meses y la mezcla por canal.', 'Revenue, orders, refunds and refund rate by currency, with a 12-month series and the mix by channel.'),
        b('La comparativa mensual solo entre meses completos; los meses incompletos van punteados.', 'The monthly comparison only between complete months; incomplete months are dotted.'),
        b('Una proyección a tres meses con rango, marcada como Estimado, que no se muestra con menos de cuatro meses completos.', 'A three-month projection with a range, labeled Estimated, which is not shown with fewer than four complete months.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Cortes y conciliación', 'Cutoffs and reconciliation'),
      texto: b(
        'Cada cifra declara su moneda, su base y su periodo. Lo que falta aparece como una lista de tareas y no como un cero. Una cifra con conciliación incompleta se marca como parcial. El informe se exporta en CSV y PDF con las mismas cifras de la pantalla.',
        'Every figure states its currency, basis and period. What is missing appears as a task list and not as a zero. A figure with incomplete reconciliation is flagged as partial. The report is exported as CSV and PDF with the same figures as the screen.',
      ),
    },
    {
      tipo: 'limites',
      titulo: b('Qué no calcula', 'What it does not calculate'),
      items: [
        b('No calcula margen ni utilidad: todo es ingreso bruto.', 'It does not calculate margin or profit: everything is gross revenue.'),
        b('No suma ni convierte USD, CAD y MXN, y no resta reembolsos de ingresos porque son bases distintas.', 'It does not add or convert USD, CAD and MXN, and does not subtract refunds from revenue because they are different bases.'),
        b('La exposición por problema aparece como No disponible hasta que cada problema se vincule con sus pedidos.', 'Exposure per problem shows as Not available until each problem is linked to its orders.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Quién la ve', 'Who sees it'),
      texto: b('Administrador del espacio y analista. Operador y lectura reciben un aviso de que su puesto no tiene acceso a este panel.', 'Workspace administrator and analyst. The operator and read-only roles get a notice that their role has no access to this panel.'),
    },
  ],
});

export const PAGINAS_PRODUCTO: readonly Pagina[] = [
  PRODUCTO_INDICE,
  PRODUCTO_HOY,
  PRODUCTO_FUGA,
  PRODUCTO_PROBLEMAS,
  PRODUCTO_PUNTOS,
  PRODUCTO_PREGUNTALE,
  PRODUCTO_POR_DECIDIR,
  PRODUCTO_CARGA,
  PRODUCTO_CONFIANZA,
  PRODUCTO_FUENTES,
  PRODUCTO_FINANZAS,
];
