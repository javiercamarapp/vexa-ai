// English dictionary. Must mirror es.ts key for key (the type enforces it at compile time and tests/i18n.test.ts at run time).
import type {Clave} from './es';
import {cfoEn} from './d-cfo';
import {copEn} from './d-cop';
import {brechasEn} from './d-brechas';
import {cargaEn} from './d-carga';
import {confEn} from './d-conf';
import {conxEn} from './d-conx';
import {conxaEn} from './d-conxa';
import {conxeEn} from './d-conxe';
import {conxiEn} from './d-conxi';
import {conxjEn} from './d-conxj';
import {conxnEn} from './d-conxn';
import {conxpEn} from './d-conxp';
import {conxrEn} from './d-conxr';
import {conxsEn} from './d-conxs';
import {econEn} from './d-econ';
import {fugaEn} from './d-fuga';
import {histEn} from './d-hist';
import {intervEn} from './d-interv';
import {mapaEn} from './d-mapa';
import {probEn} from './d-prob';
import {recsEn} from './d-recs';
import {agEn} from './d-ag';
import {briefsEn} from './d-briefs';
import {exploradorEn} from './d-explorador';
import {probdetEn} from './d-probdet';
import {resumenEn} from './d-resumen';
import {onbEn} from './d-onb';
import {setupEn} from './d-setup';
import {tourEn} from './d-tour';
import {landingEn} from './d-landing';
import {rolesEn} from './d-roles';
import {metaEn} from './d-meta';
import {trAEn} from './d-tr-a';
import {trBEn} from './d-tr-b';
import {trCEn} from './d-tr-c';
import {trDEn} from './d-tr-d';
import {trEEn} from './d-tr-e';
import {trFEn} from './d-tr-f';
import {trGEn} from './d-tr-g';
import {trHEn} from './d-tr-h';
import {trIEn} from './d-tr-i';
export const en: Record<Clave, string> = {
  'comun.cerrar': 'Close', 'comun.reintentar': 'Try again', 'comun.cargando': 'Loading…', 'comun.sinDato': 'No data',
  'idioma.etiqueta': 'Language', 'idioma.es': 'Español', 'idioma.en': 'English', 'idioma.cambiar': 'Switch language to {idioma}',
  'shell.saltar': 'Skip to content', 'shell.logoResumen': 'Rovaq AI, overview', 'shell.irInicio': 'Rovaq, go to Home',
  'shell.expandir': 'Expand menu', 'shell.contraer': 'Collapse menu', 'shell.abrirMenu': 'Open menu',
  'shell.organizacion': 'Organization', 'shell.cambiarOrg': 'Switch organization', 'shell.ir': 'Go', 'shell.espacioCliente': 'Client workspace',
  'shell.admin': 'Rovaq AI administration', 'shell.cerrarSesion': 'Sign out', 'shell.salir': 'Sign out',
  'shell.mas': 'More', 'shell.masSub': 'The full menu, alerts, theme and account',
  'shell.tema': 'Interface theme', 'shell.temaClaro': 'Light', 'shell.temaSistema': 'System', 'shell.temaOscuro': 'Dark',
  'shell.rol.owner': 'Workspace administrator', 'shell.rol.analyst': 'Analyst', 'shell.rol.operator': 'Operator', 'shell.rol.viewer': 'Read-only',
  'shell.navPrincipal': 'Main navigation', 'shell.navMovil': 'Mobile navigation', 'shell.paginaActual': 'Current page',
  'shell.notificaciones': 'Notifications', 'shell.avisosSinLeer': '{n} unread alerts',
  'movil.inicio': 'Home', 'movil.dinero': 'Money', 'movil.datos': 'Data', 'movil.clientes': 'Customers', 'movil.acciones': 'Actions', 'movil.preguntar': 'Ask',
  'movil.empresaActual': 'Company: {nombre}. Switch company', 'movil.cambiarEmpresa': 'Switch company', 'movil.cambiarEmpresaSub': 'Choose the workspace you want to see',
  'movil.buscarEmpresa': 'Search company', 'movil.recientes': 'Recent', 'movil.todas': 'All', 'movil.todasEmpresas': 'All companies',
  'movil.sinEmpresas': 'No companies match that name.', 'movil.empresaActualSr': 'Current company',
  'nav.grupo.dinero': 'Money', 'nav.grupo.clientes': 'Customers and problems', 'nav.grupo.operacion': 'Operations', 'nav.grupo.acciones': 'Actions',
  'nav.grupo.datos': 'Data and trust', 'nav.grupo.administracion': 'Administration', 'nav.grupo.interno': 'Internal',
  'nav.item.overview': 'Today', 'nav.item.preguntale': 'Ask your data', 'nav.item.cfo': 'CFO', 'nav.item.gaps': 'Revenue gaps', 'nav.item.refunds': 'Refund leakage',
  'nav.item.problems': 'Problems', 'nav.item.pain-points': 'Pain points', 'nav.item.map': 'Problem map', 'nav.item.workload': 'Workload and SLA',
  'nav.item.recommendations': 'To decide', 'nav.item.interventions': 'In progress and results', 'nav.item.confianza': 'Trust', 'nav.item.sources': 'Data coverage',
  'nav.item.connections': 'Connected sources', 'nav.item.imports': 'Imports', 'nav.item.history': 'History and identity', 'nav.item.analysis': 'Analysis',
  'nav.item.economics': 'Published cuts', 'nav.item.explorer': 'Explorer', 'nav.item.settings-team': 'Team', 'nav.item.settings-notifications': 'Alerts', 'nav.item.setup': 'Setup', 'nav.item.settings-notification-delivery': 'Alert delivery',
  'nav.item.settings-retention': 'Retention', 'nav.item.evaluation': 'Historical evaluation', 'nav.item.evaluation-candidates': 'Evaluated candidates', 'nav.item.migrations': 'Migration comparison',
  'nav.titulo.recommendations': 'Actions · To decide', 'nav.titulo.interventions': 'Actions', 'nav.titulo.confianza': 'Data and trust', 'nav.titulo.analysis': 'Conversation analysis',
  'nav.titulo.settings-notifications': 'Alert preferences', 'nav.titulo.settings-retention': 'Retention and deletion',
  'nav.titulo.notifications': 'Notifications', 'nav.titulo.briefs': 'Executive report', 'nav.titulo.customers': 'Customer history', 'nav.titulo.defecto': 'Workspace',
  'alcance.barra': 'Period and filters', 'alcance.periodo': 'Period', 'alcance.esteMes': 'This month', 'alcance.30d': '30 days', 'alcance.90d': '90 days', 'alcance.12m': '12 months', 'alcance.personalizado': 'Custom',
  'alcance.ultima': 'Latest publication', 'alcance.filtros': 'Filters', 'alcance.filtrosActivos': 'Active filters', 'alcance.nActivos': '{n} active',
  'alcance.hint': 'Period, currency, sources and product of the shared scope.', 'alcance.skuUno': 'SKU {sku}', 'alcance.skuVarios': '{n} SKUs', 'alcance.quitar': 'Remove {filtro}',
  'alcance.limpiar': 'Clear', 'alcance.aplicar': 'Apply', 'alcance.unFiltro': 'active filter', 'alcance.variosFiltros': 'active filters', 'alcance.sinFiltros': 'No filters: the whole scope is shown.',
  'filtros.compartidos': 'Shared filters', 'filtros.periodo': 'Period', 'filtros.desde': 'From (UTC)', 'filtros.hasta': 'To, exclusive (UTC)', 'filtros.monedaBase': 'Currency and basis',
  'filtros.moneda': 'Currency', 'filtros.base': 'Basis', 'filtros.fuentes': 'Sources', 'filtros.fuentesNota': 'With no selection, all are included.', 'filtros.producto': 'Product (SKU)',
  'filtros.skuLinea': 'SKU, one per line', 'filtros.skuNota': 'Filters orders that contain the product; it does not represent sales per line.', 'filtros.avanzado': 'Advanced',
  'filtros.mostrarAvanzado': 'Show advanced options', 'filtros.decimales': 'Currency decimals', 'filtros.publicacion': 'Publication (optional)', 'filtros.ultimaPublicada': 'Latest published',
  'filtros.ayuda': 'Changing filters resets pagination. The reference date is the event effective date (UTC).',
  'base.net': 'Net', 'base.marketplace_line_price': 'Marketplace line price',
  'estado.cargandoDatos': 'Loading authorized data', 'estado.errorTitulo': 'We could not load this view', 'estado.referencia': 'Reference:',
  'estado.vacioTitulo': 'No results for this scope', 'estado.vacioCuerpo': 'The query finished correctly. Adjust the period or the filters. If there is no data yet, ask the owner of your organization to load it.',
  'estado.parcial': 'Partial data: it does not equal the total', 'estado.desactualizado': 'Outdated data: check the cut', 'estado.listo': 'Cut available',
  'estado.corte': 'Cut:', 'estado.sinCorte': 'No published cut',
  'estado.identidad': 'Set up Supabase access and check the identity service to open the workspace.',
  'estado.organizaciones': 'The organization could not be verified. Try again once the service is restored.',
  'estado.clienteGenerico': 'Client', 'estado.cargandoEspacio': 'Loading your workspace…',
  'datos.eyebrow': 'Data and trust', 'datos.secciones': 'Data and trust sections', 'datos.tab.resumen': 'Overview', 'datos.tab.fuentes': 'Sources', 'datos.tab.cobertura': 'Coverage',
  'datos.tab.importaciones': 'Imports', 'datos.tab.historico': 'History', 'datos.tab.analisis': 'Analysis',
  'fuentes.titulo': 'Connected sources', 'fuentes.desc': 'What is connected, with which permissions and when it last synced; everything is read-only.',
  'hoy.titulo': 'Today', 'hoy.eyebrow': 'Overview', 'hoy.periodo': 'Period of the figures', 'hoy.exportar': 'Export report', 'hoy.sinDatosTitulo': 'There is no data to show yet',
  'hoy.sinDatosA': 'No source returned figures. That does not mean everything is zero: check', 'hoy.sinDatosLink1': 'Data and trust', 'hoy.sinDatosO': 'or', 'hoy.sinDatosLink2': 'upload a file',
  'hoy.cuatroCifras': 'Four key figures', 'hoy.tendencia': 'Trend', 'hoy.cargando': 'Loading {kpi}', 'hoy.sinAcceso': 'No access', 'hoy.noDisponible': 'Not available right now', 'hoy.reintentar': 'Retry',
  'hoy.casosPorEstado': 'Cases by status', 'hoy.vencidos': 'Expired', 'hoy.noReembolsables': 'Non-refundable', 'hoy.rechazados': 'Rejected',
  'hoy.atencion': 'Needs your attention', 'hoy.nadaUrgente': 'Nothing urgent with the available data. If a source is missing, it shows up in Data and trust.',
  'hoy.observadoVsRec': 'Observed vs recoverable', 'hoy.recSinCifra': 'Estimated recoverable: no figure until you enter your assumptions.', 'hoy.sinSupuestos': 'no assumptions', 'hoy.teclear': 'Enter assumptions',
  'hoy.siguiente': 'Next best action', 'hoy.kpi.ingreso': 'Gross revenue', 'hoy.kpi.reembolsos': 'Refunds', 'hoy.kpi.atorado': 'Stuck money', 'hoy.kpi.respuestas24': 'Replies >24 h',
  'pp.eyebrow': 'Insights', 'pp.sinteticos': ' · synthetic demo data', 'pp.titulo': 'Pain points', 'pp.desc': 'Where money is lost and why, with evidence down to the row.',
  'pp.descLarga': 'Where money is lost and why, with evidence down to the row. Size = money refunded in gross USD; what is unknown says “No data”, never 0.',
  'pp.sinAcceso': 'Your role does not have access to this panel', 'pp.sinAccesoCuerpo': 'Only organization owners and analysts can see it; ask an owner for access.', 'pp.volverResumen': 'Back to overview',
  'pp.exportarEvidencia': 'Export evidence', 'pp.exportar': 'Export', 'pp.csvPorPunto': 'CSV per pain point', 'pp.errorTitulo': 'Pain points could not be calculated',
  'pp.errorRol': 'Your role does not have access to this panel. Owners and analysts can see it.', 'pp.parcialTitulo': 'Partial data',
  'pp.parcialCuerpo': 'Some sources did not respond in time: their points show as “Not available right now”, not as zero. It retries on its own.',
  'pp.filtros': 'Pain point filters', 'pp.tema': 'Theme', 'pp.todos': 'All', 'pp.corte': 'Cut {fecha}', 'pp.indicadores': 'Pain point indicators',
  'pp.mapa': 'Bubble map', 'pp.mapaDesc': 'Each bubble is a pain point', 'pp.medida': 'Size measure', 'pp.dinero': 'Money', 'pp.volumen': 'Volume',
  'pp.top8': 'Top 8', 'pp.top8Dinero': 'Gross USD, highest to lowest', 'pp.top8Volumen': 'Volume, highest to lowest',
  'pp.tablaCaption': 'The 8 largest pain points. It is the same information as the map.', 'pp.colPunto': 'Point', 'pp.colUsd': 'USD', 'pp.colVolumen': 'Volume', 'pp.colClase': 'Class',
  'pp.sinPuntos': 'No points with a figure under this filter.', 'pp.noSeSabe': 'What is not known', 'pp.noSeSabeDesc': 'Honesty before pretty numbers', 'pp.resumenPuntos': '{n} points · {temas} themes', 'pp.mostrando': 'Showing {n} of {total} points. Each row opens its evidence.',
  'panel.sinRed': 'Could not connect; retrying…',
  // Panel compartido (Problemas / Resumen del corte)
  'panel.exportar': 'Export',
  'panel.exportarJson': 'Export JSON',
  'panel.exportarCsv': 'Export CSV',
  'panel.descargarJson': 'Download data (JSON)',
  'panel.descargarCsv': 'Download data (CSV)',
  'panel.identidad': 'Publication identity',
  'panel.publicacion': 'Publication',
  'panel.alcance': 'Scope',
  'panel.sinPublicacion': 'No publication',
  'panel.sinVista': 'No published view',
  'panel.siguiente': 'Next page',
  'panel.fuentesPub': 'Sources and publications',
  'panel.fuentesPubLargo': 'Review sources, order classification and publications',
  'panel.catalogo': 'Problem catalog',
  'panel.catalogoLargo': 'Manage the problem catalog',
  'panel.aria.resumen': 'Overview with shared scope',
  'panel.aria.problemas': 'Problems with shared scope',
  'panel.eyebrowProblemas': 'Customers and problems',
  'panel.tituloProblemas': 'Business problems',
  'panel.reintentando': 'Retrying…',
  'panel.vacioTitulo': 'There is no published cut for this scope yet',
  'panel.vacioCuerpo': 'When a cut is published for this period and these filters, its figures will appear here. Meanwhile you can try the latest available publication.',
  'panel.verUltima': 'See the latest publication',
  'panel.importar': 'Import data',
  'panel.err.timeout': 'The cut figures took too long to respond, even after retrying (the financial publication is large). The coverage and monthly trend below were calculated; try again with “Refresh” in a few seconds.',
  'panel.err.acceso': 'Your access changed. Sign in again or select an authorized organization.',
  'panel.err.alcance': 'The scope is not valid. Check dates, currency, basis and publication.',
  'panel.err.consulta': 'The view could not be queried. Try again when the service is available.',
  'panel.err.verificar': 'The response could not be verified.',
  'panel.err.generico': 'The view could not be queried.',
  'panel.critico': 'Critical review, independent of amount',
  'panel.verCuales': 'See which ones',
  'panel.criticoUltima': 'Critical review (latest reading)',
  'panel.criticoPendiente': 'Pending critical signals',
  'panel.recalcular': 'Recalculate',
  'panel.criticoUltimaFrase': '{frase} in the latest reading of this scope; they have not been recalculated in this load yet.',
  'panel.criticoNoCalculadas': 'They have not been calculated in this load yet; that does not mean they do not exist.',
  'panel.consultalas': 'See them in',
  ...cfoEn,
  ...copEn,
  ...brechasEn,
  ...cargaEn,
  ...confEn,
  ...conxEn,
  ...conxaEn,
  ...conxeEn,
  ...conxiEn,
  ...conxjEn,
  ...conxnEn,
  ...conxpEn,
  ...conxrEn,
  ...conxsEn,
  ...econEn,
  ...fugaEn,
  ...histEn,
  ...intervEn,
  ...mapaEn,
  ...probEn,
  ...recsEn,
  ...agEn,
  ...briefsEn,
  ...exploradorEn,
  ...probdetEn,
  ...resumenEn,
  ...onbEn,
  ...metaEn,
  ...trAEn,
  ...trBEn,
  ...trCEn,
  ...trDEn,
  ...trEEn,
  ...trFEn,
  ...trGEn,
  ...trHEn,
  ...trIEn,
  ...setupEn,
  ...tourEn,
  ...landingEn,
  ...rolesEn,
};
