// Textos del onboarding (claves onb.*): clave -> español / inglés. es.ts y en.ts los incorporan; test:i18n exige las mismas claves y {variables}.
// Regla: ninguna cifra escrita a mano (conteos, porcentajes, pruebas de aislamiento, respaldos). Lo que lleve un número entra por {variable} desde una fuente citada.
export const onbEs = {
  'onb.ui.guia': 'Guía', 'onb.ui.omitir': 'Omitir recorrido', 'onb.ui.siguiente': 'Siguiente', 'onb.ui.anterior': 'Anterior', 'onb.ui.terminar': 'Terminar',
  'onb.ui.paso': 'Paso {n} de {total}', 'onb.ui.reabrir': 'Repetir el recorrido', 'onb.ui.esperando': 'Esperando a: {quien}',
  'onb.ui.sinPasos': 'No hay un recorrido para esta vista.',
  'onb.ui.superadminSinOrg': 'Tu cuenta es de administración de plataforma y no pertenece a ninguna organización. Entra a la consola de plataforma para trabajar.',
  // Propietario
  'onb.propietario.nombre': 'Recorrido del propietario',
  'onb.propietario.hoy.titulo': 'Hoy: tus cuatro cifras', 'onb.propietario.hoy.cuerpo': 'Ingreso, reembolsos, dinero atorado y respuestas en las últimas veinticuatro horas, cada una con su periodo. Si falta conciliar pedidos con clientes, la cifra lo dice en lugar de aparentar estar completa.',
  'onb.propietario.datos.titulo': 'Datos: fuentes e importaciones', 'onb.propietario.datos.cuerpo': 'Aquí ves qué está conectado y qué se importó. Conectar el CRM lo hace el equipo de Rovaq con una credencial tuya: copia la hoja para soporte y la preparamos juntos.',
  'onb.propietario.confianza.titulo': 'Confianza y cobertura', 'onb.propietario.confianza.cuerpo': 'Qué datos están cargados, cuáles faltan y cómo se calculó cada cifra. La seguridad de acceso con segundo factor para propietarios está en la hoja de ruta.',
  'onb.propietario.problema.titulo': 'Abre un problema con evidencia', 'onb.propietario.problema.cuerpo': 'Cada problema muestra de dónde sale: las conversaciones, los pedidos ligados y el sello de procedencia. Empieza por uno con dinero expuesto.',
  'onb.propietario.acciones.titulo': 'Decide la primera acción', 'onb.propietario.acciones.cuerpo': 'Solo el propietario aprueba. Revisa lo propuesto, apruébalo y después sigue su resultado en Acciones.',
  'onb.propietario.historial.titulo': 'Importar el historial', 'onb.propietario.historial.cuerpo': 'Carga el historial por archivo para que Rovaq tenga contexto desde el primer día.',
  'onb.propietario.corte.titulo': 'Publicar y revisar el corte', 'onb.propietario.corte.cuerpo': 'Prepara el corte económico y revísalo antes de publicarlo; las cifras parciales se marcan como tales.',
  'onb.propietario.equipo.titulo': 'Invitar a tu equipo', 'onb.propietario.equipo.cuerpo': 'Invita a analistas, operadores y lectores. Si el correo de acceso aún no está listo, este paso queda en espera y no cuenta como pendiente tuyo.',
  'onb.propietario.retencion.titulo': 'Revisar la retención', 'onb.propietario.retencion.cuerpo': 'Define cuánto tiempo se conservan los datos y cómo se borran cuando lo pidas.',
  // Analista
  'onb.analista.nombre': 'Recorrido del analista',
  'onb.analista.hoy.titulo': 'Hoy y cómo leer cada cifra', 'onb.analista.hoy.cuerpo': 'Cada cifra trae su periodo y su nivel de confianza. Empieza aquí para saber qué tan firme es lo que ves.',
  'onb.analista.problemas.titulo': 'Problemas con evidencia completa', 'onb.analista.problemas.cuerpo': 'Abre una ficha y revisa la evidencia detrás de cada hallazgo; después pasa a los puntos de dolor.',
  'onb.analista.dinero.titulo': 'Dinero: CFO y brechas', 'onb.analista.dinero.cuerpo': 'Lee las cifras con su salvedad: mientras falten pedidos por conciliar, son parciales y así se muestran.',
  'onb.analista.importar.titulo': 'Importar historial por archivo', 'onb.analista.importar.cuerpo': 'Puedes cargar historial en Importaciones. Conectar el CRM y cargar pedidos le toca al propietario.',
  'onb.analista.preguntar.titulo': 'Pregúntale a tus datos', 'onb.analista.preguntar.cuerpo': 'Haz una pregunta en lenguaje natural y revisa la evidencia que respalda la respuesta.',
  'onb.analista.corte.titulo': 'Preparar un corte', 'onb.analista.corte.cuerpo': 'Prepara el corte para revisión; publicarlo lo decide el propietario.',
  'onb.analista.informe.titulo': 'Exportar un informe', 'onb.analista.informe.cuerpo': 'Desde Hoy puedes exportar un informe para compartirlo.',
  // Operador
  'onb.operador.nombre': 'Recorrido del operador',
  'onb.operador.hoy.titulo': 'Hoy: lo que hay abierto', 'onb.operador.hoy.cuerpo': 'Ve qué problemas y acciones siguen abiertos. Las cifras de dinero son para propietarios y analistas.',
  'onb.operador.problemas.titulo': 'Problemas y cómo leer una ficha', 'onb.operador.problemas.cuerpo': 'Cada ficha explica qué pasó y de dónde sale. Úsala para decidir qué atender primero.',
  'onb.operador.acciones.titulo': 'Acciones en curso', 'onb.operador.acciones.cuerpo': 'Toma una intervención, muévela de etapa y registra su resultado. Aprobar nuevas acciones le corresponde al propietario.',
  'onb.operador.preguntar.titulo': 'Pregúntale a tus datos', 'onb.operador.preguntar.cuerpo': 'Consulta en lenguaje natural lo que necesites para operar.',
  'onb.operador.propuesta.titulo': 'Proponer tu primera acción', 'onb.operador.propuesta.cuerpo': 'Propón una acción a partir de un problema; el propietario la decide.',
  'onb.operador.resultado.titulo': 'Registrar un resultado', 'onb.operador.resultado.cuerpo': 'Cuando cierres una intervención, anota qué pasó para medir si funcionó.',
  // Lector
  'onb.lector.nombre': 'Recorrido del lector',
  'onb.lector.hoy.titulo': 'Hoy: cómo leer una cifra', 'onb.lector.hoy.cuerpo': 'Cada cifra indica su periodo. Tu acceso es de lectura: puedes mirar, no cambiar nada.',
  'onb.lector.problemas.titulo': 'Problemas y su evidencia', 'onb.lector.problemas.cuerpo': 'Abre un problema para leer su evidencia. Algunos datos sensibles aparecen resumidos para tu rol.',
  'onb.lector.confianza.titulo': 'Cuánto fiarte de cada cifra', 'onb.lector.confianza.cuerpo': 'Confianza explica qué tan completos están los datos. Los avisos te llegan a Notificaciones.',
  // Plataforma
  'onb.plataforma.nombre': 'Recorrido de administración de plataforma',
  'onb.plataforma.resumen.titulo': 'Resumen de salud', 'onb.plataforma.resumen.cuerpo': 'Estado de cada organización de un vistazo: fuentes, procesos y alertas.',
  'onb.plataforma.organizaciones.titulo': 'Organizaciones y Ver como', 'onb.plataforma.organizaciones.cuerpo': 'Para entrar como una organización debes indicar un motivo y una duración. La sesión es de solo lectura y queda registrada.',
  'onb.plataforma.costos.titulo': 'Costos de IA y procesos', 'onb.plataforma.costos.cuerpo': 'Revisa los topes de gasto y los trabajos pendientes antes de que afecten a un cliente.',
  'onb.plataforma.auditoria.titulo': 'Auditoría y alertas', 'onb.plataforma.auditoria.cuerpo': 'Consulta quién hizo qué y qué alertas siguen abiertas.',
  // Soporte
  'onb.soporte.nombre': 'Sesión de soporte',
  'onb.soporte.aviso.titulo': 'Estás viendo como {organizacion}', 'onb.soporte.aviso.cuerpo': 'Solo lectura: no puedes exportar ni editar, y todo queda registrado. Usa Salir para volver a la consola.',
} as const;

