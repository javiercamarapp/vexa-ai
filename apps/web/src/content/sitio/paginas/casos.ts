// Casos de uso: el índice por puesto y por situación, y una página por puesto (T11).
// Fuente: landing/posicionamiento/01 sección 6.3, producto/01 (matriz de capacidades) y seo/02-PLAN-POR-URL-DETALLE.md.
// Nada sobre qué datos personales ve el puesto de lectura: el candidato RLS-01 sigue abierto.
import type { Pagina } from '../tipos.ts';
import { b, m } from '../ayudas.ts';
import { LANDING } from '../landing.ts';

const ROTULO = b('Datos de ejemplo. No son de un cliente.', 'Example data. Not from a customer.');

export const CASOS_INDICE: Pagina = {
  id: 'casos-de-uso',
  estado: 'pendiente-de-revision',
  pendiente: 'Revisión de Responsable A de la tarjeta de ventana de 24 horas (condición 9: HubSpot acreditado y cobertura limitada a lo que su API expone).',
  seo: {
    titulo: b('Casos de uso por puesto y por situación | Rovaq AI', 'Use Cases for Every Role and Every Situation | Rovaq AI'),
    descripcion: b(
      'Cada puesto ve solo lo que necesita: el administrador del espacio decide, el analista investiga, el operador ejecuta y el puesto de lectura solo consulta.',
      'Each role sees only what it needs: the workspace administrator decides, the analyst investigates, the operator executes and read-only roles only look.',
    ),
  },
  h1: b('Casos de uso por puesto y por situación', 'Use cases by role and by situation'),
  subtitulo: b(
    'Cada puesto ve lo que le corresponde. Cada situación se resuelve con las mismas cifras y su evidencia.',
    'Each role sees what belongs to it. Each situation is handled with the same figures and their evidence.',
  ),
  bloques: [
    { tipo: 'enlaces', titulo: b('Por puesto', 'By role'), items: LANDING.nav.casos.items },
    {
      tipo: 'tarjetas',
      titulo: LANDING.puestos.lideres.titulo,
      items: [LANDING.puestos.lideres.finanzas, LANDING.puestos.lideres.cx, LANDING.puestos.lideres.cx.salvedad],
    },
    {
      tipo: 'tarjetas',
      titulo: b('Por situación', 'By situation'),
      items: [
        {
          t: b('Reembolsos concentrados', 'Concentrated refunds'),
          d: b(
            'Ve qué canal y qué producto concentran el dinero devuelto en meses completos y descarga el paquete de evidencia. Tú lo revisas y lo presentas.',
            'See which channel and product concentrate returned money in complete months and download the evidence package. You review it and you file it.',
          ),
        },
        {
          t: b('Ventana de 24 horas', 'The 24-hour window'),
          d: m(
            9,
            'Revisión de Responsable A. Solo HubSpot, en solo lectura, con cobertura limitada a lo que su API expone.',
            b(
              'Mira a qué hora llegan las conversaciones de HubSpot y cuántos hilos están en riesgo de pasar de 24 horas sin respuesta de agente.',
              'See when HubSpot conversations arrive and how many threads are at risk of passing 24 hours without an agent reply.',
            ),
            { req: ['responsable_a'] },
          ),
        },
        {
          t: b('Reporte mensual con fuente', 'Monthly report with a source'),
          d: b(
            'Exporta las cifras del periodo con su fuente y su fecha de corte, para que cada número del reporte pueda rastrearse. No arma el reporte por ti.',
            'Export the period figures with their source and cut-off date, so every number in the report can be traced. It does not assemble the report for you.',
          ),
        },
        {
          t: b('Revisión de finanzas', 'Finance review'),
          d: b(
            'Cada cifra dice su moneda, su base y su periodo. Lo que falta aparece como lista de tareas y no como un cero.',
            'Every figure states its currency, basis and period. What is missing appears as a task list and not as a zero.',
          ),
        },
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Los cuatro puestos', 'The four roles'),
      texto: b('Los cuatro puestos existen en el producto. El administrador del espacio da de alta a cada persona y le asigna su puesto.', 'The four roles exist in the product. The workspace administrator adds each person and assigns their role.'),
    },
    {
      tipo: 'texto',
      titulo: b('Permisos decididos en el servidor', 'Permissions enforced on the server'),
      texto: LANDING.puestos.cierre,
    },
  ],
  cta: b('Solicitar acceso e indicar tu puesto', 'Request access and tell us your role'),
  rotulo: ROTULO,
};

function rol(a: Pagina): Pagina {
  return { rotulo: ROTULO, cta: b('Solicitar acceso', 'Request access'), ...a };
}

export const CASO_PROPIETARIO: Pagina = rol({
  id: 'casos-de-uso/propietario',
  estado: 'publicable',
  seo: {
    titulo: b('Administrador del espacio | Configura y aprueba | Rovaq AI', 'Workspace Administrator | Configures and Approves | Rovaq AI'),
    descripcion: b(
      'El administrador del espacio configura la organización, conecta las fuentes y aprueba las acciones. Sus pantallas, decisiones y lo que queda registrado.',
      'The workspace administrator sets up the organization, connects sources and approves actions. Their screens, their decisions and what gets recorded.',
    ),
  },
  h1: b('Administrador del espacio: configura, decide y aprueba', 'Workspace administrator: configure, decide and approve'),
  subtitulo: b('Administra equipo, avisos y retención, y aprueba las acciones. Aprobar corresponde solo a este puesto.', 'Manages team, notices and retention, and approves actions. Approving belongs to this role alone.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Qué configura', 'What they configure'),
      items: [
        b('Invita al equipo por correo con un rol; las invitaciones vencen y no dan acceso hasta aceptarse.', 'Invites the team by email with a role; invitations expire and give no access until accepted.'),
        b('Conecta las fuentes con ayuda de nuestro equipo y autoriza las importaciones.', 'Connects sources with help from our team and authorizes imports.'),
        b('Define la entrega de avisos de la organización y la política de retención y borrado, que primero muestra el alcance exacto y no borra nada hasta confirmarse.', 'Sets the organization notice delivery and the retention and deletion policy, which first shows the exact scope and deletes nothing until confirmed.'),
      ],
    },
    {
      tipo: 'lista',
      titulo: b('Qué decide', 'What they decide'),
      items: [
        b('Aprueba, ajusta o descarta las propuestas de Por decidir.', 'Approves, adjusts or dismisses the proposals in To decide.'),
        b('Confirma los vínculos entre problema y pedido de los que depende la exposición.', 'Confirms the problem-to-order links that exposure depends on.'),
        b('Publica los cortes de pedidos y reembolsos de la organización.', 'Publishes the organization order and refund cutoffs.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Qué queda registrado', 'What is recorded'),
      texto: b(
        'Quedan registradas las operaciones de administración, los cambios de equipo y los borrados por retención. El permiso de administración de plataforma es independiente y no da lectura de los datos de negocio de otras organizaciones.',
        'Administration operations, team changes and retention deletions are recorded. The platform administration permission is separate and does not grant read access to the business data of other organizations.',
      ),
    },
  ],
});

