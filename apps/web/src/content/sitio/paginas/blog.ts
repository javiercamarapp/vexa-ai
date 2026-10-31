// Blog de Rovaq AI (T24): el índice (id blog) y el artículo a1, que sirve de ejemplar de forma y de tono para los demás.
// Fuente: SEO 02-PLAN-POR-URL-DETALLE filas 26 y 27. El índice no lista nada a mano: sale del registro y muestra solo los artículos publicables.
// Reglas: autor siempre la organización, ninguna cifra inventada, ningún cliente, ninguna certificación, y solo lo que P-D marca como PUBLICO
// o MATIZ con su condición. Enlaces internos dentro del texto con {{id|texto}}; se enlazan solo las páginas que se publican.
import type { Articulo, Pagina } from '../tipos.ts';
import { articulo, b, cita, h2, h3, noAfirmamos, p, ul } from '../ayudas.ts';

export const BLOG_INDICE: Pagina = {
  id: 'blog',
  estado: 'publicable',
  seo: {
    titulo: b('Blog de Rovaq AI | Reembolsos, procedencia y decisiones', 'The Rovaq AI Blog | Refunds, Provenance and Decisions'),
    descripcion: b(
      'Artículos sobre cómo leer reembolsos, procedencia de cifras, puntos de dolor y decisiones con evidencia en negocios que venden por marketplaces.',
      'Articles on reading refunds, the provenance of figures, pain points and evidence-based decisions for businesses that sell through marketplaces.',
    ),
  },
  h1: b('Blog de Rovaq AI', 'Rovaq AI blog'),
  subtitulo: b(
    'Notas sobre reembolsos, la procedencia de las cifras, los puntos de dolor y las decisiones con evidencia.',
    'Notes on refunds, the provenance of figures, pain points and decisions backed by evidence.',
  ),
  bloques: [
    {
      tipo: 'articulos',
      titulo: b('Artículos recientes', 'Recent articles'),
      vacio: b('Todavía no hay artículos publicados.', 'There are no published articles yet.'),
    },
    {
      tipo: 'lista',
      titulo: b('Temas', 'Topics'),
      items: [
        b('Reembolsos: dónde se concentra el dinero devuelto y qué evidencia hace falta para presentar un reclamo.', 'Refunds: where returned money concentrates and what evidence it takes to file a claim.'),
        b('Procedencia: la fuente, la fecha de corte y lo que todavía no se sabe de cada cifra.', 'Provenance: the source, the cut-off date and what is still unknown about each figure.'),
        b('Puntos de dolor: cómo pasar del texto libre de las conversaciones a una prioridad con tamaño y evidencia.', 'Pain points: how to go from the free text of conversations to a priority with size and evidence.'),
        b('Decisiones: propuestas con evidencia, una persona que decide y un resultado que queda registrado.', 'Decisions: proposals with evidence, a person who decides and an outcome that gets recorded.'),
      ],
    },
  ],
  cta: b('Solicitar acceso', 'Request access'),
};

