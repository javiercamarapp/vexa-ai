// Artículos a2 a a5 del blog (T25-A). a6 a a8 viven en blog-b.ts y a1 en blog.ts. Guía de forma: ARTICULO_A1 en blog.ts.
// Reglas: autor siempre la organización, ninguna cifra inventada, ningún cliente, ninguna certificación, y solo lo que P-D marca como PUBLICO
// o MATIZ con su condición. Enlaces internos con {{id|texto}}; constructores p, h2, h3, ul, pasos, cita, noAfirmamos y articulo, de ../ayudas.ts.
import type { Articulo } from '../tipos.ts';
import { articulo, b, cita, h2, h3, noAfirmamos, p, pasos, ul } from '../ayudas.ts';

export const ARTICULO_A2: Articulo = articulo({
  id: 'a2',
  pub: '2026-11-03',
  etiqueta: b('Procedencia', 'Provenance'),
  seo: {
    titulo: b('Procedencia de cada número: requisito, no adorno | Rovaq AI', 'Where Every Number Comes From: Provenance | Rovaq AI'),
    descripcion: b(
      'Un tablero sin procedencia obliga a creerle. Con fecha de corte, fuente y lo que aún no se sabe, una cifra se puede discutir. Así lo hacemos en Rovaq AI.',
      'A dashboard without provenance forces you to believe it. With a cut-off date, a source and what is still unknown, a figure can be debated. Here is how.',
    ),
  },
  h1: b('De dónde sale cada número: la procedencia como requisito, no como adorno', 'Where every number comes from: provenance as a requirement, not decoration'),
  subtitulo: b(
    'Una cifra sin origen solo se puede aceptar o rechazar. Con su fuente, su fecha de corte y sus vacíos a la vista, se puede discutir.',
    'A figure without an origin can only be accepted or rejected. With its source, its cut-off date and its gaps in plain view, it can be debated.',
  ),
  resumen: b(
    'Un tablero que no explica de dónde viene cada cifra obliga a creerle. Este artículo describe qué debe acompañar a un número para que se pueda discutir: su clase, su fuente, su fecha de corte y lo que todavía no se sabe, y por qué eso no equivale a una certificación.',
    'A dashboard that does not explain where each figure comes from forces you to believe it. This article describes what should accompany a number so it can be debated: its class, its source, its cut-off date and what is still unknown, and why that is not the same as a certification.',
  ),
  relacionados: ['confianza-de-los-datos', 'fuentes-e-importaciones', 'a1', 'hoy'],
  bloques: [
    p(
      'Casi todos los equipos han vivido la misma escena. Alguien abre un tablero, ve una cifra que no esperaba y pregunta de dónde sale. Nadie lo sabe con certeza. Se revisan las fórmulas, se busca al autor del reporte, se compara contra una hoja de cálculo y, al final, la reunión se gasta en averiguar si el número es cierto en lugar de decidir qué hacer con él.',
      'Almost every team has lived the same scene. Someone opens a dashboard, sees a figure they did not expect and asks where it comes from. Nobody knows for sure. The formulas get checked, the author of the report is tracked down, the number is compared against a spreadsheet and, in the end, the meeting is spent finding out whether the figure is true instead of deciding what to do about it.',
    ),
    p(
      'Este artículo defiende una idea sencilla: la procedencia no es un adorno que se agrega al final para dar buena impresión, sino un requisito que se cumple antes de mostrar una cifra. Un número que no puede explicar su origen no es un dato, es una opinión con formato.',
      'This article defends a simple idea: provenance is not a decoration added at the end to make a good impression, but a requirement met before a figure is shown. A number that cannot explain its origin is not data, it is an opinion with formatting.',
    ),
    h2('Un tablero que obliga a creer', 'A dashboard that demands belief'),
    p(
      'Un tablero tradicional presenta resultados limpios: una cifra grande, una gráfica, una variación contra el periodo anterior. Esa limpieza es útil para mirar rápido, pero esconde todo lo que haría falta para dudar con criterio. No dice si el número viene de un registro, de una estimación o de un cálculo hecho con supuestos. No dice hasta qué día llegan los datos. No dice qué parte del negocio quedó fuera.',
      'A traditional dashboard presents clean results: a large figure, a chart, a change against the previous period. That cleanliness is useful for a quick look, but it hides everything needed to doubt with judgment. It does not say whether the number comes from a record, an estimate or a calculation made with assumptions. It does not say which day the data reaches. It does not say which part of the business was left out.',
    ),
    p(
      'Cuando faltan esas respuestas, el lector tiene dos opciones, y las dos son malas. Puede aceptar la cifra por cortesía hacia quien la presenta, o puede rechazarla por desconfianza general. En ninguno de los dos casos está evaluando el número: está evaluando a la persona o a la herramienta que lo muestra.',
      'When those answers are missing, the reader has two options, and both are bad. They can accept the figure out of courtesy toward whoever presents it, or reject it out of general distrust. In neither case are they evaluating the number: they are evaluating the person or the tool that shows it.',
    ),
    cita(
      'Una cifra que no explica su origen obliga a creerle. Una cifra con procedencia se puede discutir.',
      'A figure that does not explain its origin demands belief. A figure with provenance can be debated.',
    ),
    h2('Fecha de corte, fuente y vacíos', 'Cut-off date, source and gaps'),
    p(
      'Para que una cifra se pueda discutir hacen falta cuatro cosas que viajen con ella. En Rovaq AI las llamamos el sello de la cifra, y aparece bajo cada número importante.',
      'For a figure to be debatable, four things need to travel with it. In Rovaq AI we call them the figure seal, and it appears under every important number.',
    ),
    ul(
      ['La clase. Una cifra puede ser observada, es decir, un hecho registrado; estimada, calculada con un modelo o con supuestos que defines tú; inferida, derivada de otras relaciones; o puede ser Sin dato. Mezclar esas clases en una misma columna es la forma más común de engañarse sin querer.', 'The class. A figure can be observed, meaning a recorded fact; estimated, calculated with a model or with assumptions you define; inferred, derived from other relationships; or it can be No data. Mixing those classes in one column is the most common way to fool yourself without meaning to.'],
      ['La fuente. De qué archivo, de qué sistema o de qué carga viene el registro, de modo que quien dude pueda ir a verlo.', 'The source. Which file, which system or which load the record comes from, so that anyone in doubt can go and look.'],
      ['La fecha de corte. Hasta qué día llegan los datos. Una cifra correcta hasta el día quince y una correcta hasta el día treinta no son la misma cifra, aunque se llamen igual.', 'The cut-off date. Which day the data reaches. A figure correct up to the fifteenth and one correct up to the thirtieth are not the same figure, even if they share a name.'],
      ['La antigüedad. Cuánto tiempo ha pasado desde la última actualización, para que nadie tome una foto vieja por la situación de hoy.', 'The age. How much time has passed since the last update, so nobody mistakes an old snapshot for today.'],
    ),
    p(
      'La regla que sostiene todo lo demás es esta: si no se sabe la fecha de corte, el sello lo dice. Y lo mismo vale para cualquier dato ausente. Lo desconocido se muestra como Sin dato, nunca como cero. Un cero afirma que se midió y no hubo nada; un Sin dato admite que no se sabe. La diferencia parece pequeña hasta que alguien toma una decisión creyendo que una categoría no tiene movimiento cuando, en realidad, nadie cargó sus registros.',
      'The rule that holds everything else up is this: if the cut-off date is not known, the seal says so. The same goes for any missing data. What is unknown is shown as No data, never as zero. A zero asserts that something was measured and nothing was found; a No data admits that it is not known. The difference seems small until someone makes a decision believing a category has no activity when, in fact, nobody loaded its records.',
    ),
    h3('El libro que no borra', 'The ledger that deletes nothing'),
    p(
      'La procedencia también depende de cómo se guarda el dato. En Rovaq AI cada organización tiene un libro de solo inserción: cuando algo se corrige, se agrega una revisión y no se borra la versión anterior. Así, una corrección deja rastro en lugar de reescribir la historia en silencio, y quien revisa puede ver que hubo un cambio y cuándo se hizo.',
      'Provenance also depends on how the data is stored. In Rovaq AI each organization has an insert-only ledger: when something is corrected, a revision is added and the earlier version is not erased. That way, a correction leaves a trail instead of quietly rewriting history, and whoever reviews can see that a change happened and when it was made.',
    ),
    h2('Confianza de los datos frente a un aval externo', 'Data trust versus outside endorsement'),
    p(
      'Conviene separar dos cosas que suelen confundirse. La confianza en los datos responde a una pregunta práctica: cuánto puedo fiarme de esta cifra hoy. Una certificación responde a otra: si una organización cumple con cierto estándar, verificado por un tercero. Son asuntos distintos y no se sustituyen.',
      'Two things that are often confused are worth separating. Data trust answers a practical question: how much can I rely on this figure today. A certification answers another: whether an organization meets a certain standard, verified by a third party. They are different matters and neither replaces the other.',
    ),
    p(
      'La pantalla de {{confianza-de-los-datos|confianza de los datos}} existe para lo primero. Muestra un semáforo por fuente, la frescura de cada cifra, su cobertura y una lista de lo que todavía no se sabe. Es una herramienta para el trabajo de cada día: antes de mover dinero o de escribirle a un proveedor, quien decide puede ver qué fuentes están al corriente, cuáles se quedaron atrás y qué huecos siguen abiertos.',
      'The {{confianza-de-los-datos|data trust}} screen exists for the first. It shows a traffic light per source, the freshness of each figure, its coverage and a list of what is still unknown. It is a tool for everyday work: before moving money or writing to a supplier, whoever decides can see which sources are up to date, which fell behind and which gaps remain open.',
    ),
    p(
      'Lo segundo, la certificación, es otra conversación, y la tenemos con franqueza: Rovaq AI no cuenta hoy con certificaciones de seguridad ni de cumplimiento, y no decimos lo contrario en ninguna parte. Una pantalla de confianza no pretende ocupar ese lugar. Lo que sí hace es dejar a la vista el estado real de cada fuente, que es lo que un equipo necesita para trabajar con cifras sin ceguera.',
      'The second, certification, is a different conversation, and we have it plainly: Rovaq AI does not hold security or compliance certifications today, and we say otherwise nowhere. A trust screen does not try to take that place. What it does is leave the real state of each source in plain view, which is what a team needs to work with figures without going blind.',
    ),
    h2('Una prueba sencilla para tu propio tablero', 'A simple test for your own dashboard'),
    p(
      'No hace falta adoptar ninguna herramienta para empezar a exigir procedencia. Toma las tres cifras que más pesan en tus decisiones y hazles estas preguntas, en voz alta y delante de quien las prepara:',
      'You do not need to adopt any tool to start demanding provenance. Take the three figures that weigh most in your decisions and put these questions to them, out loud and in front of whoever prepares them:',
    ),
    pasos(
      ['De qué archivo o sistema sale, y quién puede abrirlo para comprobarlo.', 'Which file or system it comes from, and who can open it to check.'],
      ['Hasta qué día llegan los datos y cuándo se actualizaron por última vez.', 'Which day the data reaches and when it was last updated.'],
      ['Si es un hecho registrado, una estimación o una inferencia, y quién escribió los supuestos cuando los hay.', 'Whether it is a recorded fact, an estimate or an inference, and who wrote the assumptions when there are any.'],
      ['Qué parte del negocio quedó fuera y cómo se está mostrando esa ausencia.', 'Which part of the business was left out and how that absence is being shown.'],
    ),
    p(
      'Si las respuestas llegan rápido y coinciden entre sí, el tablero se gana su lugar. Si cuestan trabajo, ya tienes una lista de lo que conviene arreglar antes de la siguiente reunión. En cualquiera de los dos casos, la conversación mejora: deja de tratar de si el número es cierto y empieza a tratar de qué se hace con él. Un buen ejemplo es el de los reembolsos, que ya revisamos en {{a1|este artículo sobre fugas de dinero devuelto}}, donde cada total solo vale lo que valga su origen.',
      'If the answers arrive quickly and agree with one another, the dashboard earns its place. If they take effort, you already have a list of what is worth fixing before the next meeting. In either case the conversation improves: it stops being about whether the number is true and starts being about what to do with it. A good example is refunds, which we covered in {{a1|this article on leaks in returned money}}, where every total is worth only as much as its origin.',
    ),
    noAfirmamos(
      ['No afirmamos que una cifra con procedencia sea correcta. La procedencia permite revisarla, no la vuelve cierta por sí sola.', 'We do not claim that a figure with provenance is correct. Provenance makes it possible to review it; it does not make it true by itself.'],
      ['No afirmamos que la pantalla de confianza de los datos sea una certificación ni que sustituya una auditoría.', 'We do not claim that the data trust screen is a certification or that it replaces an audit.'],
      ['No tenemos certificaciones de seguridad ni de cumplimiento, y no insinuamos lo contrario.', 'We hold no security or compliance certifications, and we do not suggest otherwise.'],
      ['No tratamos un dato desconocido como cero: si falta, el sello dice Sin dato.', 'We do not treat unknown data as zero: if it is missing, the seal says No data.'],
      ['No prometemos que los datos estén al día en todo momento: cada cifra muestra su fecha de corte y su antigüedad.', 'We do not promise that data is current at every moment: every figure shows its cut-off date and its age.'],
    ),
  ],
});

