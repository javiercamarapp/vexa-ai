// Artículos a6 a a8 del blog. Los redacta un agente en este archivo (y solo en este); a2 a a5 viven en blog-a.ts y a1 en blog.ts.
// Un artículo con estado pendiente-de-revision (hoy a7) devuelve el 404 propio del sitio y no aparece en el índice, el RSS, el sitemap ni los espejos.
// Guía de forma: ver ARTICULO_A1 en blog.ts. La fecha de publicación es FECHA_CONTENIDO. Rótulos de viñeta con **texto**. Constructores: p, h2, h3, ul, pasos, cita, noAfirmamos y articulo, de ../ayudas.ts.
import type { Articulo } from '../tipos.ts';
import { articulo, b, cita, h2, h3, noAfirmamos, p, pasos, ul } from '../ayudas.ts';
import { FECHA_CONTENIDO } from '../fecha-contenido.mjs';

// a6. Fuente de hechos: pantalla producto/puntos-de-dolor (mapa de burbujas, exportación sin datos personales, Sin dato y nunca cero).
// No se afirma que la IA agrupe los temas: la extracción con modelo es una condición de P-D (verificación 3) y aquí se describe el método, no esa función.
export const ARTICULO_A6: Articulo = articulo({
  id: 'a6',
  pub: FECHA_CONTENIDO,
  etiqueta: b('Puntos de dolor', 'Pain points'),
  seo: {
    titulo: b('Puntos de dolor: del texto a la prioridad | Rovaq AI', 'Pain Points: From Free Text to a Priority | Rovaq AI'),
    descripcion: b(
      'Un tema repetido en conversaciones no es un tema que importa. Cómo pasar del texto libre de tus tickets a una prioridad con tamaño, evidencia y vacíos.',
      'A topic repeated in conversations is not a topic that matters. How to go from free text in your tickets to a priority with size, evidence and gaps.',
    ),
  },
  h1: b(
    'Puntos de dolor: del texto libre a una prioridad con evidencia',
    'Pain points: from free text to a priority backed by evidence',
  ),
  subtitulo: b(
    'Contar menciones es un comienzo. Una prioridad necesita además un tamaño, una evidencia que se pueda abrir y una lista de lo que no se sabe.',
    'Counting mentions is a start. A priority also needs a size, evidence that can be opened and a list of what is not known.',
  ),
  resumen: b(
    'Un tema que se repite en las conversaciones de soporte es una pista, no una prioridad. Por qué el conteo de menciones engaña, cómo medir un motivo en volumen y en dinero sin mezclar las dos unidades, por qué un dato que falta no vale cero y cómo compartir la evidencia sin datos personales.',
    'A theme that repeats in support conversations is a clue, not a priority. Why counting mentions misleads, how to measure a reason in volume and in money without mixing the two units, why missing data is not zero and how to share the evidence without personal data.',
  ),
  relacionados: ['puntos-de-dolor', 'confianza-de-los-datos', 'por-decidir', 'a2'],
  bloques: [
    p(
      'En casi cualquier operación de atención al cliente llega un momento en que alguien lee cien conversaciones y concluye que el problema es el envío. Lo concluye porque la palabra aparece mucho. Es una lectura razonable y es también la forma más común de equivocarse de prioridad.',
      'In almost any customer support operation there comes a moment when someone reads a hundred conversations and concludes that the problem is shipping. They conclude it because the word shows up a lot. It is a reasonable reading and also the most common way to get a priority wrong.',
    ),
    p(
      'Un tema que se repite en el texto libre de las conversaciones es una pista, no una prioridad. Para convertirlo en prioridad hace falta un tamaño, una evidencia y una lista honesta de lo que todavía no se sabe.',
      'A theme that repeats in the free text of conversations is a clue, not a priority. To turn it into a priority you need a size, a body of evidence and an honest list of what is not yet known.',
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
      ['**El lenguaje del cliente no es el de tu catálogo.** Dos personas describen el mismo defecto con palabras distintas y una misma palabra sirve para asuntos que no se parecen. Sin una agrupación cuidadosa, el conteo reparte un problema entre varias filas o junta varios en una.', '**Customers do not describe things the way your catalog does.** Two people describe the same defect with different words, and one word can cover matters that are not alike. Without careful grouping, the count splits one problem across several rows or merges several into one.'],
      ['**La frecuencia no es el costo.** Un motivo muy mencionado y de bajo impacto puede quedar por encima de uno raro y caro si lo único que miras es el volumen.', '**Frequency is not cost.** A heavily mentioned reason with low impact can rank above a rare and expensive one if all you look at is volume.'],
      ['**Lo que más se escribe es lo que más se facilita escribir.** Los canales y los formularios condicionan de qué se queja la gente y cómo, de modo que parte del patrón viene de la herramienta y no del cliente.', '**What gets written most is what is easiest to write.** Channels and forms shape what people complain about and how, so part of the pattern comes from the tool and not from the customer.'],
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
      'En esta pantalla, si una fuente no respondió, esos puntos salen como No disponible ahora. Un motivo sin una liga confiable con el dinero no es un motivo barato, es un motivo sin medir. Por qué la diferencia importa tanto se explica en {{a2|el artículo sobre procedencia}}; aquí basta revisar primero la {{confianza-de-los-datos|confianza de los datos}} y leer cada número con su fuente y su fecha de corte.',
      'On this screen, if a source did not respond, those points show as Not available now. A reason with no reliable link to the money is not a cheap reason, it is an unmeasured one. Why the difference matters so much is explained in {{a2|the article on provenance}}; here it is enough to check {{confianza-de-los-datos|data trust}} first and read each number with its source and cut-off date.',
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
    h2('Cómo probar el método con tus conversaciones', 'How to try the method with your conversations'),
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
      ['No determinamos la causa de un problema: el mapa ordena y muestra evidencia, y la causa la establece quien la revisa.', 'We do not determine the cause of a problem: the map orders and shows evidence, and the cause is established by whoever reviews it.'],
      ['No afirmamos que el mapa muestre todos los puntos de dolor: en la gráfica aparecen los ocho mayores.', 'We do not claim that the map shows every pain point: the chart shows the eight largest.'],
    ),
  ],
});

