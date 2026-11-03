// Aviso de privacidad y Términos de Rovaq (ola 3, legal). Fuente única de los dos textos; docs/legal/*.md se generan con tools/sitio/exportar-legal.mjs.
// Describe solo lo que el código hace hoy; el inventario de proveedores con su evidencia está en docs/legal/INVENTARIO-PROVEEDORES.md.
// Los únicos datos que no están en el repositorio son la razón social, el domicilio y el correo de privacidad. Llegan por VEXA_LEGAL_ENTIDAD,
// VEXA_LEGAL_DOMICILIO y VEXA_LEGAL_CORREO (lib/sitio/marcadores.mjs). Mientras falte cualquiera, un marcador queda sin resolver, la hoja no es
// publicable y estadoPagina deja la página entera sin publicar: no se sirve, no se enlaza en el pie, no entra al sitemap ni a los espejos.
// Regla editorial del sitio: sin paréntesis, sin signos de exclamación, sin emojis.
import type { Nodo, Pagina } from '../tipos.ts';
import { b } from '../ayudas.ts';

const texto = (es: string, en: string, tES: string, tEN: string): Nodo => ({ tipo: 'texto', titulo: b(tES, tEN), texto: b(es, en) });
const lista = (tES: string, tEN: string, items: readonly (readonly [string, string])[]): Nodo => ({ tipo: 'lista', titulo: b(tES, tEN), items: items.map(([es, en]) => b(es, en)) });

// ------------------------------------------------------------------ Aviso de privacidad