export const ARTICULO_A3: Articulo = articulo({
  id: 'a3',
  pub: '2026-11-03',
  etiqueta: b('Inteligencia artificial', 'Artificial intelligence'),
  seo: {
    titulo: b('La IA clasifica y redacta; las personas deciden | Rovaq AI', 'AI Classifies and Drafts, People Decide | Rovaq AI'),
    descripcion: b(
      'Una herramienta que inventa importes pierde la confianza en el primer reporte. Explicamos por qué la IA no crea cifras y una persona decide cada acción.',
      'A tool that invents amounts loses trust at the first report. We explain the principle that AI never creates figures and that a person decides every action.',
    ),
  },
  h1: b('La IA clasifica y redacta; las personas deciden', 'AI classifies and drafts; people decide'),
  subtitulo: b(
    'Dónde conviene usar un modelo de lenguaje en un producto financiero, dónde no, y por qué las cifras no deben salir de él.',
    'Where a language model belongs in a financial product, where it does not, and why the figures should never come from it.',
  ),
  resumen: b(
    'Una herramienta que inventa importes pierde la confianza en el primer reporte. Este artículo explica el principio con el que diseñamos Rovaq AI: la IA ayuda a clasificar y a redactar, las cifras salen de registros verificables y una persona decide cada acción.',
    'A tool that invents amounts loses trust at the first report. This article explains the principle we used to design Rovaq AI: AI helps classify and draft, figures come from verifiable records and a person decides every action.',
  ),
  relacionados: ['pregunta-a-tus-datos', 'por-decidir', 'problemas', 'confianza-de-los-datos'],
  bloques: [
    p(
      'Hay una promesa que se repite en casi todos los productos que incorporan inteligencia artificial: hará el trabajo por ti. Se dice de los resúmenes, de las recomendaciones, de las respuestas a preguntas de negocio. La promesa es atractiva y, en tareas de texto, a menudo se cumple. El problema aparece cuando se extiende, sin más, al dinero.',
      'There is a promise repeated in almost every product that adds artificial intelligence: it will do the work for you. It is said of summaries, of recommendations, of answers to business questions. The promise is attractive and, in text tasks, it is often kept. The problem appears when it is extended, without further thought, to money.',
    ),
    p(
      'Este artículo explica el principio con el que diseñamos Rovaq AI y por qué lo consideramos una condición de confianza y no una limitación: la IA ayuda a ordenar y a redactar; las cifras salen de registros que se pueden verificar; y una persona decide cada acción.',
      'This article explains the principle we used to design Rovaq AI and why we consider it a condition of trust and not a limitation: AI helps to organize and to draft; figures come from records that can be verified; and a person decides every action.',
    ),
    h2('El riesgo de una IA que inventa importes', 'The risk of AI that invents amounts'),
    p(
      'Un modelo de lenguaje produce texto verosímil. Esa es su fortaleza y también su riesgo: una frase puede sonar exacta sin serlo. Si le pides que resuma una conversación, un error menor casi no importa. Si le pides un importe, la misma clase de error cambia una decisión.',
      'A language model produces plausible text. That is its strength and also its risk: a sentence can sound exact without being so. If you ask it to summarize a conversation, a minor error hardly matters. If you ask it for an amount, the same kind of error changes a decision.',
    ),
    p(
      'Además, el daño no se reparte parejo. Una herramienta que acierta casi siempre, pero que de vez en cuando inventa un importe, tiene un costo peor que una que falla seguido: con la segunda sabes que debes verificar todo; con la primera dejas de verificar y el error pasa. La confianza se pierde en el primer reporte donde alguien descubre que una cifra no tenía de dónde salir, y recuperarla es lento.',
      'Besides, the harm is not evenly spread. A tool that is right almost always, but now and then invents an amount, has a worse cost than one that fails often: with the second you know you must verify everything; with the first you stop verifying and the error gets through. Trust is lost at the first report where someone discovers that a figure had nowhere to come from, and earning it back is slow.',
    ),
    cita(
      'La IA puede ayudar a leer y a escribir. Los importes no se le piden.',
      'AI can help to read and to write. Amounts are not asked of it.',
    ),
    h2('Las cifras salen del libro verificable', 'Figures come from the verifiable ledger'),
    p(
      'La alternativa es separar dos trabajos que suelen mezclarse. Uno es entender texto: agrupar conversaciones parecidas, proponer una categoría, redactar un borrador. El otro es calcular dinero: sumar reembolsos, comparar periodos, medir cuánto ingreso está expuesto a un problema. El primero tolera cierta ambigüedad y se revisa leyendo. El segundo no la tolera y debe poder rehacerse.',
      'The alternative is to separate two jobs that tend to get mixed. One is understanding text: grouping similar conversations, proposing a category, drafting a message. The other is calculating money: adding up refunds, comparing periods, measuring how much revenue is exposed to a problem. The first tolerates some ambiguity and is reviewed by reading. The second does not tolerate it and must be repeatable.',
    ),
    p(
      'En Rovaq AI, el segundo trabajo lo hacen reglas y cálculos sobre el libro de la organización, que es de solo inserción y conserva el origen de cada registro. Cada cifra importante lleva su clase, su fuente y su fecha de corte, como explicamos en {{a2|el artículo sobre procedencia}}. Cuando algo no se sabe, el sistema dice Sin dato; no rellena el hueco con una suposición redactada con aplomo.',
      'In Rovaq AI, the second job is done by rules and calculations over the organization ledger, which is insert-only and keeps the origin of each record. Every important figure carries its class, its source and its cut-off date, as we explain in {{a2|the article on provenance}}. When something is not known, the system says No data; it does not fill the gap with an assumption written with confidence.',
    ),
    p(
      'La pantalla {{pregunta-a-tus-datos|Pregúntale a tus datos}} es el ejemplo más claro. Hoy responde con reglas y con herramientas de solo lectura, sin un modelo de lenguaje, y muestra los pasos con los que calculó cada respuesta. Si no tiene el dato, lo dice. Quien la usa puede seguir el cálculo y repetirlo; no tiene que creer en una respuesta redactada.',
      'The {{pregunta-a-tus-datos|Ask your data}} screen is the clearest example. Today it answers with rules and with read-only tools, without a language model, and it shows the steps it took to calculate each answer. If it does not have the data, it says so. Whoever uses it can follow the calculation and repeat it; they do not have to believe a written answer.',
    ),
    h2('Qué hace hoy la IA y qué no', 'What AI does today and what it does not'),
    p(
      'Decir que la IA no crea cifras no significa que no tenga trabajo. Hay tareas donde un modelo es útil precisamente porque su salida se puede leer y corregir:',
      'Saying that AI does not create figures does not mean it has no work to do. There are tasks where a model is useful precisely because its output can be read and corrected:',
    ),
    ul(
      ['Agrupar conversaciones en problemas. La agrupación con modelos de IA se habilita por organización, y cada grupo conserva sus citas para que alguien pueda comprobar que de verdad pertenecen ahí.', 'Grouping conversations into problems. Grouping with AI models is enabled per organization, and each group keeps its quotes so that someone can check they really belong there.'],
      ['Clasificar. Proponer una categoría para un tema repetido, para que una persona la revise.', 'Classifying. Proposing a category for a repeated theme, for a person to review.'],
      ['Redactar. Preparar el borrador de un mensaje a un proveedor o de una nota interna, que una persona revisa antes de enviar.', 'Drafting. Preparing the draft of a message to a supplier or of an internal note, which a person reviews before sending.'],
    ),
    p(
      'Y hay cosas que no hace. No produce importes. No decide qué acción tomar. No envía nada por su cuenta. No escribe en tu CRM, que en el caso de HubSpot se conecta en solo lectura. Un borrador es una propuesta de texto, no una acción realizada.',
      'And there are things it does not do. It does not produce amounts. It does not decide what action to take. It does not send anything on its own. It does not write to your CRM, which in the case of HubSpot connects read-only. A draft is a proposal of text, not an action taken.',
    ),
    h3('Una persona decide cada acción', 'A person decides every action'),
    p(
      'El último paso es siempre humano. En la pantalla {{por-decidir|Por decidir}}, cada propuesta llega con su evidencia y su motivo, y la persona responsable elige entre Proceder, Ajustar o Descartar. Proceder crea la intervención y los borradores que alguien revisa y envía. Nada se envía solo, y el resultado queda registrado.',
      'The last step is always human. In the {{por-decidir|To decide}} screen, each proposal arrives with its evidence and its reason, and the person in charge chooses between Proceed, Adjust or Dismiss. Proceed creates the intervention and the drafts that someone reviews and sends. Nothing is sent on its own, and the outcome is recorded.',
    ),
    p(
      'Registrar el resultado cumple dos funciones. La primera es de memoria: dentro de seis meses, alguien puede saber por qué se actuó o no se actuó. La segunda es de aprendizaje: un equipo que anota qué decidió y qué pasó después puede mejorar sus propios criterios, sin atribuirle a una máquina un juicio que no le corresponde.',
      'Recording the outcome serves two purposes. The first is memory: six months from now, someone can know why action was or was not taken. The second is learning: a team that notes what it decided and what happened next can improve its own criteria, without attributing to a machine a judgment that is not its to make.',
    ),
    h2('Una regla para evaluar cualquier herramienta', 'A rule for evaluating any tool'),
    p(
      'Si evalúas software con inteligencia artificial para tu negocio, hay tres preguntas que ayudan más que cualquier demostración:',
      'If you are evaluating software with artificial intelligence for your business, three questions help more than any demonstration:',
    ),
    pasos(
      ['De dónde sale cada importe: de un registro que puedo abrir o de un texto que el modelo redactó.', 'Where each amount comes from: a record I can open or a text the model wrote.'],
      ['Qué pasa cuando falta información: si lo dice, o si la rellena con algo que suena razonable.', 'What happens when information is missing: whether it says so, or fills in the gap with something that sounds reasonable.'],
      ['Quién ejecuta la acción: si una persona la aprueba o si ocurre sola.', 'Who carries out the action: whether a person approves it or it happens on its own.'],
    ),
    p(
      'Una herramienta que responde bien a las tres puede equivocarse, como cualquiera, pero sus errores serán visibles y corregibles. Eso es lo que buscamos al separar con claridad lo que el modelo hace de lo que le queda fuera. Si quieres ver cómo se aplica a un caso concreto, revisa cómo se agrupan las conversaciones en {{problemas|la pantalla de Problemas}}.',
      'A tool that answers all three well can still be wrong, like any other, but its errors will be visible and correctable. That is what we aim for by separating clearly what the model does from what stays outside it. If you want to see how this applies to a concrete case, look at how conversations are grouped in {{problemas|the Problems screen}}.',
    ),
    noAfirmamos(
      ['No afirmamos que la IA no se equivoque. Por eso sus propuestas se leen y una persona decide qué hacer con ellas.', 'We do not claim that AI makes no mistakes. That is why its proposals are read and a person decides what to do with them.'],
      ['No afirmamos que Rovaq AI sea un agente autónomo: prepara paquetes y borradores, y una persona decide y presenta cada acción.', 'We do not claim that Rovaq AI is an autonomous agent: it prepares packages and drafts, and a person decides and files every action.'],
      ['No afirmamos que la agrupación con modelos esté encendida en todas las organizaciones: se habilita por organización.', 'We do not claim that grouping with models is on for every organization: it is enabled per organization.'],
      ['No afirmamos que los datos estén anonimizados. Redactar o enmascarar un texto no es anonimizarlo.', 'We do not claim that data is anonymized. Redacting or masking a text is not anonymizing it.'],
      ['No prometemos ningún monto ni ningún resultado económico como consecuencia de una recomendación.', 'We do not promise any amount or any financial result as a consequence of a recommendation.'],
    ),
  ],
});

