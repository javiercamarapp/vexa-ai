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

export const ARTICULOS_A: readonly Articulo[] = [ARTICULO_A2];