export const CASO_ANALISTA: Pagina = rol({
  id: 'casos-de-uso/analista',
  estado: 'publicable',
  seo: {
    titulo: b('Analista | Investiga, prepara y propone | Rovaq AI', 'Analyst | Investigates, Prepares and Proposes | Rovaq AI'),
    descripcion: b(
      'El analista investiga reembolsos, problemas y puntos de dolor, prepara la evidencia y propone acciones. Conoce el límite entre proponer y aprobar.',
      'The analyst investigates refunds, problems and pain points, prepares evidence and proposes actions. See where proposing ends and approving begins.',
    ),
  },
  h1: b('Analista: investiga, prepara y propone', 'Analyst: investigate, prepare and propose'),
  subtitulo: b('Ve dinero e importa archivos. Propone y no aprueba.', 'Sees money and imports files. Proposes and does not approve.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Qué investiga', 'What they investigate'),
      items: [
        b('Fuga de reembolsos, Problemas, Puntos de dolor, Finanzas y las cifras de dinero de Hoy.', 'Refund leakage, Problems, Pain points, Finance and the money figures in Today.'),
        b('Cualquier cifra, hasta su fuente, con el panel Cómo se calculó.', 'Any figure, down to its source, with the How it was calculated panel.'),
      ],
    },
    {
      tipo: 'lista',
      titulo: b('Qué prepara', 'What they prepare'),
      items: [
        b('Importa archivos de Excel y CSV con vista previa y validación.', 'Imports Excel and CSV files with preview and validation.'),
        b('Arma el paquete de evidencia y exporta informes con las mismas cifras de la pantalla.', 'Builds the evidence package and exports reports with the same figures as the screen.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Dónde termina su rol', 'Where the role ends'),
      texto: b(
        'El analista propone recomendaciones, pero no las aprueba ni ejecuta intervenciones, y tampoco configura conexiones, retención ni equipo. Esas decisiones son del administrador del espacio.',
        'The analyst proposes recommendations but does not approve them or carry out interventions, and does not configure connections, retention or team. Those decisions belong to the workspace administrator.',
      ),
    },
  ],
});

