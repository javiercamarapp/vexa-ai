import type {Idioma} from './idioma';

/**
 * Textos mínimos de la pantalla de último recurso (global-error). Viven aparte del diccionario completo porque el límite de error raíz
 * se carga en TODAS las páginas, también en el sitio público, y importar el diccionario entero le sumaba cientos de KB de JS a rovaq.ai.
 * La prueba tests/error-raiz-paridad.test.ts exige que cada texto coincida con el del diccionario ES/EN.
 */
export const TEXTOS_ERROR_RAIZ = {
  es: {
    'comun.reintentar': 'Volver a intentar',
    'det.irAHoy': 'Ir a Hoy',
    'tr.err.chunk': 'La aplicación se actualizó mientras la tenías abierta. Recarga la página para continuar; no se ha confirmado ninguna operación desde esta pantalla.',
    'tr.err.recargando': 'Recargando…',
    'tr.err.recargar': 'Recargar la página',
    'tr.err.sinConfirmar': 'No se pudo confirmar el estado del servicio. Vuelve a intentarlo; no se ha confirmado ninguna operación desde esta pantalla.',
    'tr.err.titulo': 'No pudimos abrir esta página',
  },
  en: {
    'comun.reintentar': 'Try again',
    'det.irAHoy': 'Go to Today',
    'tr.err.chunk': 'The application was updated while you had it open. Reload the page to continue; no operation has been confirmed from this screen.',
    'tr.err.recargando': 'Reloading…',
    'tr.err.recargar': 'Reload the page',
    'tr.err.sinConfirmar': 'We could not confirm the state of the service. Try again; no operation has been confirmed from this screen.',
    'tr.err.titulo': 'We could not open this page',
  },
} as const;

export type ClaveErrorRaiz = keyof (typeof TEXTOS_ERROR_RAIZ)['es'];

export const textoErrorRaiz = (idioma: Idioma, clave: ClaveErrorRaiz): string => TEXTOS_ERROR_RAIZ[idioma][clave];