export const AVISO_DE_PRIVACIDAD: Pagina = {
  id: 'aviso-de-privacidad',
  estado: 'publicable',
  seo: {
    titulo: b('Aviso de privacidad de Rovaq AI | Datos personales y ARCO', 'Privacy Notice | Rovaq AI Personal Data and ARCO Rights'),
    descripcion: b(
      'Quién es responsable de tus datos, qué datos trata Rovaq, con qué proveedores, por cuánto tiempo se conservan y cómo ejercer tus derechos ARCO.',
      'Who is responsible for your data, what data Rovaq processes, with which providers, for how long it is kept and how to exercise your ARCO rights.',
    ),
  },
  h1: b('Aviso de privacidad', 'Privacy notice'),
  subtitulo: b('Versión del 3 de noviembre de 2026. Describe lo que el producto hace hoy.', 'Version of November 3, 2026. It describes what the product does today.'),
  bloques: [
    {
      tipo: 'texto',
      titulo: b('1. Quién es el responsable', '1. Who is the controller'),
      texto: b(
        'Rovaq AI es un servicio de software para empresas, operado por [RAZON_SOCIAL], con domicilio en [DOMICILIO], en adelante Rovaq. Este aviso se emite conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.',
        'Rovaq AI is a software service for businesses, operated by [LEGAL_NAME], located at [ADDRESS], hereinafter Rovaq. This notice is issued under the Mexican Federal Law on the Protection of Personal Data Held by Private Parties.',
      ),
    },
    texto(
      'Rovaq actúa con dos papeles distintos. Es responsable de los datos de las personas que usan el portal. Es encargado de los datos de los compradores y de las operaciones de una empresa usuaria, que ella carga o conecta: frente a esas personas, el responsable es la empresa usuaria y Rovaq los trata solo por cuenta y según las instrucciones de ella.',
      'Rovaq acts in two different roles. It is the controller of the data of the people who use the portal. It is the processor of the data about the buyers and operations of a customer company that the company loads or connects: toward those individuals the controller is the customer company, and Rovaq processes that data only on its behalf and following its instructions.',
      'Dos papeles', 'Two roles',
    ),
    lista('2. Datos de las personas que usan el portal, como responsable', '2. Data of portal users, as controller', [
      ['Correo electrónico de acceso. La entrada es por un enlace enviado al correo, con confirmación del correo. También puede ofrecerse el inicio de sesión con Google; en ese caso Google entrega el correo y los datos básicos de la cuenta.', 'Sign-in email. Access is by a link sent to the email address, with email confirmation. Sign-in with Google may also be offered; in that case Google provides the email and basic account data.'],
      ['Datos de equipo. A qué organización pertenece cada persona, con qué rol, invitaciones pendientes y el registro de altas, cambios de rol y revocaciones.', 'Team data. Which organization each person belongs to, with which role, pending invitations and the record of additions, role changes and revocations.'],
      ['Registros de seguridad. Tipo de evento, ruta, método, agente de usuario y una huella irreversible de la dirección IP, no la dirección en claro. Los contadores de límite de acceso guardan solo huellas del correo y de la IP durante una hora.', 'Security records. Event type, path, method, user agent and an irreversible fingerprint of the IP address, not the address itself. Access rate counters keep only fingerprints of the email and the IP for one hour.'],
      ['Notificaciones. Si la persona las activa: la dirección de correo de destino, el estado de entrega, y para avisos del navegador la suscripción del dispositivo. Ante una queja o un rebote permanente se guarda una supresión por huella del buzón para no volver a escribir.', 'Notifications. If the person turns them on: the destination email address, the delivery status, and for browser alerts the device subscription. After a complaint or a permanent bounce, a suppression by mailbox fingerprint is kept so we do not write again.'],
      ['Preferencia de idioma y datos técnicos mínimos de la sesión.', 'Language preference and minimal technical session data.'],
      ['Los mensajes que nos escribes al correo de contacto, con el contenido que decidas enviar.', 'The messages you write to our contact email, with the content you decide to send.'],
    ]),
    lista('3. Datos de la empresa usuaria, como encargado', '3. Customer company data, as processor', [
      ['Conversaciones de soporte: mensajes, canal, fechas, autoría y los datos de contacto que el texto contenga, como nombre, correo o teléfono de un comprador.', 'Support conversations: messages, channel, dates, authorship and any contact details the text contains, such as a buyer name, email or phone number.'],
      ['Pedidos y reembolsos: identificadores, productos, importes, fechas y estados, cargados desde exportes de marketplaces con ayuda de nuestro equipo.', 'Orders and refunds: identifiers, products, amounts, dates and statuses, loaded from marketplace exports with the help of our team.'],
      ['Datos leídos de la herramienta de soporte que la empresa conecte, hoy HubSpot, con permisos de solo lectura: conversaciones, mensajes, notas y datos básicos de tickets. Rovaq no escribe en esa herramienta.', 'Data read from the support tool the company connects, today HubSpot, with read-only permissions: conversations, messages, notes and basic ticket data. Rovaq does not write to that tool.'],
      ['Archivos adjuntos y exportes que la empresa entregue para su carga.', 'Attachments and exports that the company hands over for loading.'],
    ]),
    texto(
      'El producto no está diseñado para tratar datos personales sensibles ni de menores. Si el texto de una conversación los contuviera, forman parte de lo que la empresa usuaria decidió cargar, y es ella quien responde por ello frente a sus compradores. Para el análisis, cada conversación se guarda con una versión redactada, separada de la original. Redactar no es anonimizar y no decimos que los datos estén anonimizados.',
      'The product is not designed to process sensitive personal data or data about minors. If the text of a conversation contained them, they form part of what the customer company decided to load, and the company answers for it toward its buyers. For analysis, each conversation is stored with a redacted version, separate from the original. Redacting is not anonymizing, and we do not say that the data is anonymized.',
      'Datos sensibles y redacción', 'Sensitive data and redaction',
    ),
    lista('4. Para qué usamos los datos', '4. What we use the data for', [
      ['Como responsable: dar acceso al portal, autenticar a la persona y aplicar los permisos de su rol.', 'As controller: give access to the portal, authenticate the person and apply the permissions of their role.'],
      ['Como responsable: operar y proteger el servicio, con registros de seguridad, límites de uso y prevención de abuso.', 'As controller: operate and protect the service, with security records, usage limits and abuse prevention.'],
      ['Como responsable: enviar las notificaciones y el reporte semanal que la persona tenga activos y atender sus bajas.', 'As controller: send the notifications and the weekly report that the person has turned on and handle unsubscribes.'],
      ['Como responsable: responder solicitudes de acceso, soporte y contacto, y cumplir obligaciones legales.', 'As controller: answer access, support and contact requests, and meet legal obligations.'],
      ['Como encargado, solo para prestar el servicio a la empresa usuaria y según sus instrucciones: ordenar y analizar conversaciones, pedidos y reembolsos, agrupar problemas, mostrar cifras con su origen y proponer acciones que una persona de la empresa decide.', 'As processor, only to provide the service to the customer company and following its instructions: organize and analyze conversations, orders and refunds, group problems, show figures with their origin and propose actions that a person at the company decides.'],
      ['No hay finalidades secundarias. No vendemos datos personales ni los usamos para fines distintos de prestar el servicio.', 'There are no secondary purposes. We do not sell personal data or use it for purposes other than providing the service.'],
    ]),
    lista('5. Inteligencia artificial', '5. Artificial intelligence', [
      ['Las conversaciones se clasifican y se agrupan con modelos de lenguaje solo cuando la empresa usuaria lo habilita para su organización, en lotes y con límite de gasto. La IA clasifica y redacta propuestas. No calcula importes, no envía nada y no ejecuta acciones: una persona de la empresa decide cada una.', 'Conversations are classified and grouped with language models only when the customer company enables it for its organization, in batches and with a spending limit. The AI classifies and drafts proposals. It does not calculate amounts, does not send anything and does not execute actions: a person at the company decides each one.'],
      ['Al modelo se envía la versión redactada del texto, en la que se sustituyen correos, teléfonos y los nombres que la política de la organización configure. La redacción cubre esos patrones y esos nombres, no reconoce cualquier dato personal; por eso puede quedar información identificable en el texto enviado.', 'What is sent to the model is the redacted version of the text, in which emails, phone numbers and the names that the organization policy configures are replaced. Redaction covers those patterns and those names; it does not recognize every kind of personal data, so identifiable information may remain in the text sent.'],
      ['Los modelos se consultan por un intermediario de modelos. Cada solicitud indica que el proveedor no debe recolectar los datos y no permite pasar a otro proveedor. El tratamiento puede ocurrir en Estados Unidos o en la Unión Europea, según la configuración de la organización. Los resultados llevan la cita del texto de origen para que una persona los revise.', 'Models are queried through a model intermediary. Each request states that the provider must not collect the data and does not allow falling back to another provider. Processing may take place in the United States or in the European Union, depending on the organization configuration. Results carry a quote from the source text so that a person can review them.'],
      ['La función Pregúntale al agente general responde con reglas y no usa un modelo de lenguaje.', 'The Ask feature of the general agent answers with rules and does not use a language model.'],
    ]),
    lista('6. Proveedores que reciben datos y transferencias', '6. Providers that receive data and transfers', [
      ['Supabase: base de datos, autenticación y almacenamiento de archivos. Recibe todos los datos del producto. La infraestructura puede estar fuera de México.', 'Supabase: database, authentication and file storage. It receives all product data. The infrastructure may be outside Mexico.'],
      ['Vercel: alojamiento de la aplicación y del sitio. Recibe los datos en tránsito y registros técnicos que pueden incluir la dirección IP. Opera principalmente en Estados Unidos.', 'Vercel: hosting of the application and the site. It receives data in transit and technical logs that may include the IP address. It operates mainly in the United States.'],
      ['Resend: correo transaccional y recibos de entrega. Recibe la dirección de destino y el contenido del aviso o del reporte, cuando esas funciones están activas. Puede estar fuera de México.', 'Resend: transactional email and delivery receipts. It receives the destination address and the content of the alert or report, when those features are active. It may be outside Mexico.'],
      ['Proveedores de modelos de lenguaje, por medio de OpenRouter: reciben el texto redactado descrito en la sección 5, solo si la empresa usuaria habilita la función.', 'Language model providers, through OpenRouter: they receive the redacted text described in section 5, only if the customer company enables the feature.'],
      ['Google: solo si se ofrece el inicio de sesión con Google. Recibe la solicitud de autenticación de la persona.', 'Google: only if sign-in with Google is offered. It receives the authentication request of the person.'],
      ['El servicio de notificaciones del navegador, solo si la persona activa los avisos del navegador. Recibe la suscripción del dispositivo.', 'The browser notification service, only if the person turns on browser alerts. It receives the device subscription.'],
      ['La herramienta de soporte de la empresa usuaria, hoy HubSpot, es el origen de los datos que la empresa conecta. Rovaq solo lee de ella.', 'The support tool of the customer company, today HubSpot, is the source of the data the company connects. Rovaq only reads from it.'],
      ['Estos proveedores tratan los datos por cuenta de Rovaq, como encargados, y no para fines propios. No usamos analítica, publicidad ni etiquetas de terceros en el sitio ni en el portal. Fuera de lo anterior solo comunicamos datos a una autoridad cuando una ley o una orden válida lo exija.', 'These providers process data on behalf of Rovaq, as processors, and not for their own purposes. We do not use analytics, advertising or third party tags on the site or in the portal. Beyond the above, we only disclose data to an authority when a law or a valid order requires it.'],
    ]),
    lista('7. Cuánto tiempo conservamos los datos y cómo se eliminan', '7. How long we keep data and how it is deleted', [
      ['Datos de la empresa usuaria. Se conservan mientras dure la relación. La empresa decide qué conservar: el Administrador del espacio dispone de una pantalla de retención que muestra el alcance exacto antes de borrar y no borra nada hasta que se confirma. El borrado alcanza los mensajes, las conversaciones, sus versiones, vectores, trabajos, problemas, archivos y adjuntos asociados, y deja un registro de lo borrado. No elimina el origen en la herramienta de la empresa ni las copias que ella mantenga.', 'Customer company data. It is kept while the relationship lasts. The company decides what to keep: the workspace administrator has a retention screen that shows the exact scope before deleting and deletes nothing until confirmed. Deletion covers the associated messages, conversations, their versions, vectors, jobs, problems, files and attachments, and leaves a record of what was deleted. It does not delete the source in the company tool or the copies the company keeps.'],
      ['Al terminar la relación. Durante 30 días ponemos a disposición de la empresa un exporte de sus datos. Eliminamos sus datos de los sistemas activos dentro de los 60 días siguientes a la terminación, o antes si la empresa lo pide por escrito. Conservamos, si la ley lo exige, solo lo que ella ordene.', 'When the relationship ends. For 30 days we make an export of its data available to the company. We delete its data from the active systems within 60 days after termination, or earlier if the company asks in writing. We keep only what the law requires.'],
      ['Copias de respaldo. El proveedor de base de datos hace respaldos diarios. Los datos eliminados pueden permanecer en ellos hasta que se sobrescriban, en un ciclo que no excede 35 días. No hay recuperación a un punto en el tiempo.', 'Backups. The database provider makes daily backups. Deleted data may remain in them until they are overwritten, in a cycle that does not exceed 35 days. There is no point-in-time recovery.'],
      ['Registros de seguridad. Se eliminan cuando pasan 180 días, y nunca antes de 30.', 'Security records. They are deleted after 180 days, and never before 30.'],
      ['Datos de la persona usuaria. La cuenta, el equipo y las notificaciones se conservan mientras la cuenta esté activa. Tras la baja, los suprimimos o los bloqueamos dentro de los 90 días siguientes. El registro de cambios de equipo y de operaciones de administración puede conservarse más tiempo por razones de seguridad y de obligaciones legales.', 'User data. The account, the team and the notifications are kept while the account is active. After deactivation, we delete or block them within the following 90 days. The record of team changes and administration operations may be kept longer for security reasons and legal obligations.'],
    ]),
    lista('8. Derechos ARCO y cómo ejercerlos', '8. ARCO rights and how to exercise them', [
      ['Toda persona titular puede ejercer sus derechos de acceso, rectificación, cancelación y oposición, y revocar su consentimiento cuando proceda, conforme a la ley mexicana aplicable.', 'Every data subject may exercise their rights of access, rectification, cancellation and objection, and withdraw consent where applicable, under the applicable Mexican law.'],
      ['Si tus datos son de una persona usuaria del portal, Rovaq es responsable: escribe a [CORREO_DE_PRIVACIDAD] con tu nombre, el correo con el que accedes, el derecho que ejerces y una identificación que permita acreditar tu identidad. Responderemos dentro de los plazos que fija la ley.', 'If your data is that of a portal user, Rovaq is the controller: write to [PRIVACY_EMAIL] with your name, the email you sign in with, the right you exercise and an identification that allows us to verify your identity. We will answer within the deadlines set by law.'],
      ['Si tus datos están en conversaciones, pedidos o reembolsos de una empresa que usa Rovaq, dirige tu solicitud a esa empresa, que es la responsable. Si nos la envías a nosotros, se la remitiremos y la apoyaremos con las herramientas del producto: búsqueda por entidad, vista previa del alcance, borrado confirmado y exporte, que opera el Administrador del espacio de la empresa.', 'If your data is in conversations, orders or refunds of a company that uses Rovaq, send your request to that company, which is the controller. If you send it to us, we will forward it and support the company with the product tools: search by entity, scope preview, confirmed deletion and export, operated by the company workspace administrator.'],
      ['Si consideras que tu derecho no fue atendido, puedes acudir a la autoridad competente en materia de protección de datos personales.', 'If you consider that your right was not addressed, you may turn to the competent personal data protection authority.'],
    ]),
    lista('9. Medidas de seguridad', '9. Security measures', [
      ['Cada organización queda separada de las demás por reglas de la base de datos, no solo por la aplicación. Hay cuatro roles con permisos distintos: Administrador del espacio, Analista, Operador y Lectura.', 'Each organization is kept separate from the others by database rules, not only by the application. There are four roles with different permissions: workspace administrator, analyst, operator and read-only.'],
      ['La conexión es cifrada con HTTPS y el sitio y la aplicación envían cabeceras de seguridad. Las sesiones usan cookies protegidas.', 'The connection is encrypted with HTTPS and the site and the application send security headers. Sessions use protected cookies.'],
      ['El acceso del personal de Rovaq a los datos de una organización se limita a personal autorizado sujeto a confidencialidad. Puede darse por una sesión de soporte de solo lectura, con motivo declarado, duración máxima de 60 minutos y registro, y por tareas de carga y mantenimiento que la empresa solicita.', 'Access by Rovaq staff to the data of an organization is limited to authorized personnel bound by confidentiality. It may take place through a read-only support session, with a stated reason, a maximum duration of 60 minutes and a record, and through loading and maintenance tasks that the company requests.'],
      ['Quedan registradas las operaciones de administración, los cambios de equipo y los borrados por retención. El registro no incluye las lecturas de datos.', 'Administration operations, team changes and retention deletions are recorded. The record does not include data reads.'],
      ['No hay certificaciones de seguridad, no se ha hecho una prueba de penetración externa y la verificación en dos pasos no es obligatoria para las personas usuarias de las empresas. Ninguna medida garantiza seguridad total. Más detalle en la página de Seguridad y privacidad.', 'There are no security certifications, no external penetration test has been performed and two-step verification is not mandatory for the users of customer companies. No measure guarantees total security. More detail on the Security and privacy page.'],
    ]),
    texto(
      'Usamos cookies de sesión necesarias para entrar al portal, una cookie de organización activa y una cookie de preferencia de idioma llamada rovaq_lang, que dura un año. Si se activan los avisos del navegador, se guarda un identificador del dispositivo. No usamos cookies de publicidad ni de analítica.',
      'We use session cookies needed to sign in to the portal, an active organization cookie and a language preference cookie called rovaq_lang, which lasts one year. If browser alerts are turned on, a device identifier is stored. We do not use advertising or analytics cookies.',
      '10. Cookies', '10. Cookies',
    ),
    texto(
      'El servicio es para empresas y no se dirige a menores de edad.',
      'The service is for businesses and is not directed at minors.',
      '11. Menores', '11. Minors',
    ),
    texto(
      'Publicaremos los cambios en esta página con su fecha. Si el cambio es sustancial, lo avisaremos por correo a las personas usuarias del portal con al menos 30 días de antelación.',
      'We will publish changes on this page with their date. If a change is substantial, we will notify portal users by email at least 30 days in advance.',
      '12. Cambios a este aviso', '12. Changes to this notice',
    ),
    lista('13. Contacto', '13. Contact', [
      ['Responsable: [RAZON_SOCIAL]. Domicilio: [DOMICILIO]. Correo de privacidad y de solicitudes ARCO: [CORREO_DE_PRIVACIDAD].', 'Controller: [LEGAL_NAME]. Address: [ADDRESS]. Privacy and ARCO requests email: [PRIVACY_EMAIL].'],
    ]),
  ],
};