export const CASO_OPERADOR: Pagina = rol({
  id: 'casos-de-uso/operador',
  estado: 'publicable',
  seo: {
    titulo: b('Operador | Ejecuta las acciones que le asignan | Rovaq AI', 'Operator | Carries Out the Actions Assigned | Rovaq AI'),
    descripcion: b(
      'El operador recibe las acciones que le asignan y registra su resultado. Ve acciones y evidencia, no cifras de dinero, y deja constancia de lo que hizo.',
      'The operator receives assigned actions and records the result. They see actions and evidence, not money figures, and leave a record of what was done.',
    ),
  },
  h1: b('Operador: ejecuta las acciones que le asignan', 'Operator: carries out the actions assigned to you'),
  subtitulo: b('Ve problemas y acciones, sin cifras de dinero.', 'Sees problems and actions, without money figures.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Qué recibe', 'What they receive'),
      items: [
        b('Las intervenciones que le asignan, con sus etapas y los borradores listos para revisar.', 'The interventions assigned to them, with their stages and the drafts ready to review.'),
        b('Las recomendaciones por decidir y los problemas abiertos, ordenados por número de conversaciones.', 'The recommendations to decide and the open problems, ordered by number of conversations.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Qué ve y qué no ve', 'What they see and do not see'),
      texto: b(
        'Ve problemas, acciones asignadas y evidencia. No ve cifras de dinero ni puede importar archivos. En Pregúntale a tus datos recibe totales y no clientes concretos.',
        'Sees problems, assigned actions and evidence. Does not see money figures and cannot import files. In Ask your data it receives totals and not specific customers.',
      ),
    },
    {
      tipo: 'texto',
      titulo: b('Cómo registra el resultado', 'How they record the result'),
      texto: b(
        'Mueve las etapas de la intervención, revisa y envía los borradores, y deja registrado el resultado. Proponer también está dentro de su puesto; aprobar, no.',
        'Moves the intervention stages, reviews and sends the drafts, and records the outcome. Proposing is also within the role; approving is not.',
      ),
    },
  ],
});

export const CASO_LECTOR: Pagina = rol({
  id: 'casos-de-uso/lector',
  estado: 'publicable',
  seo: {
    titulo: b('Lectura | Consulta sin riesgo de cambiar nada | Rovaq AI', 'Read-only | Look Without Risk of Changing Data | Rovaq AI'),
    descripcion: b(
      'El puesto de lectura consulta las pantallas que le corresponden sin poder modificar datos, conexiones ni decisiones. Útil para dirección y finanzas.',
      'The read-only role reads the screens that apply to it and cannot modify data, connections or decisions. Useful for leadership and finance teams.',
    ),
  },
  h1: b('Lectura: consulta sin riesgo de cambiar nada', 'Read-only: read without any risk of changing anything'),
  subtitulo: b('Consulta en solo lectura.', 'View access only.'),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Qué puede consultar', 'What they can read'),
      items: [
        b('Las pantallas que le corresponden: Hoy, Problemas con su evidencia, Confianza de los datos y las acciones.', 'The screens that apply to them: Today, Problems with their evidence, Data trust and the actions.'),
        b('Puede exportar descargas de lo que ve.', 'Can export downloads of what they see.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Qué no puede hacer', 'What they cannot do'),
      texto: b(
        'No puede modificar datos, conexiones ni decisiones, y no ve cifras de dinero. La autorización se decide en el servidor: ocultar un elemento del menú no protege una pantalla.',
        'Cannot modify data, connections or decisions, and does not see money figures. Authorization is decided on the server: hiding a menu item does not protect a screen.',
      ),
    },
    {
      tipo: 'texto',
      titulo: b('Para quién es', 'Who it is for'),
      texto: b('Dirección, finanzas y equipos que necesitan leer las cifras con su evidencia sin tocar nada.', 'Leadership, finance and teams that need to read the figures with their evidence without touching anything.'),
    },
  ],
});

export const PAGINAS_CASOS: readonly Pagina[] = [CASOS_INDICE, CASO_PROPIETARIO, CASO_ANALISTA, CASO_OPERADOR, CASO_LECTOR];