// a7. El más delicado. Solo PUBLICO de LANDING.seguridad (hay, noHay), y el texto de retención.
// Fuera a propósito (para revisión del responsable del cliente): conexiones de solo lectura (MATIZ 9), versión redactada de las conversaciones (m 11, requiere el responsable del cliente y abogado),
// IA detrás de banderas (MATIZ 3), fecha de revisión y buzón de seguridad (marcadores sin resolver).
export const ARTICULO_A7: Articulo = articulo({
  id: 'a7',
  // FUERA DEL LANZAMIENTO (T32-Y, decisión de Javier): las afirmaciones de seguridad esperan la revisión del responsable del cliente y de un abogado. El texto queda escrito.
  estado: 'pendiente-de-revision',
  pendiente: 'Las afirmaciones de seguridad esperan la revisión del responsable del cliente y de un abogado.',
  pub: FECHA_CONTENIDO,
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
    'Una página de seguridad útil separa hechos de adjetivos y declara lo que falta. Qué prácticas de seguridad describimos y cualquiera puede señalar en el producto, qué brechas declaramos, por qué publicarlas sirve más a un comprador que una promesa de seguridad total y qué preguntas hacer a cualquier proveedor.',
    'A useful security page separates facts from adjectives and states what is missing. Which security practices we describe and anyone can point to in the product, which gaps we declare, why publishing them serves a buyer better than a promise of total security and which questions to ask any vendor.',
  ),
  relacionados: ['confianza-de-los-datos', 'a2', 'a4', 'a3'],
  bloques: [
    p(
      'Una página de seguridad suele ser lo primero que revisa una persona de finanzas o de tecnología antes de aceptar una herramienta nueva. También es donde más abundan las frases que nadie puede comprobar, escritas con adjetivos en lugar de hechos.',
      'A security page is usually the first thing a finance or technology person reviews before accepting a new tool. It is also where statements nobody can verify are most abundant, written with adjectives instead of facts.',
    ),
    p(
      'Rovaq AI trabaja con conversaciones de soporte y con datos de ingreso de un negocio, y eso nos obliga a una postura concreta: decir lo que existe, decir lo que no existe y no llenar el espacio entre ambos con adjetivos. Aquí se explica esa postura y por qué creemos que sirve más a un comprador que una promesa de seguridad total.',
      'Rovaq AI works with support conversations and revenue data from a business, and that obliges us to a specific stance: say what exists, say what does not exist and not fill the space between them with adjectives. Here is that stance and why we believe it serves a buyer better than a promise of total security.',
    ),
    h2('Prácticas que describimos', 'Practices we describe'),
    p(
      'Solo describimos prácticas que podemos señalar en el producto. Hoy son estas:',
      'We only describe practices that we can point to in the product. Today they are these:',
    ),
    ul(
      ['Cada organización queda separada de las demás por reglas en la base de datos, no solo por la aplicación.', 'Each organization is kept apart from the others by rules in the database, not only by the application.'],
      ['Hay cuatro puestos con permisos mínimos. El permiso de administración de plataforma es independiente y no da lectura de los datos de negocio de otras organizaciones.', 'There are four roles with least-privilege permissions. The platform administration permission is separate and does not grant read access to the business data of other organizations.'],
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
      'Describir una práctica quiere decir que alguien puede ir al producto y comprobarla, y que la frase se escribió pensando en esa comprobación y no en una presentación comercial. Una práctica que solo existe en una presentación no entra en esta lista, por atractiva que suene. Ninguna auditoría externa la ha revisado: léela como una descripción nuestra, no como un aval.',
      'Describing a practice means that someone can go to the product and check it, and that the sentence was written with that check in mind and not for a sales presentation. A practice that exists only in a sales presentation does not make it onto this list, however attractive it sounds. No external audit has reviewed it: read it as our own description, not as an endorsement.',
    ),
    p(
      'Hay además una regla sobre la inteligencia artificial: sus salidas son propuestas que una persona revisa, y nada se envía ni se ejecuta sin esa persona. Dónde pasa la línea entre lo que hace el modelo y lo que no se explica en {{a3|el artículo sobre inteligencia artificial}}.',
      'There is also a rule about artificial intelligence: its outputs are proposals that a person reviews, and nothing is sent or carried out without that person. Where the line falls between what the model does and what it does not is explained in {{a3|the article on artificial intelligence}}.',
    ),
    h2('Brechas declaradas', 'Declared gaps'),
    p(
      'La segunda lista pesa tanto como la primera. Lo que todavía no existe es esto:',
      'The second list weighs as much as the first. What does not exist yet is this:',
    ),
    ul(
      ['No tenemos certificación SOC 2 ni ISO 27001, y no afirmamos cumplimiento de GDPR.', 'We do not hold SOC 2 or ISO 27001 certification, and we do not claim GDPR compliance.'],
      ['No se ha hecho una prueba de penetración externa.', 'No external penetration test has been performed.'],
      ['La verificación en dos pasos para administradores del espacio todavía no existe. Hoy no se exige.', 'Two-step verification for workspace administrators does not exist yet. It is not required today.'],
      ['No ofrecemos inicio de sesión único ni una vista de auditoría para el cliente.', 'We do not offer single sign-on or a customer-facing audit view.'],
      ['Hay respaldos diarios de nuestro proveedor, sin recuperación a un punto en el tiempo, y no ofrecemos compromisos de disponibilidad.', 'There are daily provider backups, without point-in-time recovery, and we make no availability commitments.'],
    ),
    p(
      'Otras mejoras están planeadas, como una política de contenido estricta que seguimos endureciendo y una vista de auditoría. No publicamos fechas hasta que podamos cumplirlas.',
      'Other improvements are planned, such as a strict content security policy that we are still hardening and an audit view. We do not publish dates until we can meet them.',
    ),
    p(
      'Leer una lista de brechas exige distinguir tres cosas: lo que no existe, lo que está planeado y lo que no sabemos. Lo planeado no lleva fecha publicada. Lo que no sabemos se dice como tal y no se cuenta a nuestro favor.',
      'Reading a list of gaps requires telling three things apart: what does not exist, what is planned and what we do not know. What is planned carries no published date. What we do not know is said as such and is not counted in our favor.',
    ),
    p(
      'Un ejemplo de lo último: todavía no hemos terminado de comprobar en producción cada uno de los encabezados de seguridad de las respuestas, y por eso no afirmamos que la configuración real coincida en todo con la prevista. Mientras esa comprobación siga abierta, es un desconocido y se dice así.',
      'An example of the last kind: we have not finished checking in production each of the security headers on the responses, and so we do not claim that the real configuration matches the intended one in every respect. While that check stays open, it is an unknown and we say so.',
    ),
    p(
      'El borrado tiene también un límite que conviene decir: no elimina el origen de los datos en tu herramienta ni las copias que mantengas fuera de Rovaq.',
      'Deletion also has a limit worth stating: it does not remove the source data in your tool or copies you keep outside Rovaq.',
    ),
    h2('Por qué publicamos las brechas', 'Why we publish the gaps'),
    p(
      'Hay cuatro razones.',
      'There are four reasons.',
    ),
    ul(
      ['Un comprador necesita dimensionar el riesgo antes de firmar. Ocultar una brecha solo traslada el descubrimiento a un momento peor.', 'A buyer needs to size the risk before signing. Hiding a gap only moves the discovery to a worse moment.'],
      ['Una afirmación sin límites no se puede comprobar. Un límite sí: cualquiera puede verificar que existe o que no.', 'A claim without limits cannot be checked. A limit can: anyone can verify whether it exists or not.'],
      ['Nos mantiene precisos. Cada frase de la primera lista tiene que sobrevivir a la lectura de la segunda, y eso desalienta el adjetivo fácil.', 'It keeps us precise. Every sentence in the first list has to survive reading the second, and that discourages the easy adjective.'],
      ['Permite una conversación directa. Si un requisito del comprador depende de algo que hoy no tenemos, la respuesta correcta es decirlo, no argumentar.', 'It allows a direct conversation. If a buyer requirement depends on something we do not have today, the right answer is to say so, not to argue.'],
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
      ['**Hechos o adjetivos:** cada afirmación debería poder señalarse en el producto o en un documento, y no solo describirse con un calificativo.', '**Facts or adjectives:** every claim should be something you can point to in the product or in a document, not just describe with a qualifier.'],
      ['**Qué falta:** una página que no declara ninguna brecha rara vez significa que no hay ninguna.', '**What is missing:** a page that declares no gap rarely means there is none.'],
      ['**Alcance y fecha:** una práctica sin fecha de revisión puede describir un estado que ya cambió.', '**Scope and date:** a practice without a review date may describe a state that has already changed.'],
      ['**Qué no cubre:** las copias que mantienes fuera de la herramienta quedan fuera del alcance de cualquier borrado del proveedor.', '**What it does not cover:** copies you keep outside the tool are outside the scope of any deletion by the vendor.'],
    ),
    p(
      'Lo descrito aquí corresponde al estado al momento de su publicación, la fecha que aparece arriba, y no se actualiza solo: si algo cambia después, este texto puede quedar atrás.',
      'What is described here reflects the state at the time of its publication, the date shown above, and it does not update itself: if something changes later, this text may fall behind.',
    ),
    noAfirmamos(
      ['No afirmamos seguridad total ni ausencia de riesgo: ningún proveedor puede garantizarlas.', 'We do not claim total security or the absence of risk: no vendor can guarantee them.'],
      ['No afirmamos certificaciones, cumplimiento regulatorio ni auditorías externas, porque no los tenemos.', 'We do not claim certifications, regulatory compliance or external audits, because we do not have them.'],
      ['No afirmamos que los datos estén anonimizados.', 'We do not claim that data is anonymized.'],
      ['No afirmamos que la configuración de seguridad de producción esté comprobada de punta a punta: esa comprobación sigue abierta.', 'We do not claim that the production security configuration has been checked end to end: that check is still open.'],
      ['No afirmamos que se registre cada lectura de los datos: se registran las operaciones de administración, los cambios de equipo y los borrados por retención.', 'We do not claim that each read of the data is logged: administration operations, team changes and retention deletions are recorded.'],
      ['No prometemos disponibilidad ni fechas de producto.', 'We do not promise availability or product dates.'],
      ['No presentamos las prácticas como suficientes para todo negocio: esa valoración le corresponde a quien compra.', 'We do not present the practices as sufficient for every business: that assessment belongs to the buyer.'],
    ),
  ],
});