export const ARTICULO_A1: Articulo = articulo({
  id: 'a1',
  pub: '2026-11-03',
  etiqueta: b('Reembolsos', 'Refunds'),
  seo: {
    titulo: b('Reembolsos: una fuga que se puede localizar | Rovaq AI', 'Refunds Are Not a Fixed Cost, They Are a Leak | Rovaq AI'),
    descripcion: b(
      'Un total único de reembolsos no dice qué atender primero. Aprende a leer el dinero devuelto por canal, producto y mes, y qué lleva un paquete de evidencia.',
      'A single refund total does not say what to tackle first. Learn to read returned money by channel, product and month, and what an evidence package holds.',
    ),
  },
  h1: b('Los reembolsos no son un costo fijo: son una fuga que se puede localizar', 'Refunds are not a fixed cost: they are a leak you can locate'),
  subtitulo: b(
    'Un total único no dice qué atender primero. Por canal, por producto y por mes, el dinero devuelto empieza a tener forma.',
    'A single total does not say what to tackle first. By channel, by product and by month, returned money starts to take shape.',
  ),
  resumen: b(
    'Un total de reembolsos mezcla cosas que no se parecen. Este artículo explica cómo separar el dinero devuelto por canal, producto y mes, cómo leer un Pareto sin pedirle más de lo que da y qué debe llevar un paquete de evidencia para que un reclamo se pueda revisar.',
    'A refund total mixes things that are not alike. This article explains how to split returned money by channel, product and month, how to read a Pareto without asking more of it than it gives, and what an evidence package should hold so a claim can be reviewed.',
  ),
  relacionados: ['fuga-de-reembolsos', 'a2', 'confianza-de-los-datos', 'analista'],
  bloques: [
    p(
      'Muchos equipos de comercio electrónico tratan los reembolsos como un costo de operar: un porcentaje que se acepta, se presupuesta y se revisa una vez al mes. El total sube o baja, alguien pregunta por qué y la conversación termina en una explicación general sobre la temporada, las devoluciones o los clientes exigentes.',
      'Many e-commerce teams treat refunds as a cost of doing business: a percentage that is accepted, budgeted and reviewed once a month. The total goes up or down, someone asks why, and the conversation ends with a general explanation about the season, returns or demanding customers.',
    ),
    p(
      'Esa lectura tiene un problema. Un número único mezcla cosas que no se parecen, y lo que no se separa no se puede atender. Este artículo propone otra postura: tratar el dinero devuelto como una fuga, es decir, algo que tiene un lugar, una forma y, con trabajo, un responsable.',
      'That reading has a problem. A single number mixes things that are not alike, and what is not separated cannot be handled. This article proposes a different stance: treat returned money as a leak, something that has a place, a shape and, with some work, an owner.',
    ),
    h2('Por qué un total único no sirve', 'Why a single total fails'),
    p(
      'Imagina que el total de reembolsos de un mes es igual al del mes anterior. La lectura cómoda es que no pasó nada. Pero ese mismo total puede esconder que un canal mejoró y otro empeoró, o que un solo producto concentra casi todo el movimiento mientras el resto se mantiene estable. Dos meses con el mismo total pueden contar historias opuestas.',
      'Imagine the refund total for one month equals the previous month. The comfortable reading is that nothing happened. But that same total can hide that one channel improved while another got worse, or that a single product accounts for almost all the movement while the rest stays steady. Two months with the same total can tell opposite stories.',
    ),
    p(
      'Un total responde cuánto, pero no responde dónde ni cuándo, y esas son las preguntas que llevan a alguien a hacer algo. Si el número no te dice qué abrir primero, solo sirve para preocuparse.',
      'A total answers how much, but it does not answer where or when, and those are the questions that get someone to act. If the number does not tell you what to open first, all it does is worry you.',
    ),
    cita(
      'Un total dice cuánto. Para actuar hace falta saber dónde, cuándo y con qué evidencia.',
      'A total says how much. To act, you need to know where, when and with what evidence.',
    ),
    p(
      'Tampoco ayuda comparar cualquier mes contra cualquier mes. Un mes a medias frente a uno completo hace que todo parezca una mejora, o un desastre, según el orden en que los pongas. Una comparación honesta enfrenta meses completos y comparables. Y cuando todavía no hay dos así, lo más útil que puede hacer una herramienta es decirlo en lugar de dibujar una tendencia que no existe.',
      'It does not help to compare any month against any month either. A half month against a full one makes everything look like an improvement, or a disaster, depending on the order you put them in. An honest comparison sets complete, comparable months side by side. And when there are not yet two of them, the most useful thing a tool can do is say so instead of drawing a trend that does not exist.',
    ),
    h2('Cómo se lee un Pareto de reembolsos', 'How to read a refund Pareto'),
    p(
      'Un Pareto es una gráfica sencilla: ordena las categorías de mayor a menor y muestra cuánto del total acumula cada una. En reembolsos, la idea es elegir el eje que quieres investigar y ver si unas pocas barras explican buena parte del dinero devuelto. No hace falta que se cumpla ninguna proporción mágica. Lo que importa es que la distribución casi nunca es pareja, y la forma de la gráfica te dice por dónde empezar.',
      'A Pareto is a simple chart: it sorts categories from largest to smallest and shows how much of the total each one adds up to. For refunds, the idea is to pick the axis you want to investigate and see whether a few bars explain a good part of the returned money. No magic ratio has to hold. What matters is that the distribution is almost never even, and the shape of the chart tells you where to begin.',
    ),
    p(
      'Conviene leerlo en tres cortes, uno a la vez:',
      'It helps to read it in three cuts, one at a time:',
    ),
    ul(
      ['Por canal. Muestra si el problema vive en un lugar de venta concreto o si es general. Si un canal concentra el movimiento, la conversación es con ese canal y con sus reglas, no con todo el negocio.', 'By channel. It shows whether the problem lives in one particular place of sale or is widespread. If one channel concentrates the movement, the conversation is with that channel and its rules, not with the whole business.'],
      ['Por producto. Señala qué artículos suman más dinero devuelto. Un producto en la cima puede ser un asunto de descripción, de empaque o de proveedor; el corte no lo dice, pero te dice a quién preguntar.', 'By product. It points to which items add up to the most returned money. A product at the top may be a matter of description, packaging or supplier; the cut does not say which, but it tells you whom to ask.'],
      ['Por mes. Muestra si el movimiento es estable, si tiene un pico o si crece. Un pico aislado y un crecimiento sostenido piden respuestas distintas.', 'By month. It shows whether the movement is steady, has a spike or is growing. An isolated spike and a sustained climb call for different answers.'],
    ),
    p(
      'Después cruza los cortes entre sí. Un producto que domina en un solo canal cuenta una historia distinta a la de uno que domina en todos. Y mira también el contacto repetido: los clientes que escriben más de una vez por el mismo asunto suelen señalar algo que el primer mensaje no resolvió.',
      'Then cross the cuts with each other. A product that dominates in one channel tells a different story from one that dominates in all of them. And look at repeated contact too: customers who write more than once about the same matter often point to something the first message did not resolve.',
    ),
    h3('Qué no te dice un Pareto', 'What a Pareto does not tell you'),
    p(
      'Ordena el dinero, pero no explica la causa. Con un exporte de pedidos y reembolsos normalmente no se puede calcular la tasa de reembolso por producto, el margen ni la pérdida neta, porque faltan columnas para hacerlo con rigor. Un Pareto te dice dónde mirar. La razón la pones tú, con conversaciones, inspección y criterio.',
      'It orders the money, but it does not explain the cause. With an export of orders and refunds you usually cannot calculate the refund rate per product, margin or net loss, because the columns needed to do it rigorously are missing. A Pareto tells you where to look. The reason is yours to supply, through conversations, inspection and judgment.',
    ),
    h2('Qué lleva un paquete de evidencia', 'What an evidence package contains'),
    p(
      'Localizar la fuga es la mitad del trabajo. La otra mitad es poder sostener lo que encontraste frente a quien tiene que decidir: un proveedor, un transportista, un equipo interno. Un reclamo sin respaldo se discute; uno con respaldo se revisa.',
      'Locating the leak is half the work. The other half is being able to back what you found in front of whoever has to decide: a supplier, a carrier, an internal team. A claim without support gets argued; one with support gets reviewed.',
    ),
    p(
      'Sin importar con qué herramienta lo armes, un paquete de evidencia útil responde de forma ordenada lo que la otra parte va a preguntar:',
      'No matter which tool you build it with, a useful evidence package answers, in order, what the other party is going to ask:',
    ),
    ul(
      ['Qué producto y qué periodo cubre, para que nadie discuta el alcance.', 'Which product and which period it covers, so nobody argues about the scope.'],
      ['Cuántos reembolsos hubo y por cuánto dinero, con la fuente y la fecha de corte de cada cifra.', 'How many refunds there were and for how much money, with the source and cut-off date of each figure.'],
      ['El detalle pedido por pedido, para que cada renglón se pueda comprobar uno por uno.', 'The detail order by order, so each line can be checked one by one.'],
      ['Los motivos registrados y, cuando existan, las conversaciones relacionadas.', 'The recorded reasons and, when they exist, the related conversations.'],
      ['Los supuestos con los que se estimó el alcance del reclamo, escritos por quien los eligió.', 'The assumptions used to size the claim, written down by whoever chose them.'],
    ),
    p(
      'En Rovaq AI, la {{fuga-de-reembolsos|pantalla de fuga de reembolsos}} genera un paquete de evidencia por producto, en HTML y CSV, y una lista de productos para el proveedor. Todo se arma en tu navegador y la pantalla confirma que no se envió nada: tú revisas el paquete y tú presentas el reclamo.',
      'In Rovaq AI, the {{fuga-de-reembolsos|refund leakage screen}} generates an evidence package per product, as HTML and CSV, and a list of products for the supplier. Everything is built in your browser and the screen confirms that nothing was sent: you review the package and you file the claim.',
    ),
    h2('Cómo empezar con lo que ya tienes', 'How to start with what you already have'),
    p(
      'No necesitas un proyecto grande. Toma un exporte de pedidos y reembolsos de los últimos meses completos y hazle tres preguntas, en orden. ¿Qué canal concentra más dinero devuelto? ¿Qué productos encabezan ese canal? ¿Eso es nuevo, o ya estaba ahí el mes anterior? Con esas tres respuestas tienes un lugar donde mirar, que es más de lo que da un total.',
      'You do not need a big project. Take an export of orders and refunds from the last complete months and put three questions to it, in order. Which channel concentrates the most returned money? Which products lead that channel? Is that new, or was it already there the month before? With those three answers you have a place to look, which is more than a total gives you.',
    ),
    p(
      'Después decide quién se queda con cada hallazgo. Una fuga sin responsable vuelve a convertirse en un costo fijo, y el ciclo empieza de nuevo. Y antes de mover dinero o de escribirle a un proveedor, revisa de dónde sale cada cifra y hasta qué fecha llega: la {{confianza-de-los-datos|confianza de los datos}} se revisa antes de decidir, no después.',
      'Then decide who owns each finding. A leak without an owner turns back into a fixed cost, and the cycle starts over. And before moving money or writing to a supplier, check where each figure comes from and what date it reaches: {{confianza-de-los-datos|data trust}} is checked before deciding, not after.',
    ),
    noAfirmamos(
      ['No afirmamos que todo reembolso sea una fuga. Muchos son devoluciones legítimas y deben seguir siéndolo.', 'We do not claim that every refund is a leak. Many are legitimate returns and should stay that way.'],
      ['No prometemos ningún monto. Cualquier estimación del alcance de un reclamo depende de los supuestos que escribas tú.', 'We do not promise any amount. Any estimate of how large a claim could be depends on the assumptions you write.'],
      ['No calculamos la tasa de reembolso por producto, el margen, la pérdida neta ni la causa raíz con los datos de un exporte, porque faltan datos para hacerlo.', 'We do not calculate the refund rate per product, margin, net loss or root cause from an export, because the data needed to do it is missing.'],
      ['No tratamos un dato desconocido como si fuera cero: si falta información, la pantalla lo dice.', 'We do not treat unknown data as if it were zero: if information is missing, the screen says so.'],
      ['Nada se envía solo: el reclamo lo presenta una persona.', 'Nothing is sent on its own: a person files the claim.'],
    ),
  ],
});

export const ARTICULOS_BLOG: readonly Articulo[] = [ARTICULO_A1];
