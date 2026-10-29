// Traducción grupo A (error/404, acceso, seguridad, piezas de ui/, datos/, hoy/, workspace/, explorador, avisos push y agente): paridad es/en de d-tr-a,
// sin texto fijo en español en los archivos migrados y reglas de la casa para el inglés.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trAEs, trAEn} from '../src/lib/i18n/d-tr-a';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const variables = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const ES = trAEs as Record<string, string>, EN = trAEn as Record<string, string>;
/** Código sin comentarios: la prueba mira texto que se pinta, no la documentación en español. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

test('d-tr-a: las claves tr.* son idénticas en es y en, sin vacíos, con las mismas {variables}', () => {
  const ke = Object.keys(ES).sort(), kn = Object.keys(EN).sort();
  assert.ok(ke.length > 400, 'diccionario con contenido: ' + ke.length);
  assert.deepEqual(kn.filter((k) => !ke.includes(k)), [], 'claves solo en inglés');
  assert.deepEqual(ke.filter((k) => !kn.includes(k)), [], 'claves solo en español');
  for (const k of ke) {
    assert.ok(k.startsWith('tr.'), 'prefijo tr.: ' + k);
    assert.ok(ES[k].trim() && EN[k].trim(), 'vacío: ' + k);
    assert.equal(variables(EN[k]), variables(ES[k]), 'variables distintas: ' + k);
    assert.equal((es as Record<string, string>)[k], ES[k], 'es.ts incorpora ' + k);
    assert.equal((en as Record<string, string>)[k], EN[k], 'en.ts incorpora ' + k);
  }
});

test('d-tr-a: el inglés no lleva letras acentuadas del español, signos invertidos ni paréntesis, y las cifras entran por {variable}', () => {
  for (const [k, v] of Object.entries(EN)) {
    assert.doesNotMatch(v, /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/, 'acento en inglés: ' + k);
    assert.doesNotMatch(v, /[()]/, 'paréntesis en inglés: ' + k);
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji en inglés: ' + k);
    assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, 'cifra escrita a mano en inglés: ' + k);
  }
  for (const [k, v] of Object.entries(ES)) {
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji en español: ' + k);
    assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, 'cifra escrita a mano en español: ' + k);
  }
});

// Archivos migrados: toda clave literal que usan existe en los dos idiomas con las variables que pasan, y no queda el texto fijo en español.
const PROHIBIDOS: Record<string, string[]> = {
  'src/app/error.tsx': ['No pudimos abrir esta página', 'Recargar la página', 'Recargando…'],
  'src/app/not-found.tsx': ['No encontramos esta página', 'Ir a Hoy'],
  'src/app/page.tsx': ['En construcción', 'El acceso aún no está configurado'],
  'src/components/sin-acceso.tsx': ['Aceptar y entrar', 'te invitaron con tu correo', "'Dueño'"],
  'src/components/email-login-complete.tsx': ['Bienvenido a Rovaq AI', 'Tus espacios de trabajo', 'Elige el espacio de cliente'],
  'src/app/seguridad/page.tsx': ['verificación en dos pasos', 'Ir a la consola de plataforma'],
  'src/app/(workspace)/jobs/setup/page.tsx': ['Habilitar worker', 'Revocar worker', 'Configurar proceso en segundo plano'],
  'src/app/(workspace)/problems/[id]/page.tsx': ['Evaluación causal y pruebas operativas', 'Agrupación y revisión humana'],
  'src/app/(workspace)/gaps/page.tsx': ['Tu rol no tiene acceso a este panel', 'Volver al resumen', 'Organización de demostración'],
  'src/app/(workspace)/map/page.tsx': ['Tu rol no tiene acceso a este panel', 'Volver al resumen', 'Casos de posventa por estado'],
  'src/app/(workspace)/workload/page.tsx': ['Tu rol no tiene acceso a este panel', 'Volver al resumen', 'riesgo de SLA de 24 horas'],
  'src/components/ui/category-volume.tsx': ['Reintentar categorías', 'Solo hay notificaciones automáticas', 'Categorías con más incidencias'],
  'src/components/ui/chart-state.tsx': ['Todavía no hay datos para mostrar', 'Tu acceso no permite consultar'],
  'src/components/ui/chart-parts.tsx': ['Sin variación: mes incompleto', 'mes incompleto, no comparable'],
  'src/components/ui/coverage-band.tsx': ['Información incorporada', 'Sin cargar', 'Reintentar cobertura', 'Más detalle'],
  'src/components/ui/trend-chart.tsx': ['Volumen y movimiento por mes', 'Pedidos registrados por mes', 'Cargando tendencias'],
  'src/components/ui/incidence-evolution.tsx': ['Evolución mensual de incidencias', 'Lecturas de la evolución'],
  'src/components/ui/page-header.tsx': ['¿Cómo leer esto?'],
  'src/components/ui/heatmap.tsx': ['Toca una celda', 'desplazamiento horizontal'],
  'src/components/ui/noise-toggle.tsx': ['Incluir notificaciones automáticas', 'Ninguna oculta en esta vista'],
  'src/components/ui/insight-card.tsx': ['Prioridad', 'Hallazgo'],
  'src/components/ui/insight-list.tsx': ['Lo más importante', 'Cobertura:'],
  'src/components/ui/movil-contenido.tsx': ['Comparar columnas', 'Cómo ver las tablas'],
  'src/components/ui/citation.tsx': ['Ver origen', 'Ocultar origen', 'Nota interna'],
  'src/components/ui/data-table.tsx': ['Sin filas', 'No hay registros para mostrar'],
  'src/components/ui/error-state.tsx': ['No se pudo cargar'],
  'src/components/ui/skeletons.tsx': ['Cargando datos autorizados', 'Cargando gráfica'],
  'src/components/ui/column-chart.tsx': ['>Periodo<', '(mes incompleto)'],
  'src/components/ui/area-chart.tsx': ['Usa las flechas', '>Periodo<'],
  'src/components/ui/bar-chart.tsx': ['Sin datos para graficar'],
  'src/components/ui/bar-list.tsx': ['Sin datos para clasificar'],
  'src/components/ui/kpi-strip.tsx': ['Indicadores', 'Tendencia de'],
  'src/components/ui/mini-charts.tsx': ['sin dato', 'de objetivo'],
  'src/components/ui/wait-status.tsx': ["'Cargando"],
  'src/components/datos/identidad-card.tsx': ['Cobertura de identidad', 'Por qué importa', 'Ver el detalle de las relaciones'],
  'src/components/datos/cobertura-conexiones.tsx': ['Cuánto trajo cada fuente', 'Datos y fuentes', 'Sin rango registrado'],
  'src/components/datos/estado-sincronizacion.tsx': ['Estado de sincronización', 'Todavía no se registró ninguna sincronización'],
  'src/components/datos/analisis-hallazgos.tsx': ['Cobertura del análisis', 'Hallazgos por análisis', 'Sin vínculo registrado'],
  'src/components/datos/fuentes-datos.tsx': ['Qué fuentes están cargadas', 'Cálculos precalculados', 'Cargando sincronización'],
  'src/components/datos/conexiones-resumen.tsx': ['Sincronización automática', 'Registros nuevos'],
  'src/components/hoy/paquete-reclamo.tsx': ['Descargar paquete', 'Borrador del mensaje', 'Reuniendo los reembolsos'],
  'src/components/hoy/respuesta-en-linea.tsx': ['Seguir en el chat', 'Rovaq responde'],
  'src/components/workspace/access.tsx': ['uso interno'],
  'src/components/workspace/action-form.tsx': ['Consultar evidencia', 'Guardar plan', 'Solicitar transición'],
  'src/components/workspace/customer-bindings.tsx': ['Asociar identidad financiera y cliente', 'Guardar asociación de cliente'],
  'src/components/workspace/order-mappings.tsx': ['Clasificación de órdenes', 'Guardar clasificación de orden'],
  'src/components/workspace/detail-hero.tsx': ['Cobertura completa', 'Resumen del detalle', 'Sin causa identificada'],
  'src/components/workspace/filters.tsx': ['Aplicar alcance', 'Filtros compartidos'],
  'src/components/explorer/panel.tsx': ['No hay citas disponibles', 'No se pudo verificar el alcance'],
  'src/components/notifications/push-preferences.tsx': ['Notificaciones en este dispositivo', 'Activar avisos en este dispositivo'],
  'src/components/agente/attachment-card.tsx': ['Resumen de columnas numéricas', 'El agente no lee este archivo'],
  'src/components/agente/blocks.tsx': ['Hay más filas en el sistema', 'Cifras de la respuesta'],
  'src/components/agente/sugerencias.tsx': ['Preguntas por tema'],
};

test('grupo A: los archivos migrados no vuelven a llevar el texto fijo en español', () => {
  for (const [archivo, textos] of Object.entries(PROHIBIDOS)) {
    const codigo = sinComentarios(leer(archivo));
    for (const t of textos) assert.ok(!codigo.includes(t), `${archivo}: reapareció «${t}»`);
  }
});

test('grupo A: toda clave tr.* que usan los archivos migrados existe en español e inglés y recibe sus variables', () => {
  const usadas = new Set<string>();
  for (const archivo of [...Object.keys(PROHIBIDOS), 'src/components/agente/store.ts', 'src/components/agente/format.ts']) {
    const codigo = leer(archivo);
    for (const m of codigo.matchAll(/\b(?:t|tx)\('(tr\.[\w.]+)'/g)) {
      const clave = m[1];
      if (!(clave in ES)) continue; // claves de otros grupos (b y c) las valida su propia prueba
      usadas.add(clave);
      const pedidas = variables(ES[clave]).split(',').filter(Boolean);
      if (pedidas.length === 0) continue;
      // Ventana tras la llamada: las variables van en el objeto que sigue a la clave.
      const ventana = codigo.slice(m.index!, m.index! + 700);
      for (const v of pedidas) assert.match(ventana, new RegExp(`[{,]\\s*${v}\\s*[:,}]`), `${archivo}: ${clave} no recibe {${v}}`);
    }
  }
  // Las claves referidas de forma indirecta (mapas de claves) también deben existir.
  for (const c of ['tr.ag.f1', 'tr.ag.f2', 'tr.ag.f3', 'tr.ag.f4', 'tr.ag.gAyer', 'tr.ag.g7', 'tr.ag.g30', 'tr.ag.gAnt']) assert.ok(c in ES, c);
  assert.ok(usadas.size > 100, 'se usan las claves del grupo: ' + usadas.size);
});