// a8. Fuente de hechos: pantalla producto/por-decidir. Condición 4: migración aplicada pero 0 eventos; se describe solo lo que el producto permite, sin resultados ni casos.
// En inglés se usa Dismiss, que es el término de la pantalla, aunque el plan SEO sugería Discard.
export const ARTICULO_A8: Articulo = articulo({
  id: 'a8',
  pub: FECHA_CONTENIDO,
  etiqueta: b('Decisiones', 'Decisions'),
  seo: {
    titulo: b('Una recomendación debe poder discutirse | Rovaq AI', 'A Recommendation Must Be Open to Debate | Rovaq AI'),
    descripcion: b(
      'Una sugerencia sin evidencia se ignora. Con evidencia, responsable y registro del resultado se vuelve hábito del equipo: propuesta, decisión y resultado.',
      'A suggestion without evidence gets ignored. With evidence, a responsible person and a recorded outcome it becomes a team habit: proposal, decision, result.',
    ),
  },
  h1: b(
    'Una recomendación debe poder discutirse: evidencia y resultado',
    'A recommendation must be debatable: evidence and outcome',
  ),
  subtitulo: b(
    'Cuando una propuesta trae su evidencia, una persona que decide y un registro de lo que pasó, deja de ser una opinión y se vuelve un hábito.',
    'When a proposal brings its evidence, a person who decides and a record of what happened, it stops being an opinion and becomes a habit.',
  ),
  resumen: b(
    'Una recomendación sin evidencia se ignora o se obedece a ciegas. Qué debe traer una propuesta para poder discutirse, por qué conviene un vocabulario de decisión pequeño y una persona que aprueba, y cómo registrar el resultado midiendo antes y después solo con dato observado.',
    'A recommendation without evidence is either ignored or obeyed blindly. What a proposal must carry in order to be debated, why a small decision vocabulary and a person who approves are worth having, and how to record the outcome by measuring before and after using observed data only.',
  ),
  relacionados: ['por-decidir', 'a1', 'a3', 'a6'],
  bloques: [
    p(
      'En muchos equipos las recomendaciones mueren de la misma manera: alguien las escribe en un documento o las dice en una reunión, nadie las discute con datos y a las pocas semanas ya no se sabe quién iba a hacer qué. La sugerencia no era mala; simplemente no tenía forma de ser discutida.',
      'In many teams, recommendations die the same way: someone writes them in a document or says them in a meeting, nobody debates them with data and a few weeks later nobody remembers who was going to do what. The suggestion was not bad; it simply had no way of being debated.',
    ),
    p(
      'Una recomendación solo se vuelve útil cuando se puede cuestionar: cuando trae su evidencia a la vista, tiene una persona que decide y deja un registro de lo que pasó después. Con eso, una sugerencia deja de ser una opinión y pasa a ser un hábito del equipo.',
      'A recommendation becomes useful only when it can be questioned: when it brings its evidence into view, has a person who decides and leaves a record of what happened afterward. With that, a suggestion stops being an opinion and becomes a team habit.',
    ),
    h2('Sin evidencia se ignora', 'Without evidence it is ignored'),
    p(
      'Una recomendación sin respaldo obliga a quien la recibe a elegir entre confiar en quien la escribió o desconfiar. Ninguna de las dos posturas es una discusión. Confiar sin ver es delegar a ciegas, y desconfiar sin ver es descartar sin criterio. En los dos casos el costo lo paga el negocio.',
      'A recommendation without support forces the reader to choose between trusting whoever wrote it or distrusting it. Neither stance is a discussion. Trusting without seeing is delegating blindly, and distrusting without seeing is dismissing without judgment. In both cases the business pays the cost.',
    ),
    p(
      'Con evidencia cambia la conversación. Si la propuesta dice qué observó, de dónde viene cada cifra, por qué se sugiere esa acción y qué se espera lograr, quien decide puede estar en desacuerdo con algo específico: la fuente, el periodo, el supuesto o la expectativa. Ese desacuerdo es justo lo que una recomendación debería provocar.',
      'With evidence the conversation changes. If the proposal states what it observed, where each figure comes from, why that action is suggested and what is expected, the decision maker can disagree with something specific: the source, the period, the assumption or the expectation. That disagreement is exactly what a recommendation should provoke.',
    ),
    p(
      'Imagina que un analista propone agregar una guía de tallas a una categoría porque las conversaciones de esa categoría repiten el mismo motivo de cambio. Si la propuesta trae el periodo, la fuente y las conversaciones de origen, quien lleva el catálogo puede objetar que el periodo es corto o que el motivo es el material y no la talla. La objeción mejora la decisión. Sin esos datos solo queda la opinión de uno contra la del otro.',
      'Imagine an analyst proposes adding a size guide to a category because the conversations in that category repeat the same reason for exchanges. If the proposal brings the period, the source and the originating conversations, whoever runs the catalog can object that the period is short or that the reason is the material and not the size. The objection improves the decision. Without that data, all that remains is one opinion against another.',
    ),
    p(
      'Una propuesta discutible responde cuatro preguntas:',
      'A debatable proposal answers four questions:',
    ),
    ul(
      ['Qué se observó, con la fuente y la fecha de corte de cada cifra.', 'What was observed, with the source and the cut-off date of each figure.'],
      ['Por qué se sugiere esta acción y no otra.', 'Why this action is suggested and not another.'],
      ['Qué se espera lograr, dicho de modo que después pueda medirse.', 'What is expected to be achieved, stated so that it can be measured afterward.'],
      ['Quién se hará responsable si se decide avanzar.', 'Who will be responsible if the decision is to go ahead.'],
    ),
    cita(
      'Una recomendación que no puede discutirse solo puede obedecerse o ignorarse.',
      'A recommendation that cannot be debated can only be obeyed or ignored.',
    ),
    h2('Proceder, Ajustar o Descartar', 'Proceed, Adjust or Dismiss'),
    p(
      'La decisión necesita un vocabulario pequeño y claro. En la pantalla {{por-decidir|Por decidir}} de Rovaq AI, una persona elige entre tres respuestas, y cada una tiene consecuencias definidas.',
      'The decision needs a small, clear vocabulary. On the {{por-decidir|To decide}} screen in Rovaq AI, a person chooses among three answers, and each has defined consequences.',
    ),
    ul(
      ['**Proceder** crea la intervención y los borradores que una persona revisa y envía. Nada se envía solo.', '**Proceed** creates the intervention and the drafts that a person reviews and sends. Nothing is sent automatically.'],
      ['**Ajustar** pide una razón, que queda registrada.', '**Adjust** asks for a reason, which is recorded.'],
      ['**Descartar** pide una razón, que queda registrada. Reabrir una propuesta descartada crea un evento nuevo y no borra nada.', '**Dismiss** asks for a reason, which is recorded. Reopening a dismissed proposal creates a new event and deletes nothing.'],
    ),
    p(
      'Pedir la razón no es un trámite. Una propuesta descartada con motivo le enseña al equipo qué criterios pesan, y evita que la misma idea vuelva a empezar de cero cada vez que alguien la propone.',
      'Asking for the reason is not red tape. A dismissed proposal with a stated reason teaches the team which criteria carry weight, and keeps the same idea from starting from zero each time someone proposes it.',
    ),
    p(
      'También importa quién puede hacer qué. Quién propone, quién aprueba y quién ejecuta depende del puesto, como explica {{a4|el artículo sobre puestos}}. Separar proponer de aprobar permite que cualquiera con una buena observación la ponga sobre la mesa sin que eso la convierta en una orden.',
      'Who can do what also matters. Who proposes, who approves and who carries out depends on the role, as {{a4|the article on roles}} explains. Separating proposing from approving lets anyone with a good observation put it on the table without that turning it into an order.',
    ),
    h2('Registrar el resultado', 'Record the outcome'),
    p(
      'Decidir no termina el ciclo. Sin un registro de lo que ocurrió, el equipo no aprende y la siguiente recomendación vuelve a empezar desde la opinión. Por eso el producto muestra, mientras una propuesta está en curso, quién es el responsable, cuál fue el compromiso, en qué etapa va y qué borradores existen.',
      'Deciding does not end the cycle. Without a record of what happened, the team does not learn and the next recommendation starts again from opinion. That is why the product shows, while a proposal is in progress, who is responsible, what the commitment was, what stage it is in and which drafts exist.',
    ),
    p(
      'Cuando hay un resultado, se mide antes y después, y solo con dato observado. Esa medición nunca presenta un beneficio supuesto: si no hay dato, el resultado dice que no lo hay en lugar de rellenar el hueco con una estimación optimista. Esa disciplina es incómoda, pero es la que hace que el registro valga la pena.',
      'When there is an outcome, it is measured before and after, and only with observed data. That measurement never presents an assumed benefit: if there is no data, the outcome says there is none instead of filling the gap with an optimistic estimate. That discipline is uncomfortable, but it is what makes the record worth keeping.',
    ),
    p(
      'Un registro útil también protege a quien propuso. Si el resultado no fue el esperado, la pregunta deja de ser quién se equivocó y pasa a ser qué supuesto no se cumplió, que es una pregunta que el equipo sí puede responder y de la que puede aprender.',
      'A useful record also protects whoever made the proposal. If the outcome was not the one expected, the question stops being who got it wrong and becomes which assumption did not hold, which is a question the team can answer and learn from.',
    ),
    p(
      'Conviene ser claros sobre lo que aquí se cuenta. Describimos lo que el producto permite hacer, no resultados obtenidos con él.',
      'A word on scope: we describe what the product allows you to do, not results obtained with it.',
    ),
    h2('Cómo llevarlo a tu equipo', 'How to bring it to your team'),
    p(
      'El método no depende de una herramienta. Puedes empezar con una hoja compartida y estos pasos:',
      'The method does not depend on a tool. You can start with a shared sheet and these steps:',
    ),
    pasos(
      ['Escribe cada recomendación con las cuatro respuestas: qué se observó, por qué, qué se espera y quién responde.', 'Write each recommendation with the four answers: what was observed, why, what is expected and who answers for it.'],
      ['Decide en una reunión corta con una sola de tres salidas, avanzar, ajustar o descartar, y anota la razón.', 'Decide in a short meeting with one of three outcomes, proceed, adjust or dismiss, and write down the reason.'],
      ['Fija desde el inicio cómo se medirá el resultado, con qué dato y en qué periodo.', 'Set from the start how the outcome will be measured, with what data and over what period.'],
      ['Mide antes y después con lo observado, y escribe lo que no se pudo medir como no medido.', 'Measure before and after with what was observed, and write what could not be measured as not measured.'],
      ['Revisa de vez en cuando las propuestas descartadas: algunas merecen reabrirse, y reabrir no borra lo anterior.', 'Review dismissed proposals from time to time: some deserve to be reopened, and reopening does not erase what came before.'],
    ),
    p(
      'Una buena primera propuesta suele nacer de un hallazgo concreto, de los que se describen en {{a1|el artículo sobre reembolsos}} y en {{a6|el de puntos de dolor}}, y no de una corazonada.',
      'A good first proposal usually comes from a concrete finding, the kind described in {{a1|the article on refunds}} and in {{a6|the one on pain points}}, and not from a hunch.',
    ),
    noAfirmamos(
      ['No afirmamos que seguir una recomendación mejore los resultados: el producto registra lo que pasó, no lo garantiza.', 'We do not claim that following a recommendation improves results: the product records what happened, it does not guarantee it.'],
      ['No mostramos casos ni resultados de clientes; este artículo describe lo que el producto permite.', 'We show no cases or customer results; this article describes what the product allows.'],
      ['No prometemos ningún beneficio económico: el resultado se mide con dato observado y, sin dato, se dice que no lo hay.', 'We do not promise any financial benefit: the outcome is measured with observed data and, without data, the screen says there is none.'],
      ['No decimos que una propuesta descartada sea un error: puede ser la decisión correcta y debe quedar registrada.', 'We do not say that a dismissed proposal is a mistake: it may be the right decision and it should be recorded.'],
      ['No afirmamos que el producto decida por el equipo: la elección entre Proceder, Ajustar y Descartar la hace una persona, y nada se envía ni se ejecuta sin ella.', 'We do not claim that the product decides for the team: the choice between Proceed, Adjust and Dismiss is made by a person, and nothing is sent or carried out without one.'],
    ),
  ],
});

export const ARTICULOS_B: readonly Articulo[] = [ARTICULO_A6, ARTICULO_A7, ARTICULO_A8];