export const onbEn = {
  'onb.ui.guia': 'Guide', 'onb.ui.omitir': 'Skip tour', 'onb.ui.siguiente': 'Next', 'onb.ui.anterior': 'Back', 'onb.ui.terminar': 'Finish',
  'onb.ui.paso': 'Step {n} of {total}', 'onb.ui.reabrir': 'Repeat the tour', 'onb.ui.esperando': 'Waiting on: {quien}',
  'onb.ui.sinPasos': 'There is no tour for this view.',
  'onb.ui.superadminSinOrg': 'Your account is a platform administrator and does not belong to any organization. Open the platform console to get to work.',
  // Owner
  'onb.propietario.nombre': 'Owner tour',
  'onb.propietario.hoy.titulo': 'Today: your four numbers', 'onb.propietario.hoy.cuerpo': 'Revenue, refunds, stuck money and replies within the last twenty-four hours, each with its period. If orders are not yet matched to customers, the number says so instead of looking complete.',
  'onb.propietario.datos.titulo': 'Data: sources and imports', 'onb.propietario.datos.cuerpo': 'See what is connected and what was imported. The Rovaq team connects the CRM using a credential from you: copy the support sheet and we set it up together.',
  'onb.propietario.confianza.titulo': 'Trust and coverage', 'onb.propietario.confianza.cuerpo': 'Which data is loaded, what is missing and how each number was calculated. Second-factor sign-in for owners is on the roadmap.',
  'onb.propietario.problema.titulo': 'Open a problem with evidence', 'onb.propietario.problema.cuerpo': 'Every problem shows where it comes from: the conversations, the linked orders and the provenance stamp. Start with one that has money at stake.',
  'onb.propietario.acciones.titulo': 'Decide the first action', 'onb.propietario.acciones.cuerpo': 'Only the owner approves. Review what was proposed, approve it, then follow its result under Actions.',
  'onb.propietario.historial.titulo': 'Import the history', 'onb.propietario.historial.cuerpo': 'Upload the history from a file so Rovaq has context from day one.',
  'onb.propietario.corte.titulo': 'Publish and review the cut', 'onb.propietario.corte.cuerpo': 'Prepare the economic cut and review it before publishing; partial numbers are labeled as such.',
  'onb.propietario.equipo.titulo': 'Invite your team', 'onb.propietario.equipo.cuerpo': 'Invite analysts, operators and viewers. If the sign-in email is not ready yet, this step waits and does not count as pending on you.',
  'onb.propietario.retencion.titulo': 'Review retention', 'onb.propietario.retencion.cuerpo': 'Set how long data is kept and how it is erased when you ask.',
  // Analyst
  'onb.analista.nombre': 'Analyst tour',
  'onb.analista.hoy.titulo': 'Today and how to read each number', 'onb.analista.hoy.cuerpo': 'Each number carries its period and confidence level. Start here to see how firm what you read is.',
  'onb.analista.problemas.titulo': 'Problems with full evidence', 'onb.analista.problemas.cuerpo': 'Open a card and review the evidence behind each finding, then move on to pain points.',
  'onb.analista.dinero.titulo': 'Money: CFO and gaps', 'onb.analista.dinero.cuerpo': 'Read the numbers with their caveat: while orders are still unmatched they are partial and shown that way.',
  'onb.analista.importar.titulo': 'Import history from a file', 'onb.analista.importar.cuerpo': 'You can upload history under Imports. Connecting the CRM and loading orders is up to the owner.',
  'onb.analista.preguntar.titulo': 'Ask your data', 'onb.analista.preguntar.cuerpo': 'Ask a question in plain language and check the evidence behind the answer.',
  'onb.analista.corte.titulo': 'Prepare a cut', 'onb.analista.corte.cuerpo': 'Prepare the cut for review; the owner decides whether to publish it.',
  'onb.analista.informe.titulo': 'Export a report', 'onb.analista.informe.cuerpo': 'From Today you can export a report to share.',
  // Operator
  'onb.operador.nombre': 'Operator tour',
  'onb.operador.hoy.titulo': 'Today: what is open', 'onb.operador.hoy.cuerpo': 'See which problems and actions are still open. Money numbers are for owners and analysts.',
  'onb.operador.problemas.titulo': 'Problems and how to read a card', 'onb.operador.problemas.cuerpo': 'Each card explains what happened and where it comes from. Use it to decide what to handle first.',
  'onb.operador.acciones.titulo': 'Actions in progress', 'onb.operador.acciones.cuerpo': 'Pick up an intervention, move it along and record its result. Approving new actions belongs to the owner.',
  'onb.operador.preguntar.titulo': 'Ask your data', 'onb.operador.preguntar.cuerpo': 'Ask in plain language whatever you need to operate.',
  'onb.operador.propuesta.titulo': 'Propose your first action', 'onb.operador.propuesta.cuerpo': 'Propose an action from a problem; the owner decides on it.',
  'onb.operador.resultado.titulo': 'Record a result', 'onb.operador.resultado.cuerpo': 'When you close an intervention, note what happened so we can tell whether it worked.',
  // Viewer
  'onb.lector.nombre': 'Viewer tour',
  'onb.lector.hoy.titulo': 'Today: how to read a number', 'onb.lector.hoy.cuerpo': 'Each number shows its period. Your access is read-only: you can look, not change anything.',
  'onb.lector.problemas.titulo': 'Problems and their evidence', 'onb.lector.problemas.cuerpo': 'Open a problem to read its evidence. Some sensitive details appear summarized for your role.',
  'onb.lector.confianza.titulo': 'How much to trust each number', 'onb.lector.confianza.cuerpo': 'Trust explains how complete the data is. Your alerts arrive under Notifications.',
  // Platform
  'onb.plataforma.nombre': 'Platform administration tour',
  'onb.plataforma.resumen.titulo': 'Health overview', 'onb.plataforma.resumen.cuerpo': 'The state of every organization at a glance: sources, jobs and alerts.',
  'onb.plataforma.organizaciones.titulo': 'Organizations and View as', 'onb.plataforma.organizaciones.cuerpo': 'To enter as an organization you must give a reason and a duration. The session is read-only and is recorded.',
  'onb.plataforma.costos.titulo': 'AI costs and jobs', 'onb.plataforma.costos.cuerpo': 'Check spending caps and pending jobs before they affect a customer.',
  'onb.plataforma.auditoria.titulo': 'Audit and alerts', 'onb.plataforma.auditoria.cuerpo': 'See who did what and which alerts are still open.',
  // Support
  'onb.soporte.nombre': 'Support session',
  'onb.soporte.aviso.titulo': 'You are viewing as {organizacion}', 'onb.soporte.aviso.cuerpo': 'Read-only: you cannot export or edit, and everything is recorded. Use Exit to return to the console.',
} as const;
