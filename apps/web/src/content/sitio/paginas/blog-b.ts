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

// a7. El más delicado. Solo PUBLICO de LANDING.seguridad (hay, noHay), el texto de retención y la hoja de ruta de seguridad.ts.
// Fuera a propósito (para revisión de Responsable A): conexiones de solo lectura (MATIZ 9), versión redactada de las conversaciones (m 11, requiere Responsable A y abogado),
// IA detrás de banderas (MATIZ 3), fecha de revisión y buzón de seguridad (marcadores sin resolver).
export const ARTICULO_A7: Articulo = articulo({
  id: 'a7',
  pub: '2026-11-03',
  etiqueta: b('Seguridad', 'Security'),
  seo: {
    titulo: b('Qué afirmamos y qué no afirmamos sobre seguridad | Rovaq AI', 'What We Claim and Do Not Claim on Security | Rovaq AI'),
    descripcion: b(
      'Para un comprador vale más una lista honesta de prácticas y brechas que una promesa de seguridad total. Qué hacemos, qué no y por qué lo decimos.',
      'For a buyer, an honest list of practices and gaps beats a promise of total security. What we do, what we do not yet do and why we say so openly.',
    ),
  },
  h1: b('Qué afirmamos y qué no afirmamos sobre seguridad', 'What we claim and what we do not claim about security'),
  subtitulo: b(
    'Una lista corta de prácticas, otra de brechas y las razones para publicar las dos.',
    'A short list of practices, another of gaps and the reasons for publishing both.',
  ),
  resumen: b(
    'Una página de seguridad útil separa hechos de adjetivos y declara lo que falta. Este artículo explica qué prácticas de seguridad describimos y puede señalar cualquiera en el producto, qué brechas declaramos, por qué publicarlas sirve más a un comprador que una promesa de seguridad total y qué preguntas hacer a cualquier proveedor.',
    'A useful security page separates facts from adjectives and states what is missing. This article explains which security practices we describe and anyone can point to in the product, which gaps we declare, why publishing them serves a buyer better than a promise of total security and which questions to ask any vendor.',
  ),
  relacionados: ['seguridad-y-privacidad', 'confianza-de-los-datos'],
  bloques: [
    p(
      'Una página de seguridad suele ser lo primero que revisa una persona de finanzas o de tecnología antes de aceptar una herramienta nueva. También es donde más abundan las frases que nadie puede comprobar, escritas con adjetivos en lugar de hechos.',
      'A security page is usually the first thing a finance or technology person reviews before accepting a new tool. It is also where statements nobody can verify are most abundant, written with adjectives instead of facts.',
    ),
    p(
      'Rovaq AI trabaja con conversaciones de soporte y con datos de ingreso de un negocio, y eso nos obliga a una postura concreta: decir lo que existe, decir lo que no existe y no llenar el espacio entre ambos con adjetivos. Este artículo explica esa postura y por qué creemos que sirve más a un comprador que una promesa de seguridad total.',
      'Rovaq AI works with support conversations and revenue data from a business, and that obliges us to a specific stance: say what exists, say what does not exist and not fill the space between them with adjectives. This article explains that stance and why we believe it serves a buyer better than a promise of total security.',
    ),
    h2('Prácticas verificadas', 'Verified practices'),
    p(
      'Solo describimos prácticas que podemos señalar en el producto. Hoy son estas:',
      'We only describe practices that we can point to in the product. Today they are these:',
    ),
    ul(
      ['Cada organización queda separada de las demás por reglas en la base de datos, no solo por la aplicación.', 'Each organization is kept apart from the others by rules in the database, not only by the application.'],
      ['Hay cuatro roles con permisos mínimos. El permiso de administración de plataforma es independiente y no da lectura de los datos de negocio de otras organizaciones.', 'There are four roles with least-privilege permissions. The platform administration permission is separate and does not grant read access to the business data of other organizations.'],
      ['La entrada es por un enlace enviado al correo, con confirmación de correo, y las sesiones usan cookies protegidas.', 'Sign-in is by a link sent to your email, with email confirmation, and sessions use protected cookies.'],
      ['Los exportes de puntos de dolor y de reclamos se generan sin datos personales.', 'Pain-point and claim exports are generated without personal data.'],
      ['Quedan registradas las operaciones de administración, los cambios de equipo y los borrados por retención.', 'Administration operations, team changes and retention deletions are recorded.'],
      ['Cada organización puede definir políticas de retención. Antes de borrar, la pantalla muestra el alcance exacto y no borra nada todavía.', 'Each organization can define retention policies. Before deleting, the screen shows the exact scope and deletes nothing yet.'],
    ),
    p(
      'Cada punto está escrito para poder comprobarse. Decir que la autorización se decide en el servidor significa, por ejemplo, que ocultar un elemento del menú no protege una pantalla: lo que protege es la regla que se aplica antes de entregar los datos.',
      'Each point is written so that it can be checked. Saying that authorization is decided on the server means, for example, that hiding a menu item does not protect a screen: what protects it is the rule applied before the data is handed over.',
    ),
    p(
      'Verificada quiere decir que alguien puede ir al producto y comprobarla, y que la frase se escribió después de comprobarla, no antes. Una práctica que solo existe en una presentación comercial no entra en esta lista, por atractiva que suene.',
      'Verified means that someone can go to the product and check it, and that the sentence was written after checking, not before. A practice that exists only in a sales presentation does not make it onto this list, however attractive it sounds.',
    ),
    p(
      'Hay además una regla sobre la inteligencia artificial. Cuando interviene, clasifica y redacta; no crea cifras, y una persona decide cada acción. Nada se envía ni se ejecuta solo.',
      'There is also a rule about artificial intelligence. When it is involved, it classifies and drafts; it does not create figures, and a person decides every action. Nothing is sent or carried out on its own.',
    ),
    h2('Brechas declaradas', 'Declared gaps'),
    p(
      'La segunda lista pesa tanto como la primera. Lo que todavía no existe es esto:',
      'The second list weighs as much as the first. What does not exist yet is this:',
    ),
    ul(
      ['No tenemos certificación SOC 2 ni ISO 27001, y no afirmamos cumplimiento de GDPR.', 'We do not hold SOC 2 or ISO 27001 certification, and we do not claim GDPR compliance.'],
      ['No se ha hecho una prueba de penetración externa.', 'No external penetration test has been performed.'],
      ['La verificación en dos pasos para propietarios está en nuestra hoja de ruta. Hoy no se exige.', 'Two-step verification for owners is on our roadmap. It is not required today.'],
      ['No ofrecemos inicio de sesión único ni una vista de auditoría para el cliente.', 'We do not offer single sign-on or a customer-facing audit view.'],
      ['Hay respaldos diarios de nuestro proveedor, sin recuperación a un punto en el tiempo, y no ofrecemos compromisos de disponibilidad.', 'There are daily provider backups, without point-in-time recovery, and we make no availability commitments.'],
    ),
    p(
      'Otras mejoras están en la hoja de ruta, como una política de contenido estricta que seguimos endureciendo y una vista de auditoría planeada. No publicamos fechas hasta que podamos cumplirlas.',
      'Other improvements are on the roadmap, such as a strict content security policy that we are still hardening and a planned audit view. We do not publish dates until we can meet them.',
    ),
    p(
      'Leer una lista de brechas exige distinguir tres cosas: lo que no existe, lo que está planeado y lo que no sabemos. Lo planeado está en la hoja de ruta y no lleva fecha publicada. Lo que no sabemos se dice como tal y no se cuenta a nuestro favor.',
      'Reading a list of gaps requires telling three things apart: what does not exist, what is planned and what we do not know. What is planned sits on the roadmap and carries no published date. What we do not know is said as such and is not counted in our favor.',
    ),
    p(
      'El borrado tiene también un límite que conviene decir: no elimina el origen de los datos en tu herramienta ni las copias que mantengas fuera de Rovaq.',
      'Deletion also has a limit worth stating: it does not remove the source data in your tool or copies you keep outside Rovaq.',
    ),
    h2('Por qué publicamos las brechas', 'Why we publish the gaps'),
    p(
      'Hay cuatro razones, y ninguna es de imagen.',
      'There are four reasons, and none is about image.',
    ),
    ul(
      ['Un comprador necesita dimensionar el riesgo antes de firmar. Ocultar una brecha solo traslada el descubrimiento a un momento peor.', 'A buyer needs to size the risk before signing. Hiding a gap only moves the discovery to a worse moment.'],
      ['Una afirmación sin límites no se puede comprobar. Un límite sí: cualquiera puede verificar que existe o que no.', 'A claim without limits cannot be checked. A limit can: anyone can verify whether it exists or not.'],
      ['Nos disciplina. Cada frase de la primera lista tiene que sobrevivir a la lectura de la segunda, y eso desalienta el adjetivo fácil.', 'It disciplines us. Every sentence in the first list has to survive reading the second, and that discourages the easy adjective.'],
      ['Permite una conversación adulta. Si un requisito del comprador depende de algo que hoy no tenemos, la respuesta correcta es decirlo, no argumentar.', 'It allows an adult conversation. If a buyer requirement depends on something we do not have today, the right answer is to say so, not to argue.'],
    ),
    p(
      'Tampoco afirmamos que lo que existe sea suficiente para cada negocio. Una brecha que a un equipo le es indiferente puede ser decisiva para otro, por ejemplo cuando una política interna exige algo que hoy no tenemos. En ese caso la decisión corresponde a quien compra, y nuestro trabajo es darle la información exacta para tomarla.',
      'Nor do we claim that what exists is enough for every business. A gap that a team does not care about can be decisive for another, for example when an internal policy requires something we do not have today. In that case the decision belongs to the buyer, and our job is to give the exact information needed to make it.',
    ),
    p(
      'Hay un efecto secundario útil. Cuando una brecha se cierre, el cambio podrá leerse sobre una base clara: antes la lista decía esto y ahora dice aquello. Una página que solo suma frases positivas no permite ver qué cambió ni cuándo.',
      'There is a useful side effect. When a gap is closed, the change can be read against a clear baseline: the list used to say this and now says that. A page that only adds positive sentences does not let you see what changed or when.',
    ),
    cita(
      'Una promesa de seguridad total no se puede verificar. Una lista de prácticas y de brechas sí.',
      'A promise of total security cannot be verified. A list of practices and gaps can.',
    ),
    h2('Cómo leer una página de seguridad', 'How to read a security page'),
    p(
      'Más allá de Rovaq AI, estas preguntas sirven con cualquier proveedor:',
      'Beyond Rovaq AI, these questions work with any vendor:',
    ),
    ul(
      ['Hechos o adjetivos: cada afirmación debería poder señalarse en el producto o en un documento, y no solo describirse con un calificativo.', 'Facts or adjectives: every claim should be something you can point to in the product or in a document, not just describe with a qualifier.'],
      ['Qué falta: una página que no declara ninguna brecha rara vez significa que no hay ninguna.', 'What is missing: a page that declares no gap rarely means there is none.'],
      ['Alcance y fecha: una práctica sin fecha de revisión puede describir un estado que ya cambió.', 'Scope and date: a practice without a review date may describe a state that has already changed.'],
      ['Qué no cubre: las copias que mantienes fuera de la herramienta quedan fuera del alcance de cualquier borrado del proveedor.', 'What it does not cover: copies you keep outside the tool are outside the scope of any deletion by the vendor.'],
    ),
    p(
      'La lista completa vive en la página de {{seguridad-y-privacidad|seguridad y privacidad}}. Este artículo describe el estado al momento de su publicación, y esa página es la referencia vigente.',
      'The full list lives on the {{seguridad-y-privacidad|security and privacy}} page. This article describes the state at the time of publication, and that page is the current reference.',
    ),
    noAfirmamos(
      ['No afirmamos seguridad total ni ausencia de riesgo: ningún proveedor puede garantizarlas.', 'We do not claim total security or the absence of risk: no vendor can guarantee them.'],
      ['No afirmamos certificaciones, cumplimiento regulatorio ni auditorías externas, porque no los tenemos.', 'We do not claim certifications, regulatory compliance or external audits, because we do not have them.'],
      ['No afirmamos que los datos estén anonimizados.', 'We do not claim that data is anonymized.'],
      ['No afirmamos que se registre cada lectura de los datos: se registran las operaciones de administración, los cambios de equipo y los borrados por retención.', 'We do not claim that each read of the data is logged: administration operations, team changes and retention deletions are recorded.'],
      ['No prometemos disponibilidad ni fechas de producto.', 'We do not promise availability or product dates.'],
      ['No presentamos las prácticas como suficientes para todo negocio: esa valoración le corresponde a quien compra.', 'We do not present the practices as sufficient for every business: that assessment belongs to the buyer.'],
    ),
  ],
});

export const ARTICULOS_B: readonly Articulo[] = [ARTICULO_A6, ARTICULO_A7];
