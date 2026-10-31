// Artículos a6 a a8 del blog. Los redacta un agente en este archivo (y solo en este); a2 a a5 viven en blog-a.ts y a1 en blog.ts.
// Para publicar uno: añadir aquí la llamada articulo({...}) con id 'a6' ... 'a8' (el id fija la ruta en el registro K2). Mientras no exista,
// la ruta devuelve el 404 propio del sitio y el artículo no aparece en el índice, en el RSS, en el sitemap ni en los espejos.
// Guía de forma: ver ARTICULO_A1 en blog.ts. Constructores: p, h2, h3, ul, pasos, cita, noAfirmamos y articulo, de ../ayudas.ts.
import type { Articulo } from '../tipos.ts';
import { articulo, b, cita, h2, h3, noAfirmamos, p, pasos, ul } from '../ayudas.ts';

// a6. Fuente de hechos: pantalla producto/puntos-de-dolor (mapa de burbujas, exportación sin datos personales, Sin dato y nunca cero).
// No se afirma que la IA agrupe los temas: la extracción con modelo es una condición de P-D (verificación 3) y aquí se describe el método, no esa función.
export const ARTICULO_A6: Articulo = articulo({
  id: 'a6',
  pub: '2026-11-03',
  etiqueta: b('Puntos de dolor', 'Pain points'),
  seo: {
    titulo: b('Puntos de dolor: del texto a la prioridad | Rovaq AI', 'Pain Points: From Free Text to a Priority | Rovaq AI'),
    descripcion: b(
      'Un tema repetido en conversaciones no es un tema que importa. Cómo pasar del texto libre de tus tickets a una prioridad con tamaño, evidencia y vacíos.',
      'A topic repeated in conversations is not a topic that matters. How to go from free text in your tickets to a priority with size, evidence and gaps.',
    ),
  },
  h1: b(
    'Puntos de dolor: del texto libre de las conversaciones a una prioridad con evidencia',
    'Pain points: from free text in conversations to a priority backed by evidence',
  ),
  subtitulo: b(
    'Contar menciones es un comienzo. Una prioridad necesita además un tamaño, una evidencia que se pueda abrir y una lista de lo que no se sabe.',
    'Counting mentions is a start. A priority also needs a size, evidence that can be opened and a list of what is not known.',
  ),
  resumen: b(
    'Un tema que se repite en las conversaciones de soporte es una pista, no una prioridad. Este artículo explica por qué el conteo de menciones engaña, cómo medir un motivo en volumen y en dinero sin mezclar las dos unidades, por qué un dato que falta no vale cero y cómo compartir la evidencia sin datos personales.',
    'A theme that repeats in support conversations is a clue, not a priority. This article explains why counting mentions misleads, how to measure a reason in volume and in money without mixing the two units, why missing data is not zero and how to share the evidence without personal data.',
  ),
  relacionados: ['puntos-de-dolor', 'confianza-de-los-datos', 'por-decidir'],
  bloques: [
    p(
      'En casi cualquier operación de atención al cliente llega un momento en que alguien lee cien conversaciones y concluye que el problema es el envío. Lo concluye porque la palabra aparece mucho. Es una lectura razonable y es también la forma más común de equivocarse de prioridad.',
      'In almost any customer support operation there comes a moment when someone reads a hundred conversations and concludes that the problem is shipping. They conclude it because the word shows up a lot. It is a reasonable reading and also the most common way to get a priority wrong.',
    ),
    p(
      'Este artículo defiende una idea sencilla: un tema que se repite en el texto libre de las conversaciones es una pista, no una prioridad. Para convertirlo en prioridad hace falta un tamaño, una evidencia y una lista honesta de lo que todavía no se sabe.',
      'This article defends a simple idea: a theme that repeats in the free text of conversations is a clue, not a priority. To turn it into a priority you need a size, a body of evidence and an honest list of what is not yet known.',
    ),
    h2('Repetido no es importante', 'Repeated is not important'),
    p(
      'Contar menciones es lo primero que se intenta y tiene un atractivo evidente: es rápido y produce un orden. El problema es que mide ruido tanto como importancia. Un motivo puede repetirse porque es frecuente y barato, como una pregunta por el estado de un pedido que se resuelve con una línea. Otro puede aparecer pocas veces y arrastrar devoluciones de dinero considerables.',
      'Counting mentions is the first thing people try, and it has an obvious appeal: it is quick and it produces an order. The problem is that it measures noise as much as importance. A reason may repeat because it is frequent and cheap, like a question about order status that one line resolves. Another may appear rarely and carry considerable refunds.',
    ),
    p(
      'Hay al menos tres razones por las que el conteo engaña:',
      'There are at least three reasons why the count misleads:',
    ),
    ul(
      ['El lenguaje del cliente no es el de tu catálogo. Dos personas describen el mismo defecto con palabras distintas y una misma palabra sirve para asuntos que no se parecen. Sin una agrupación cuidadosa, el conteo reparte un problema entre varias filas o junta varios en una.', 'The customer language is not the language of your catalog. Two people describe the same defect with different words, and one word can cover matters that are not alike. Without careful grouping, the count splits one problem across several rows or merges several into one.'],
      ['La frecuencia no es el costo. Un motivo muy mencionado y de bajo impacto puede quedar por encima de uno raro y caro si lo único que miras es el volumen.', 'Frequency is not cost. A heavily mentioned reason with low impact can rank above a rare and expensive one if all you look at is volume.'],
      ['Lo que más se escribe es lo que más se facilita escribir. Los canales y los formularios condicionan de qué se queja la gente y cómo, de modo que parte del patrón viene de la herramienta y no del cliente.', 'What gets written most is what is easiest to write. Channels and forms shape what people complain about and how, so part of the pattern comes from the tool and not from the customer.'],
    ),
    p(
      'Nada de esto invalida el texto libre. Al contrario, es la fuente más rica que tiene la mayoría de los equipos. Lo que cambia es el papel que se le da: sirve para formular hipótesis, no para cerrarlas.',
      'None of this invalidates free text. On the contrary, it is the richest source most teams have. What changes is the role it is given: it serves to form hypotheses, not to close them.',
    ),
    cita(
      'Un tema repetido dice de qué se habla. Una prioridad dice cuánto pesa y con qué evidencia.',
      'A repeated theme says what people talk about. A priority says how much it weighs and with what evidence.',
    ),
    h2('Mapa de burbujas y tamaño', 'Bubble map and size'),
    p(
      'Pasar de un tema a una prioridad exige responder dos preguntas que el texto no contesta por sí solo. La primera es de tamaño: cuánto pesa este motivo y en qué unidad. La segunda es de evidencia: qué conversaciones y qué pedidos lo respaldan, de manera que otra persona pueda abrirlos y comprobarlo.',
      'Moving from a theme to a priority requires answering two questions that the text does not answer on its own. The first is about size: how much this reason weighs and in what unit. The second is about evidence: which conversations and which orders support it, so that another person can open them and check.',
    ),
    p(
      'El tamaño puede medirse de dos maneras y conviene no mezclarlas. Una es el volumen, es decir, cuántas conversaciones caen en el motivo. La otra es el dinero que arrastra, cuando existe una forma confiable de ligar el motivo con pedidos y devoluciones. Un buen hábito es mirar las dos y fijarse en dónde no coinciden. Un motivo grande en volumen y pequeño en dinero pide una respuesta de atención; uno pequeño en volumen y grande en dinero pide revisar el producto o al proveedor.',
      'Size can be measured in two ways, and it is wise not to mix them. One is volume, meaning how many conversations fall under the reason. The other is the money it carries, when there is a reliable way to link the reason to orders and refunds. A good habit is to look at both and notice where they disagree. A reason that is large in volume and small in money calls for a support response; one that is small in volume and large in money calls for a review of the product or the supplier.',
    ),
    h3('Leer las dos cosas a la vez', 'Reading both at once'),
    p(
      'En la pantalla de {{puntos-de-dolor|puntos de dolor}} de Rovaq AI, cada burbuja es un punto de dolor y su tamaño es el dinero devuelto en dólares brutos o el volumen, a elección de quien mira. Los ocho mayores aparecen en la gráfica y en una tabla accesible, con un filtro por tema, y cada fila abre su evidencia hasta la fila de origen.',
      'On the {{puntos-de-dolor|pain points}} screen in Rovaq AI, each bubble is a pain point and its size is returned money in gross dollars or volume, as chosen by whoever is looking. The eight largest appear in the chart and in an accessible table, with a topic filter, and each row opens its evidence down to the source row.',
    ),
    p(
      'Esa última parte es la que convierte un mapa en una herramienta de trabajo. Una burbuja grande que no se puede abrir invita a la discusión; una burbuja que se abre hasta la conversación y el pedido de origen invita a revisarla.',
      'That last part is what turns a map into a working tool. A large bubble that cannot be opened invites argument; a bubble that opens down to the originating conversation and order invites review.',
    ),
    h3('Lo que no se sabe no vale cero', 'What is not known is not zero'),
    p(
      'Hay un error silencioso en casi todos los tableros: cuando falta un dato aparece un cero. Un cero se lee como una buena noticia y por eso es el error más caro de los que no se notan. Si una fuente no respondió, o si no existe una liga confiable entre un motivo y el dinero, lo correcto es decir exactamente eso.',
      'There is a silent error in almost every dashboard: when data is missing, a zero appears. A zero reads as good news, which makes it the costliest of the errors that go unnoticed. If a source did not respond, or if there is no reliable link between a reason and the money, the right thing is to say exactly that.',
    ),
    p(
      'La pantalla sigue esa regla. Lo que no se sabe dice Sin dato y nunca cero, y si una fuente no respondió, esos puntos salen como No disponible ahora. Por eso conviene revisar primero la {{confianza-de-los-datos|confianza de los datos}} y leer cada número con su fuente y su fecha de corte.',
      'The screen follows that rule. What is not known says No data and never zero, and if a source did not respond, those points show as Not available now. That is why it pays to check {{confianza-de-los-datos|data trust}} first and read each number with its source and cut-off date.',
    ),
    h2('Exportar sin datos personales', 'Export without personal data'),
    p(
      'Priorizar rara vez es una decisión de una sola persona. Casi siempre hay que llevar el hallazgo a producto, a un proveedor o a la dirección, y ahí aparece una tensión: la evidencia más convincente suele ser la conversación, y la conversación suele contener datos de un cliente.',
      'Prioritizing is rarely the decision of one person. Almost always the finding has to be taken to product, to a supplier or to management, and a tension appears: the most convincing evidence is usually the conversation, and the conversation usually contains data about a customer.',
    ),
    p(
      'La salida es separar las dos cosas. La exportación de evidencia en CSV por punto de dolor se genera sin datos personales, de modo que puede compartirse con quien necesita ver el patrón sin que viaje información de quien escribió. Compartir la evidencia no debería exigir compartir a las personas.',
      'The way out is to separate the two. The evidence export in CSV per pain point is generated without personal data, so it can be shared with whoever needs to see the pattern without information about the writer traveling along. Sharing the evidence should not require sharing the people.',
    ),
    h2('Cómo empezar con lo que ya tienes', 'How to start with what you already have'),
    p(
      'No hace falta una herramienta nueva para probar el método. Toma las conversaciones de un periodo completo y sigue estos pasos:',
      'You do not need a new tool to try the method. Take the conversations from a complete period and follow these steps:',
    ),
    pasos(
      ['Agrupa por motivo con un criterio escrito, para que otra persona agrupe igual.', 'Group by reason using a written criterion, so another person would group the same way.'],
      ['Mide cada grupo en volumen y, donde puedas ligarlo con pedidos, en dinero devuelto, sin mezclar las dos unidades.', 'Measure each group in volume and, where you can link it to orders, in returned money, without mixing the two units.'],
      ['Compara los dos órdenes y anota dónde discrepan; ahí suele estar la sorpresa.', 'Compare the two rankings and note where they differ; that is usually where the surprise is.'],
      ['Para cada candidato, reúne dos o tres conversaciones de origen que cualquiera pueda abrir y comprobar.', 'For each candidate, gather two or three source conversations that anyone can open and check.'],
      ['Marca lo que falta como falta, con su razón, y no lo conviertas en cero.', 'Mark what is missing as missing, with the reason, and do not turn it into zero.'],
      ['Lleva el resultado a {{por-decidir|la decisión}}: una persona elige qué atender y el resultado queda registrado.', 'Take the result to {{por-decidir|the decision}}: a person chooses what to address and the outcome gets recorded.'],
    ),
    noAfirmamos(
      ['No afirmamos que un tema repetido sea un tema que cuesta: la pantalla pone al lado el dinero que arrastra solo cuando existe.', 'We do not claim that a repeated theme is a theme that costs: the screen puts the money it carries beside it only when that money exists.'],
      ['No prometemos que cada punto de dolor tenga una cifra de dinero: sin vínculos confirmados entre motivos y pedidos, el dato no está disponible y se dice así.', 'We do not promise that every pain point has a money figure: without confirmed links between reasons and orders, the figure is not available and the screen says so.'],
      ['No tratamos un dato desconocido como si fuera cero.', 'We do not treat unknown data as if it were zero.'],
      ['No determinamos la causa de un problema: el mapa ordena y muestra evidencia, y la causa la establece quien la revisa.', 'We do not determine the cause of a problem: the map orders and shows evidence, and the cause is established by whoever reviews it.'],
      ['Cuando la inteligencia artificial interviene, clasifica y redacta; no crea cifras, y una persona decide cada acción.', 'When artificial intelligence is involved, it classifies and drafts; it does not create figures, and a person decides every action.'],
    ),
  ],
});

export const ARTICULOS_B: readonly Articulo[] = [ARTICULO_A6];