export const ARTICULO_A4: Articulo = articulo({
  id: 'a4',
  pub: '2026-11-03',
  etiqueta: b('Puestos y permisos', 'Roles and permissions'),
  seo: {
    titulo: b('Un puesto, una vista: cada rol ve lo que le toca | Rovaq AI', 'One Role, One View: Each Role Sees What Fits | Rovaq AI'),
    descripcion: b(
      'Mostrar menos es seguridad y claridad. Cómo se reparten las vistas entre propietario, analista, operador y lector, con permisos decididos en el servidor.',
      'Showing less is a security and clarity feature. How views are split among owner, analyst, operator and viewer, with access decided on the server.',
    ),
  },
  h1: b('Un puesto, una vista: por qué cada rol ve solo lo que le toca', 'One role, one view: why each role sees only what belongs to it'),
  subtitulo: b(
    'Una herramienta con todo para todos parece generosa y rinde poco. Mostrar menos protege la información y ayuda a trabajar.',
    'A tool with everything for everyone looks generous and delivers little. Showing less protects information and helps people work.',
  ),
  resumen: b(
    'Una herramienta que muestra todo a todos es más difícil de usar y más difícil de proteger. Este artículo explica cómo se reparten las vistas entre propietario, analista, operador y lector en Rovaq AI, por qué los permisos mínimos ayudan a la claridad y qué significa que la autorización se decida en el servidor.',
    'A tool that shows everything to everyone is harder to use and harder to protect. This article explains how views are split among owner, analyst, operator and viewer in Rovaq AI, why minimal permissions help clarity and what it means for authorization to be decided on the server.',
  ),
  relacionados: ['casos-de-uso', 'propietario', 'analista', 'operador', 'lector'],
  bloques: [
    p(
      'Cuando un equipo adopta una herramienta nueva, la primera pregunta suele ser qué puede hacer. La segunda, que casi nunca se hace a tiempo, es quién debería poder hacer qué. Cuando esa segunda pregunta se pospone, el resultado es una aplicación donde todos ven todo: la persona que ejecuta una tarea tropieza con pantallas que no le conciernen y quien revisa el dinero convive con controles que no necesita.',
      'When a team adopts a new tool, the first question is usually what it can do. The second, which is almost never asked in time, is who should be able to do what. When that second question is put off, the result is an application where everyone sees everything: the person carrying out a task stumbles over screens that do not concern them, and whoever reviews the money lives alongside controls they do not need.',
    ),
    p(
      'Este artículo defiende lo contrario. Mostrar menos a cada persona no es una restricción incómoda sino una decisión de diseño con dos beneficios: la información está más protegida y el trabajo es más claro.',
      'This article defends the opposite. Showing each person less is not an uncomfortable restriction but a design decision with two benefits: information is better protected and the work is clearer.',
    ),
    h2('Menos pantallas, más claridad', 'Fewer screens, more clarity'),
    p(
      'Una pantalla sobrante tiene un costo que no se ve en las demostraciones. Cada opción adicional es algo que hay que entender, ignorar o evitar tocar por error. Un operador que debe resolver acciones asignadas no gana nada con ver los reportes financieros de la empresa; en cambio, pierde tiempo buscando entre elementos que no son suyos.',
      'A surplus screen has a cost that does not show in demonstrations. Every additional option is something to understand, ignore or avoid touching by mistake. An operator who has to resolve assigned actions gains nothing from seeing the company financial reports; instead, they lose time searching among items that are not theirs.',
    ),
    p(
      'Por eso conviene pensar las vistas desde el trabajo y no desde el menú. La pregunta no es qué pantallas existen, sino qué necesita ver quien ocupa cada puesto para hacer bien lo suyo. Lo demás, no aparece.',
      'That is why it helps to design views from the work and not from the menu. The question is not which screens exist, but what the person in each role needs to see to do their own job well. Everything else does not appear.',
    ),
    cita(
      'Una vista bien pensada es la que le quita a cada persona todo lo que no necesita para su trabajo.',
      'A well-designed view is one that removes from each person everything they do not need for their work.',
    ),
    h2('Cuatro roles con permisos mínimos', 'Four roles with minimal permissions'),
    p(
      'Rovaq AI trabaja con cuatro puestos. Cada uno recibe lo necesario para su función, y nada más.',
      'Rovaq AI works with four roles. Each one receives what its function requires, and nothing more.',
    ),
    ul(
      ['{{propietario|Propietario}}. Configura, decide y aprueba. Ve todas las pantallas y administra el equipo, los avisos y la retención de datos. Es quien da el visto bueno a las acciones que se proponen.', '{{propietario|Owner}}. Configures, decides and approves. Sees all screens and manages the team, the notices and data retention. It is the one who gives the go-ahead to the actions that are proposed.'],
      ['{{analista|Analista}}. Investiga, prepara y propone. Ve el dinero, los problemas, los puntos de dolor y las importaciones, e importa archivos. Propone, pero no aprueba.', '{{analista|Analyst}}. Investigates, prepares and proposes. Sees the money, the problems, the pain points and the imports, and imports files. Proposes, but does not approve.'],
      ['{{operador|Operador}}. Ejecuta las acciones que le asignan. Ve los problemas, las acciones asignadas y su evidencia, sin cifras de dinero.', '{{operador|Operator}}. Carries out the actions assigned to them. Sees the problems, the assigned actions and their evidence, without money figures.'],
      ['{{lector|Lector}}. Consulta en solo lectura. Ve las pantallas que le corresponden, sin poder modificar datos, conexiones ni decisiones.', '{{lector|Viewer}}. Reads with read-only access. Sees the screens that apply to them, unable to modify data, connections or decisions.'],
    ),
    p(
      'La separación entre quien propone y quien aprueba merece una mención aparte. Que el analista prepare un hallazgo y el propietario lo apruebe no es burocracia: es la forma de asegurar que una persona distinta mire la evidencia antes de que algo se ponga en marcha. Y que el operador ejecute sin ver cifras de dinero significa que quien hace el trabajo cotidiano no necesita acceso a lo que no usa.',
      'The separation between whoever proposes and whoever approves deserves its own mention. That the analyst prepares a finding and the owner approves it is not bureaucracy: it is the way to make sure a different person looks at the evidence before anything is set in motion. And that the operator carries out work without seeing money figures means that whoever does the daily work does not need access to what they do not use.',
    ),
    p(
      'Este reparto sigue un principio conocido como permisos mínimos: cada persona recibe solo el acceso que su función exige. Una cuenta con menos alcance expone menos si algo sale mal, ya sea un error, un descuido o una credencial que cae en manos equivocadas.',
      'This split follows a principle known as least privilege: each person receives only the access their function requires. An account with less reach exposes less if something goes wrong, whether a mistake, an oversight or a credential that falls into the wrong hands.',
    ),
    h3('Un recorrido de ejemplo', 'A walk-through example'),
    p(
      'Imagina un hallazgo cualquiera: un producto concentra buena parte del dinero devuelto. El analista lo investiga, reúne la evidencia y propone una acción. El propietario ve la propuesta con su evidencia y decide si procede, si se ajusta o si se descarta. Si procede, el operador recibe la acción asignada y la ejecuta, con los problemas y la evidencia a la vista pero sin las cifras de dinero que no necesita. Y el lector, si el equipo tiene uno, puede seguir el avance sin riesgo de cambiar nada.',
      'Imagine any finding: a product accounts for a good share of the returned money. The analyst investigates it, gathers the evidence and proposes an action. The owner sees the proposal with its evidence and decides whether to proceed, adjust or dismiss. If it proceeds, the operator receives the assigned action and carries it out, with the problems and the evidence in view but without the money figures they do not need. And the viewer, if the team has one, can follow the progress with no risk of changing anything.',
    ),
    p(
      'Cada persona ve una parte distinta del mismo hecho y, sin embargo, nadie necesita una vista completa para cumplir su función. Esa es la prueba más sencilla de que el reparto está bien hecho: nadie echa de menos lo que no ve, porque no le hacía falta para trabajar.',
      'Each person sees a different part of the same fact and yet nobody needs a complete view to fulfill their role. That is the simplest proof that the split is well made: nobody misses what they do not see, because they did not need it to work.',
    ),
    h2('Autorización en el servidor', 'Server-side authorization'),
    p(
      'Hay una diferencia importante entre ocultar y proteger. Muchas aplicaciones esconden de la interfaz las opciones que un usuario no debería usar, y con eso consideran resuelto el tema. Pero un elemento que no aparece en el menú sigue existiendo si alguien conoce la dirección de la pantalla o la forma de pedir el dato.',
      'There is an important difference between hiding and protecting. Many applications hide from the interface the options a user should not use, and consider the matter settled. But an element that does not appear in the menu still exists if someone knows the address of the screen or the way to ask for the data.',
    ),
    p(
      'En Rovaq AI la autorización se decide en el servidor. Ocultar un elemento del menú es una comodidad de lectura; no es lo que protege una pantalla. La decisión de si una persona puede ver un dato o realizar una acción se toma del lado que el usuario no controla, cada vez que se pide.',
      'In Rovaq AI authorization is decided on the server. Hiding a menu item is a reading convenience; it is not what protects a screen. The decision of whether a person can see a piece of data or carry out an action is taken on the side the user does not control, every time it is requested.',
    ),
    h3('Qué preguntar al evaluar una herramienta', 'What to ask when evaluating a tool'),
    p(
      'Si estás comparando software para tu equipo, hay tres preguntas que revelan mucho sobre cómo trata los permisos:',
      'If you are comparing software for your team, three questions reveal a lot about how it handles permissions:',
    ),
    pasos(
      ['Qué ve cada puesto, por escrito. Una tabla clara de capacidades vale más que una frase general sobre seguridad.', 'What each role sees, in writing. A clear table of capabilities is worth more than a general sentence about security.'],
      ['Quién aprueba. Si quien propone también puede aprobar, la revisión depende de la buena voluntad y no del diseño.', 'Who approves. If whoever proposes can also approve, review depends on goodwill and not on design.'],
      ['Dónde se decide el acceso. Si solo se oculta en la interfaz, la protección es débil; si se decide en el servidor, resiste mejor.', 'Where access is decided. If it is only hidden in the interface, protection is weak; if it is decided on the server, it holds up better.'],
    ),
    p(
      'Para ver cómo se aplica a cada función, puedes revisar la página de {{casos-de-uso|casos de uso}}, que describe qué ve y qué hace cada puesto. Y para saber cuánto fiarte de lo que cada rol lee, vale la pena recordar lo que explicamos sobre {{a2|la procedencia de cada número}}: ver menos no debería significar saber menos sobre el origen de lo que se ve.',
      'To see how it applies to each function, you can review the {{casos-de-uso|use cases}} page, which describes what each role sees and does. And to know how far to trust what each role reads, it is worth recalling what we explained about {{a2|the provenance of every number}}: seeing less should not mean knowing less about the origin of what you do see.',
    ),
    noAfirmamos(
      ['No afirmamos que los permisos mínimos eliminen todo riesgo. Reducen lo que cada cuenta puede exponer, pero no sustituyen otras prácticas de seguridad.', 'We do not claim that minimal permissions eliminate all risk. They reduce what each account can expose, but they do not replace other security practices.'],
      ['No afirmamos qué datos personales de terceros ve el lector, porque esa parte sigue en revisión.', 'We do not state which personal data of third parties the viewer sees, because that part is still under review.'],
      ['No tenemos certificaciones de seguridad ni de cumplimiento, y la verificación en dos pasos para propietarios está en nuestra hoja de ruta; hoy no se exige.', 'We hold no security or compliance certifications, and two-step verification for owners is on our roadmap; today it is not required.'],
    ),
  ],
});

export const ARTICULOS_A: readonly Articulo[] = [ARTICULO_A2, ARTICULO_A3, ARTICULO_A4];