// ------------------------------------------------------------------ Términos

export const TERMINOS: Pagina = {
  id: 'terminos',
  estado: 'publicable',
  seo: {
    titulo: b('Términos de uso de Rovaq AI | Cuentas, datos y riesgos', 'Terms of Use | Rovaq AI Accounts, Data and Liability'),
    descripcion: b(
      'Condiciones de uso de Rovaq AI para empresas: cuentas, datos del cliente, inteligencia artificial, disponibilidad, responsabilidad y terminación.',
      'Terms of use of Rovaq AI for businesses: accounts, customer data, artificial intelligence, availability, liability and termination of the service.',
    ),
  },
  h1: b('Términos de uso', 'Terms of use'),
  subtitulo: b('Versión del 3 de noviembre de 2026. Rigen el uso de Rovaq AI por empresas.', 'Version of November 3, 2026. They govern the use of Rovaq AI by businesses.'),
  bloques: [
    texto(
      'Estos términos regulan el uso de Rovaq AI, operado por [RAZON_SOCIAL], con domicilio en [DOMICILIO], en adelante Rovaq, por una empresa u organización, en adelante el Cliente, y por las personas que esta autorice, en adelante Personas usuarias. El servicio es para uso empresarial. Quien acepta en nombre del Cliente declara tener facultades para ello. Si Rovaq y el Cliente firman un contrato por escrito, ese contrato prevalece sobre estos términos en lo que los contradiga.',
      'These terms govern the use of Rovaq AI, operated by [LEGAL_NAME], located at [ADDRESS], hereinafter Rovaq, by a company or organization, hereinafter the Customer, and by the people it authorizes, hereinafter Users. The service is for business use. Whoever accepts on behalf of the Customer states that they have authority to do so. If Rovaq and the Customer sign a written contract, that contract prevails over these terms where it contradicts them.',
      '1. Quiénes somos y a quién aplican', '1. Who we are and who these terms apply to',
    ),
    lista('2. El servicio', '2. The service', [
      ['Rovaq AI es inteligencia de ingresos para negocios que venden por marketplaces: ordena las conversaciones de soporte, los pedidos y los reembolsos que el Cliente carga o conecta, detecta fugas de ingreso, agrupa problemas, muestra cifras con su origen y propone acciones que una persona del Cliente decide.', 'Rovaq AI is revenue intelligence for businesses that sell on marketplaces: it organizes the support conversations, orders and refunds that the Customer loads or connects, detects revenue leaks, groups problems, shows figures with their origin and proposes actions that a person at the Customer decides.'],
      ['Los datos de marketplaces entran por exportes que se cargan con ayuda de nuestro equipo. Las conexiones directas a herramientas de soporte piden permisos de lectura y cubren solo lo que la herramienta expone.', 'Marketplace data comes in through exports loaded with the help of our team. Direct connections to support tools ask for read permissions and cover only what the tool exposes.'],
      ['El servicio se ofrece en el estado de desarrollo descrito en el sitio y puede cambiar. Lo que figura en la hoja de ruta no es una promesa de entrega.', 'The service is offered in the state of development described on the site and may change. What appears on the roadmap is not a promise of delivery.'],
    ]),
    lista('3. Cuentas y roles', '3. Accounts and roles', [
      ['La entrada es por un enlace enviado al correo de la Persona usuaria, con confirmación del correo, o por inicio de sesión con Google cuando se ofrezca. El Cliente responde de quién tiene acceso, de mantener su equipo al día y de revocar accesos.', 'Access is by a link sent to the email of the User, with email confirmation, or by sign-in with Google when offered. The Customer is responsible for who has access, for keeping its team up to date and for revoking access.'],
      ['Cada Persona usuaria tiene uno de cuatro roles: Administrador del espacio, que configura, aprueba propuestas y administra el equipo y la retención de datos; Analista, que lee, ve importes y carga datos; Operador, que lee y ejecuta acciones aprobadas sin ver importes; y Lectura, que ve las pantallas que su rol permite.', 'Each User has one of four roles: workspace administrator, who configures, approves proposals and manages the team and data retention; analyst, who reads, sees amounts and loads data; operator, who reads and carries out approved actions without seeing amounts; and read-only, who sees the screens that the role allows.'],
      ['No se deben compartir credenciales ni enlaces de acceso. El Cliente responde por la actividad realizada con sus cuentas.', 'Credentials and access links must not be shared. The Customer is responsible for the activity carried out with its accounts.'],
      ['Personal autorizado de Rovaq puede abrir una sesión de soporte de solo lectura, con motivo declarado, duración máxima de 60 minutos y registro, para atender solicitudes del Cliente.', 'Authorized Rovaq staff may open a read-only support session, with a stated reason, a maximum duration of 60 minutes and a record, to attend to Customer requests.'],
    ]),
    texto(
      'El Cliente y sus Personas usuarias no deben cargar datos que no tengan derecho a tratar o sin los avisos y bases legales que la ley exija frente a sus propios compradores; intentar acceder a datos de otras organizaciones, eludir permisos o límites de uso, o sondear la seguridad sin autorización escrita; usar el servicio para fines ilícitos o para enviar comunicaciones no solicitadas; copiar, revertir o revender el servicio; sobrecargarlo de forma que afecte a otros Clientes; ni cargar datos sensibles o de menores sin acuerdo previo con Rovaq. Para reportar una vulnerabilidad de buena fe, escribe a [CORREO_DE_PRIVACIDAD] sin incluir datos reales de clientes ni credenciales.',
      'The Customer and its Users must not load data that they have no right to process or without the notices and legal bases that the law requires toward their own buyers; try to access data of other organizations, bypass permissions or usage limits, or probe security without written authorization; use the service for unlawful purposes or to send unsolicited communications; copy, reverse or resell the service; overload it in a way that affects other Customers; or load sensitive data or data about minors without a prior agreement with Rovaq. To report a vulnerability in good faith, write to [PRIVACY_EMAIL] without including real customer data or credentials.',
      '4. Uso aceptable', '4. Acceptable use',
    ),
    lista('5. Datos del Cliente y propiedad', '5. Customer data and ownership', [
      ['Los datos que el Cliente carga o conecta, y los resultados que el servicio produce a partir de ellos para el Cliente, siguen siendo del Cliente. Rovaq los trata solo para prestar el servicio, conforme al Aviso de privacidad. Sobre esos datos Rovaq actúa como encargado y el Cliente como responsable.', 'The data the Customer loads or connects, and the results the service produces from it for the Customer, remain the Customer property. Rovaq processes them only to provide the service, under the Privacy notice. For that data Rovaq acts as processor and the Customer as controller.'],
      ['El Cliente responde frente a sus compradores de los avisos y consentimientos que correspondan por los datos que carga.', 'The Customer is responsible toward its buyers for the notices and consents that apply to the data it loads.'],
      ['Rovaq conserva sus derechos sobre el software, la documentación, la marca y las mejoras generales del servicio que no contengan datos del Cliente.', 'Rovaq keeps its rights over the software, the documentation, the brand and the general improvements to the service that contain no Customer data.'],
      ['La retención y la eliminación de datos son las que describe el Aviso de privacidad, incluidos el exporte durante 30 días y la eliminación dentro de los 60 días siguientes a la terminación. El borrado no elimina el origen en la herramienta del Cliente ni las copias que este mantenga.', 'Data retention and deletion are as described in the Privacy notice, including the export for 30 days and deletion within 60 days after termination. Deletion does not remove the source in the Customer tool or the copies the Customer keeps.'],
    ]),
    texto(
      'Cada parte protegerá la información confidencial de la otra con el mismo cuidado que usa para la propia y no menor que uno razonable, la usará solo para los fines del servicio y no la revelará salvo a quienes necesiten conocerla y estén obligados a reservarla, o cuando una autoridad lo exija. No es confidencial lo que sea público sin culpa de la parte receptora, lo ya conocido por ella o lo desarrollado de forma independiente. Esta obligación dura mientras dure la relación y 3 años después.',
      'Each party will protect the confidential information of the other with the same care it uses for its own and no less than reasonable care, will use it only for the purposes of the service and will not disclose it except to those who need to know it and are bound to keep it confidential, or when an authority requires it. Information is not confidential if it is public through no fault of the receiving party, was already known to it or was developed independently. This obligation lasts for the relationship and 3 years after.',
      '6. Confidencialidad', '6. Confidentiality',
    ),
    lista('7. Inteligencia artificial y cifras', '7. Artificial intelligence and figures', [
      ['Cuando la IA interviene, clasifica y redacta. No produce importes y una persona decide cada acción: nada se envía ni se ejecuta solo.', 'When AI is involved, it classifies and drafts. It does not produce amounts and a person decides each action: nothing is sent or executed on its own.'],
      ['Las clasificaciones, agrupaciones y borradores generados con IA pueden contener errores y deben revisarse antes de actuar.', 'Classifications, groupings and drafts generated with AI may contain errors and must be reviewed before acting.'],
      ['Las cifras se muestran con su origen y su fecha de corte. Lo que no se sabe se muestra como Sin dato y no como cero. Las estimaciones y las cifras inferidas, por ejemplo el efecto económico de un problema calculado con datos incompletos, no son hechos contables ni están auditadas, dependen de la calidad y la cobertura de los datos que el Cliente cargó y no sustituyen su criterio contable, legal o comercial.', 'Figures are shown with their origin and cut-off date. What is not known is shown as No data and not as zero. Estimates and inferred figures, for example the economic effect of a problem calculated with incomplete data, are not accounting facts and have not been audited, depend on the quality and coverage of the data the Customer loaded and do not replace its accounting, legal or commercial judgment.'],
      ['El Cliente decide si usa las propuestas y asume las consecuencias de sus decisiones.', 'The Customer decides whether to use the proposals and bears the consequences of its decisions.'],
    ]),
    texto(
      'El servicio se ofrece sin compromiso de disponibilidad. Puede haber interrupciones por mantenimiento o por fallas de proveedores. Hay respaldos diarios del proveedor de base de datos, sin recuperación a un punto en el tiempo. Cualquier compromiso de soporte o de tiempos de respuesta debe pactarse por escrito.',
      'The service is offered without an availability commitment. There may be interruptions due to maintenance or provider failures. There are daily backups from the database provider, without point-in-time recovery. Any support or response time commitment must be agreed in writing.',
      '8. Disponibilidad', '8. Availability',
    ),
    texto(
      'Rovaq aplica las medidas descritas en la página de Seguridad y privacidad y en el Aviso de privacidad, que también indican lo que todavía no existe. Ninguna medida garantiza seguridad total. Si ocurre una vulneración que afecte datos personales del Cliente, Rovaq se lo avisará sin demora injustificada y a más tardar 72 horas después de confirmarla.',
      'Rovaq applies the measures described on the Security and privacy page and in the Privacy notice, which also state what does not yet exist. No measure guarantees total security. If a breach affecting personal data of the Customer occurs, Rovaq will notify the Customer without undue delay and at the latest 72 hours after confirming it.',
      '9. Seguridad', '9. Security',
    ),
    texto(
      'El servicio se proporciona tal cual y según disponibilidad. En la medida permitida por la ley, Rovaq no da garantías de ningún tipo, expresas o implícitas, incluidas las de comerciabilidad, idoneidad para un fin particular, ausencia de errores, exactitud de las cifras estimadas o inferidas, ni que el uso del servicio produzca un resultado económico determinado.',
      'The service is provided as is and as available. To the extent permitted by law, Rovaq gives no warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, absence of errors, accuracy of estimated or inferred figures, or that use of the service will produce a particular economic result.',
      '10. Garantías excluidas', '10. Warranties excluded',
    ),
    texto(
      'En la medida permitida por la ley, la responsabilidad total de Rovaq frente al Cliente por cualquier reclamación relacionada con el servicio se limita a lo que el Cliente haya pagado a Rovaq en los 12 meses previos al hecho. Rovaq no responde por daños indirectos, lucro cesante, pérdida de datos que el Cliente conserve en su origen ni daños derivados de decisiones tomadas con base en cifras estimadas o inferidas. Esta limitación no excluye lo que la ley no permita excluir, en particular el dolo ni la negligencia grave.',
      'To the extent permitted by law, the total liability of Rovaq toward the Customer for any claim related to the service is limited to what the Customer has paid Rovaq in the 12 months before the event. Rovaq is not liable for indirect damages, lost profits, loss of data the Customer keeps at its source or damages arising from decisions made on the basis of estimated or inferred figures. This limitation does not exclude what the law does not allow to be excluded, in particular willful misconduct and gross negligence.',
      '11. Limitación de responsabilidad', '11. Limitation of liability',
    ),
    lista('12. Suspensión y terminación', '12. Suspension and termination', [
      ['Rovaq puede suspender el acceso de una cuenta u organización si hay un riesgo de seguridad, un uso que incumple estos términos o la ley, o una orden de autoridad, avisando cuando sea posible y dando 10 días para subsanar cuando la causa lo permita.', 'Rovaq may suspend the access of an account or organization if there is a security risk, a use that breaches these terms or the law, or an order from an authority, giving notice when possible and allowing 10 days to cure when the cause permits.'],
      ['El Cliente puede terminar el uso en cualquier momento, avisando por escrito a [CORREO_DE_PRIVACIDAD]. Rovaq puede terminarlo con aviso de 30 días. Duración, renovación y pago se pactan por escrito aparte.', 'The Customer may stop using the service at any time, giving written notice to [PRIVACY_EMAIL]. Rovaq may end it with 30 days notice. Duration, renewal and payment are agreed in writing separately.'],
      ['Al terminar, el acceso se cierra y los datos del Cliente se tratan como describe el Aviso de privacidad: exporte durante 30 días y eliminación dentro de los 60 días siguientes. Subsisten las cláusulas que por su naturaleza deban subsistir, como confidencialidad, limitación de responsabilidad y propiedad.', 'On termination, access is closed and the Customer data is handled as described in the Privacy notice: export for 30 days and deletion within the following 60 days. The clauses that by their nature must survive do so, such as confidentiality, limitation of liability and ownership.'],
    ]),
    texto(
      'Estos términos se rigen por las leyes federales de los Estados Unidos Mexicanos. Para su interpretación y cumplimiento, las partes se someten a los tribunales competentes del domicilio de Rovaq indicado en la sección 1, y renuncian a cualquier otro fuero que pudiera corresponderles.',
      'These terms are governed by the federal laws of the United Mexican States. For their interpretation and performance, the parties submit to the competent courts of the Rovaq address stated in section 1, and waive any other jurisdiction that may apply to them.',
      '13. Ley aplicable y jurisdicción', '13. Governing law and jurisdiction',
    ),
    texto(
      'Podemos actualizar estos términos. Publicaremos la versión nueva con su fecha y, si el cambio es sustancial, avisaremos al Administrador del espacio por correo con al menos 30 días de antelación. Seguir usando el servicio después de esa fecha implica aceptar el cambio; si no estás de acuerdo, puedes terminar el uso. La versión en español prevalece sobre la traducción al inglés.',
      'We may update these terms. We will publish the new version with its date and, if the change is substantial, notify the workspace administrator by email at least 30 days in advance. Continuing to use the service after that date means accepting the change; if you disagree, you may stop using the service. The Spanish version prevails over the English translation.',
      '14. Cambios a los términos', '14. Changes to the terms',
    ),
    lista('15. Contacto', '15. Contact', [
      ['Responsable: [RAZON_SOCIAL]. Domicilio: [DOMICILIO]. Correo: [CORREO_DE_PRIVACIDAD].', 'Operator: [LEGAL_NAME]. Address: [ADDRESS]. Email: [PRIVACY_EMAIL].'],
    ]),
  ],
};

export const PAGINAS_LEGALES: readonly Pagina[] = [AVISO_DE_PRIVACIDAD, TERMINOS];
