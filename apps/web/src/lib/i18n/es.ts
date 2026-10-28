// Diccionario en español (idioma base). Las claves son planas y sin acentos; {x} marca una variable. Cada clave debe existir también en en.ts (lo comprueba tests/i18n.test.ts).
import {cfoEs} from './d-cfo';
import {copEs} from './d-cop';
import {brechasEs} from './d-brechas';
import {cargaEs} from './d-carga';
import {confEs} from './d-conf';
import {conxEs} from './d-conx';
import {conxaEs} from './d-conxa';
import {conxeEs} from './d-conxe';
import {conxiEs} from './d-conxi';
import {conxjEs} from './d-conxj';
import {conxnEs} from './d-conxn';
import {conxpEs} from './d-conxp';
import {conxrEs} from './d-conxr';
import {conxsEs} from './d-conxs';
import {econEs} from './d-econ';
import {fugaEs} from './d-fuga';
import {histEs} from './d-hist';
import {intervEs} from './d-interv';
import {mapaEs} from './d-mapa';
import {probEs} from './d-prob';
import {recsEs} from './d-recs';
import {agEs} from './d-ag';
import {briefsEs} from './d-briefs';
import {exploradorEs} from './d-explorador';
import {probdetEs} from './d-probdet';
import {resumenEs} from './d-resumen';
import {onbEs} from './d-onb';
import {setupEs} from './d-setup';
import {tourEs} from './d-tour';
import {rolesEs} from './d-roles';
export const es = {
  // Compartido
  'comun.cerrar': 'Cerrar', 'comun.reintentar': 'Volver a intentar', 'comun.cargando': 'Cargando…', 'comun.sinDato': 'Sin dato',
  // Selector de idioma
  'idioma.etiqueta': 'Idioma', 'idioma.es': 'Español', 'idioma.en': 'English', 'idioma.cambiar': 'Cambiar idioma a {idioma}',
  // Caparazón (barra lateral, encabezado, hoja «Más»)
  'shell.saltar': 'Saltar al contenido', 'shell.logoResumen': 'Rovaq AI, resumen', 'shell.irInicio': 'Rovaq, ir a Inicio',
  'shell.expandir': 'Expandir menú', 'shell.contraer': 'Contraer menú', 'shell.abrirMenu': 'Abrir menú',
  'shell.organizacion': 'Organización', 'shell.cambiarOrg': 'Cambiar organización', 'shell.ir': 'Ir', 'shell.espacioCliente': 'Espacio de cliente',
  'shell.admin': 'Administración de Rovaq AI', 'shell.cerrarSesion': 'Cerrar sesión', 'shell.salir': 'Salir',
  'shell.mas': 'Más', 'shell.masSub': 'Todo el menú, avisos, tema y cuenta',
  'shell.tema': 'Tema de la interfaz', 'shell.temaClaro': 'Claro', 'shell.temaSistema': 'Sistema', 'shell.temaOscuro': 'Oscuro',
  'shell.rol.owner': 'Administrador del espacio', 'shell.rol.analyst': 'Analista', 'shell.rol.operator': 'Operador', 'shell.rol.viewer': 'Lectura',
  'shell.navPrincipal': 'Navegación principal', 'shell.navMovil': 'Navegación móvil', 'shell.paginaActual': 'Página actual',
  'shell.notificaciones': 'Notificaciones', 'shell.avisosSinLeer': '{n} avisos sin leer',
  // Barra inferior (celular)
  'movil.inicio': 'Inicio', 'movil.dinero': 'Dinero', 'movil.datos': 'Datos', 'movil.clientes': 'Clientes', 'movil.acciones': 'Acciones', 'movil.preguntar': 'Preguntar',
  'movil.empresaActual': 'Empresa: {nombre}. Cambiar de empresa', 'movil.cambiarEmpresa': 'Cambiar de empresa', 'movil.cambiarEmpresaSub': 'Elige el espacio que quieres ver',
  'movil.buscarEmpresa': 'Buscar empresa', 'movil.recientes': 'Recientes', 'movil.todas': 'Todas', 'movil.todasEmpresas': 'Todas las empresas',
  'movil.sinEmpresas': 'No hay empresas con ese nombre.', 'movil.empresaActualSr': 'Empresa actual',
  // Menú: grupos, ítems y títulos de pantalla
  'nav.grupo.dinero': 'Dinero', 'nav.grupo.clientes': 'Clientes y problemas', 'nav.grupo.operacion': 'Operación', 'nav.grupo.acciones': 'Acciones',
  'nav.grupo.datos': 'Datos y confianza', 'nav.grupo.administracion': 'Administración', 'nav.grupo.interno': 'Interno',
  'nav.item.overview': 'Hoy', 'nav.item.preguntale': 'Pregúntale a tus datos', 'nav.item.cfo': 'CFO', 'nav.item.gaps': 'Brechas de ingreso', 'nav.item.refunds': 'Fuga de reembolsos',
  'nav.item.problems': 'Problemas', 'nav.item.pain-points': 'Puntos de dolor', 'nav.item.map': 'Mapa de problemas', 'nav.item.workload': 'Carga y SLA',
  'nav.item.recommendations': 'Por decidir', 'nav.item.interventions': 'En curso y resultados', 'nav.item.confianza': 'Confianza', 'nav.item.sources': 'Cobertura de datos',
  'nav.item.connections': 'Fuentes conectadas', 'nav.item.imports': 'Importaciones', 'nav.item.history': 'Histórico e identidad', 'nav.item.analysis': 'Análisis',
  'nav.item.economics': 'Cortes publicados', 'nav.item.explorer': 'Explorador', 'nav.item.settings-team': 'Equipo', 'nav.item.settings-notifications': 'Avisos', 'nav.item.setup': 'Configuración', 'nav.item.settings-notification-delivery': 'Entrega de avisos',
  'nav.item.settings-retention': 'Retención', 'nav.item.evaluation': 'Evaluación histórica', 'nav.item.evaluation-candidates': 'Candidatos evaluados', 'nav.item.migrations': 'Comparación de migración',
  'nav.titulo.recommendations': 'Acciones · Por decidir', 'nav.titulo.interventions': 'Acciones', 'nav.titulo.confianza': 'Datos y confianza', 'nav.titulo.analysis': 'Análisis de conversaciones',
  'nav.titulo.settings-notifications': 'Preferencias de avisos', 'nav.titulo.settings-retention': 'Retención y borrado',
  'nav.titulo.notifications': 'Notificaciones', 'nav.titulo.briefs': 'Informe ejecutivo', 'nav.titulo.customers': 'Historial del cliente', 'nav.titulo.defecto': 'Espacio de trabajo',
  // Alcance, filtros y cajones
  'alcance.barra': 'Periodo y filtros', 'alcance.periodo': 'Periodo', 'alcance.esteMes': 'Este mes', 'alcance.30d': '30 días', 'alcance.90d': '90 días', 'alcance.12m': '12 meses', 'alcance.personalizado': 'Personalizado',
  'alcance.ultima': 'Última publicación', 'alcance.filtros': 'Filtros', 'alcance.filtrosActivos': 'Filtros activos', 'alcance.nActivos': '{n} activos',
  'alcance.hint': 'Periodo, moneda, fuentes y producto del alcance compartido.', 'alcance.skuUno': 'SKU {sku}', 'alcance.skuVarios': '{n} SKU', 'alcance.quitar': 'Quitar {filtro}',
  'alcance.limpiar': 'Limpiar', 'alcance.aplicar': 'Aplicar', 'alcance.unFiltro': 'filtro activo', 'alcance.variosFiltros': 'filtros activos', 'alcance.sinFiltros': 'Sin filtros: se muestra todo el alcance.',
  'filtros.compartidos': 'Filtros compartidos', 'filtros.periodo': 'Periodo', 'filtros.desde': 'Desde (UTC)', 'filtros.hasta': 'Hasta, exclusivo (UTC)', 'filtros.monedaBase': 'Moneda y base',
  'filtros.moneda': 'Moneda', 'filtros.base': 'Base', 'filtros.fuentes': 'Fuentes', 'filtros.fuentesNota': 'Sin selección se incluyen todas.', 'filtros.producto': 'Producto (SKU)',
  'filtros.skuLinea': 'SKU, uno por línea', 'filtros.skuNota': 'Filtra órdenes que contienen el producto; no representa ventas por línea.', 'filtros.avanzado': 'Avanzado',
  'filtros.mostrarAvanzado': 'Mostrar opciones avanzadas', 'filtros.decimales': 'Decimales de la moneda', 'filtros.publicacion': 'Publicación (opcional)', 'filtros.ultimaPublicada': 'Última publicada',
  'filtros.ayuda': 'Cambiar filtros reinicia la paginación. La fecha de referencia es la fecha efectiva del evento (UTC).',
  'base.net': 'Neto', 'base.marketplace_line_price': 'Precio de línea de marketplace',
  // Estados de datos
  'estado.cargandoDatos': 'Cargando datos autorizados', 'estado.errorTitulo': 'No pudimos cargar esta vista', 'estado.referencia': 'Referencia:',
  'estado.vacioTitulo': 'Sin resultados para este alcance', 'estado.vacioCuerpo': 'La consulta terminó correctamente. Ajusta el periodo o los filtros. Si todavía no hay datos, pide al propietario de tu organización que los cargue.',
  'estado.parcial': 'Datos parciales: no equivalen al total', 'estado.desactualizado': 'Datos desactualizados: revisa el corte', 'estado.listo': 'Corte disponible',
  'estado.corte': 'Corte:', 'estado.sinCorte': 'Sin corte publicado',
  'estado.identidad': 'Configura el acceso Supabase y verifica el servicio de identidad para abrir el espacio de trabajo.',
  'estado.organizaciones': 'No se pudo verificar la organización. Reintenta cuando se restablezca el servicio.',
  'estado.clienteGenerico': 'Cliente', 'estado.cargandoEspacio': 'Cargando tu espacio de trabajo…',
  // Encabezado de Datos y confianza
  'datos.eyebrow': 'Datos y confianza', 'datos.secciones': 'Secciones de Datos y confianza', 'datos.tab.resumen': 'Resumen', 'datos.tab.fuentes': 'Fuentes', 'datos.tab.cobertura': 'Cobertura',
  'datos.tab.importaciones': 'Importaciones', 'datos.tab.historico': 'Histórico', 'datos.tab.analisis': 'Análisis',
  'fuentes.titulo': 'Fuentes conectadas', 'fuentes.desc': 'Qué está conectado, con qué permisos y cuándo se sincronizó por última vez; todo en solo lectura.',
  // Hoy
  'hoy.titulo': 'Hoy', 'hoy.eyebrow': 'Resumen', 'hoy.periodo': 'Periodo de las cifras', 'hoy.exportar': 'Exportar informe', 'hoy.sinDatosTitulo': 'Aún no hay datos para mostrar',
  'hoy.sinDatosA': 'Ninguna fuente respondió con cifras. Eso no significa que todo esté en cero: revisa', 'hoy.sinDatosLink1': 'Datos y confianza', 'hoy.sinDatosO': 'o', 'hoy.sinDatosLink2': 'carga un archivo',
  'hoy.cuatroCifras': 'Cuatro cifras clave', 'hoy.tendencia': 'Tendencia', 'hoy.cargando': 'Cargando {kpi}', 'hoy.sinAcceso': 'Sin acceso', 'hoy.noDisponible': 'No disponible ahora', 'hoy.reintentar': 'Reintentar',
  'hoy.casosPorEstado': 'Casos por estado', 'hoy.vencidos': 'Vencidos', 'hoy.noReembolsables': 'No reembolsables', 'hoy.rechazados': 'Rechazados',
  'hoy.atencion': 'Requiere tu atención', 'hoy.nadaUrgente': 'Nada urgente con los datos disponibles. Si falta una fuente, aparece en Datos y confianza.',
  'hoy.observadoVsRec': 'Observado vs recuperable', 'hoy.recSinCifra': 'Recuperable estimado: sin cifra hasta que teclees tus supuestos.', 'hoy.sinSupuestos': 'sin supuestos', 'hoy.teclear': 'Teclear supuestos',
  'hoy.siguiente': 'Siguiente mejor acción', 'hoy.kpi.ingreso': 'Ingreso bruto', 'hoy.kpi.reembolsos': 'Reembolsos', 'hoy.kpi.atorado': 'Dinero atorado', 'hoy.kpi.respuestas24': 'Respuestas >24 h',
  // Puntos de dolor
  'pp.eyebrow': 'Insights', 'pp.sinteticos': ' · datos sintéticos de demostración', 'pp.titulo': 'Puntos de dolor', 'pp.desc': 'Dónde se pierde dinero y por qué, con evidencia hasta la fila.',
  'pp.descLarga': 'Dónde se pierde dinero y por qué, con evidencia hasta la fila. Tamaño = dinero devuelto en USD bruto; lo que no se sabe dice «Sin dato», nunca 0.',
  'pp.sinAcceso': 'Tu rol no tiene acceso a este panel', 'pp.sinAccesoCuerpo': 'Solo lo ven los propietarios y analistas de la organización; pide acceso a un propietario.', 'pp.volverResumen': 'Volver al resumen',
  'pp.exportarEvidencia': 'Exportar evidencia', 'pp.exportar': 'Exportar', 'pp.csvPorPunto': 'CSV por punto de dolor', 'pp.errorTitulo': 'No se pudo calcular los puntos de dolor',
  'pp.errorRol': 'Tu rol no tiene acceso a este panel. Lo ven propietarios y analistas.', 'pp.parcialTitulo': 'Datos parciales',
  'pp.parcialCuerpo': 'Una parte de las fuentes no respondió a tiempo: sus puntos salen como «No disponible ahora», no como cero. Se reintenta sola.',
  'pp.filtros': 'Filtros de puntos de dolor', 'pp.tema': 'Tema', 'pp.todos': 'Todos', 'pp.corte': 'Corte {fecha}', 'pp.indicadores': 'Indicadores de puntos de dolor',
  'pp.mapa': 'Mapa de burbujas', 'pp.mapaDesc': 'Cada burbuja es un punto de dolor', 'pp.medida': 'Medida del tamaño', 'pp.dinero': 'Dinero', 'pp.volumen': 'Volumen',
  'pp.top8': 'Los 8 mayores', 'pp.top8Dinero': 'USD bruto, de mayor a menor', 'pp.top8Volumen': 'Volumen, de mayor a menor',
  'pp.tablaCaption': 'Los 8 puntos de dolor mayores. Es la misma información del mapa.', 'pp.colPunto': 'Punto', 'pp.colUsd': 'USD', 'pp.colVolumen': 'Volumen', 'pp.colClase': 'Clase',
  'pp.sinPuntos': 'Sin puntos con cifra en este filtro.', 'pp.noSeSabe': 'Qué no se sabe', 'pp.noSeSabeDesc': 'Honestidad antes que cifras bonitas', 'pp.resumenPuntos': '{n} puntos · {temas} temas', 'pp.mostrando': 'Mostrando {n} de {total} puntos. Cada fila abre su evidencia.',
  'panel.sinRed': 'No se pudo conectar; reintentando…',
  // Panel compartido (Problemas / Resumen del corte)
  'panel.exportar': 'Exportar',
  'panel.exportarJson': 'Exportar JSON',
  'panel.exportarCsv': 'Exportar CSV',
  'panel.descargarJson': 'Descargar datos (JSON)',
  'panel.descargarCsv': 'Descargar datos (CSV)',
  'panel.identidad': 'Identidad de la publicación',
  'panel.publicacion': 'Publicación',
  'panel.alcance': 'Alcance',
  'panel.sinPublicacion': 'Sin publicación',
  'panel.sinVista': 'Sin vista publicada',
  'panel.siguiente': 'Página siguiente',
  'panel.fuentesPub': 'Fuentes y publicaciones',
  'panel.fuentesPubLargo': 'Revisar fuentes, clasificación de órdenes y publicaciones',
  'panel.catalogo': 'Catálogo de problemas',
  'panel.catalogoLargo': 'Gestionar el catálogo de problemas',
  'panel.aria.resumen': 'Resumen con alcance compartido',
  'panel.aria.problemas': 'Problemas con alcance compartido',
  'panel.eyebrowProblemas': 'Clientes y problemas',
  'panel.tituloProblemas': 'Problemas de negocio',
  'panel.reintentando': 'Reintentando…',
  'panel.vacioTitulo': 'Aún no hay un corte publicado para este alcance',
  'panel.vacioCuerpo': 'Cuando se publique un corte con este periodo y estos filtros, sus cifras aparecerán aquí. Mientras tanto puedes probar con la última publicación disponible.',
  'panel.verUltima': 'Ver la última publicación',
  'panel.importar': 'Importar datos',
  'panel.err.timeout': 'Las cifras del corte tardaron demasiado en responder, incluso después de reintentar (la publicación financiera es grande). La cobertura y la tendencia mensual de abajo sí se calcularon; reintenta con «Actualizar» en unos segundos.',
  'panel.err.acceso': 'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.',
  'panel.err.alcance': 'El alcance no es válido. Revisa fechas, moneda, base y publicación.',
  'panel.err.consulta': 'No se pudo consultar la vista. Reintenta cuando el servicio esté disponible.',
  'panel.err.verificar': 'La respuesta no se pudo verificar.',
  'panel.err.generico': 'No se pudo consultar la vista.',
  'panel.critico': 'Revisión crítica, independiente del importe',
  'panel.verCuales': 'Ver cuáles son',
  'panel.criticoUltima': 'Revisión crítica (última lectura)',
  'panel.criticoPendiente': 'Señales críticas pendientes',
  'panel.recalcular': 'Volver a calcular',
  'panel.criticoUltimaFrase': '{frase} en la última lectura de este alcance; en esta carga aún no se recalcularon.',
  'panel.criticoNoCalculadas': 'Aún no se calcularon en esta carga; no significa que no existan.',
  'panel.consultalas': 'Consúltalas en',
  ...cfoEs,
  ...copEs,
  ...brechasEs,
  ...cargaEs,
  ...confEs,
  ...conxEs,
  ...conxaEs,
  ...conxeEs,
  ...conxiEs,
  ...conxjEs,
  ...conxnEs,
  ...conxpEs,
  ...conxrEs,
  ...conxsEs,
  ...econEs,
  ...fugaEs,
  ...histEs,
  ...intervEs,
  ...mapaEs,
  ...probEs,
  ...recsEs,
  ...agEs,
  ...briefsEs,
  ...exploradorEs,
  ...probdetEs,
  ...resumenEs,
  ...onbEs,
  ...setupEs,
  ...tourEs,
  ...rolesEs,
} as const;
export type Clave = keyof typeof es;
