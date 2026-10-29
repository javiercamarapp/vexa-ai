// Configuración compartida del arnés de Chrome por CDP (T12).
// Todo lo que cambia entre corridas vive aquí; los demás módulos no repiten números.
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DIR_CDP = process.env.ROVAQ_CDP_DIR || join(homedir(), 'vexa-tools', 'cdp');
export const CHROME =
  process.env.ROVAQ_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const CANDADO = process.env.ROVAQ_CDP_CANDADO || '/tmp/chrome-cdp.lock';
export const CANDADO_MAX_EDAD_MS = 15 * 60 * 1000;

// Viewports de la sección 11: escritorio, tableta y móvil.
export const VIEWPORTS = {
  1440: { width: 1440, height: 900, movil: false },
  768: { width: 768, height: 1024, movil: false },
  390: { width: 390, height: 844, movil: true },
};

// Cuadros de la carga en milisegundos (sección 11 punto 2).
export const CUADROS_CARGA_MS = [0, 300, 700, 1100, 1500, 1900, 2400];

// Slow 4G de Lighthouse: 1.6 Mbps de bajada, 750 kbps de subida, 150 ms de latencia.
export const RED_SLOW_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.floor((750 * 1024) / 8),
};

// Umbrales de la Mac: el swap llenó el disco y hubo agentes detenidos (ver notas de carga).
export const UMBRAL_CARGA = {
  cargaMax: Number(process.env.ROVAQ_CARGA_MAX || 6), // promedio de 1 min
  swapUsadoMaxPct: Number(process.env.ROVAQ_SWAP_MAX_PCT || 92),
  esperaMaxMs: Number(process.env.ROVAQ_ESPERA_MAX_MS || 10 * 60 * 1000),
  sondeoMs: 15_000,
};

// Argumentos de Chrome: GPU de Metal por defecto, WebGL apagado cuando se pide.
export const ARGS_GPU = ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'];
export const ARGS_SIN_WEBGL = ['--disable-gpu', '--disable-3d-apis'];

export const COLOR_ACENTO = { r: 0xe8, g: 0x24, b: 0x1c };

// Cadencia de cuadros: sin esto el Chrome headless de la Mac limita requestAnimationFrame a 30 fps.
export const ARGS_CUADROS = (process.env.ROVAQ_ARGS_CUADROS ?? '--disable-frame-rate-limit').split(' ').filter(Boolean);
