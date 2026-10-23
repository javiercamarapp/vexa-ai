// Enmascarado de PRESENTACIÓN de nombres y direcciones de terceros en texto de conversación (R2-2-004).
// Función pura, sin red. NO modifica la base: redacted_text y message_revisions siguen intactos (hash y citas verificables se calculan sobre el ORIGINAL);
// esta función solo se aplica al texto que se MUESTRA o se EXPORTA.
//
// Alcance honesto: solo patrones ESTRUCTURALES de alta precisión. No es detección de nombres (NER): deja pasar nombres sin patrón
// (p. ej. «mi jefe Carlos dijo…», «this is Frank from…», firmas sin cierre, nombres en minúsculas, nombres de organizaciones o de negocios) y direcciones sin sufijo de calle o sin CP
// («Lakewood, NJ» a secas, «vivo en Mérida»). Tampoco traduce el texto: una cita en inglés se muestra en inglés. Nunca debe presentarse como redacción completa.
//
// Patrones: (1) encabezado de correo citado «On …, Nombre <correo> wrote:» / «El …, Nombre escribió:»; (2) líneas From/To/Cc/Bcc/De/Para/Cc;
// (3) saludo al inicio de línea «Hello|Hi|Dear|Hey|Hola|Estimado/a Nombre,»; (4) cierre simple «Thanks, Nombre» / «Saludos,\nNombre»;
// (5) dirección postal «número calle sufijo … ciudad, ESTADO CP5» (EE. UU.), «ciudad, ESTADO CP5» suelto y «calle/av. … número … C.P. 5 dígitos» (México);
// (6) saludos y cierres también a mitad de línea tras un punto o comillas, sin coma tras «Thanks/Regards», y en inglés, español, francés, portugués, alemán e italiano;
// (7) los marcadores técnicos «[PII]» / «[REDACTED]» de la redacción en base se rotulan «[dato personal oculto]» (solo al mostrar; la base no cambia).
export const MARCA_NOMBRE = '[nombre]';
export const MARCA_DIRECCION = '[dirección]';
export const MARCA_PII = '[dato personal oculto]';
export const AVISO_ENMASCARADO = 'Se ocultan patrones frecuentes de nombres y direcciones, pero el texto puede seguir conteniendo datos de terceros.';

const TOKEN = String.raw`(?:\p{Lu}\p{Ll}[\p{L}'’-]*|\p{Lu}\.)`;
const NOMBRE = String.raw`${TOKEN}(?:[ \t]+${TOKEN}){0,2}`;
// Palabras con forma de nombre que NO son personas: no se enmascaran (saludos a equipos, «Hello World», etc.).
const NO_PERSONA = new Set(['world', 'team', 'all', 'everyone', 'everybody', 'there', 'sir', 'madam', 'support', 'customer', 'service', 'sales', 'again', 'guys', 'folks', 'friends',
  'equipo', 'todos', 'todas', 'soporte', 'cliente', 'clientes', 'servicio', 'ventas', 'gracias', 'amigos', 'estimados', 'atención', 'atencion', 'team,', 'hello', 'hi', 'dear', 'thanks', 'regards', 'best',
  'order', 'orders', 'pedido', 'help', 'ayuda', 'customer service', 'concern', 'whom',
  'amazon', 'walmart', 'shopify', 'zendesk', 'hubspot', 'google', 'apple', 'target', 'costco', 'lowes', 'depot', 'ebay', 'paypal', 'fedex', 'ups', 'usps', 'dhl', 'mercado', 'libre', 'tool', 'tools', 'warranty', 'garantía', 'garantia', 'you', 'much', 'so', 'a', 'lot', 'very', 'for', 'your', 'the', 'bonjour', 'merci', 'hallo', 'danke', 'olá', 'ola', 'obrigado', 'obrigada', 'grazie', 'ciao', 'monsieur', 'madame', 'équipe', 'equipe', 'allen', 'alle']);
const esPersona = nombre => {
  const limpio = nombre.replace(/^(?:Mr|Mrs|Ms|Miss|Dr|Sr|Sra|Srta|Lic|Ing)\.?\s+/u, '').trim();
  if (!limpio) return false;
  const palabras = limpio.toLowerCase().split(/\s+/);
  return !palabras.some(p => NO_PERSONA.has(p.replace(/[.,]$/, '')));
};
const TITULO = String.raw`(?:(?:Mr|Mrs|Ms|Miss|Dr|Sr|Sra|Srta|Lic|Ing)\.?[ \t]+)?`;

let cuenta = 0;

// (5) Direcciones postales. Primero, para que la fecha/hora de un encabezado no las confunda.
const DIR_US = new RegExp(String.raw`\b\d{1,6}[ \t]+(?:(?:N|S|E|W|North|South|East|West)\.?[ \t]+)?(?:[\p{Lu}\d][\p{L}\d'’.-]*[ \t]+){0,4}?(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pkwy|Parkway|Pl|Place)\b\.?(?:[,\s]+(?:(?:Apt|Apartment|Suite|Ste|Unit|Fl|Floor)\.?[ \t]*#?[\w-]+|#[\w-]+)(?=[,\s]))?[,\s]+\p{Lu}[\p{L}.'’-]*(?:[ \t]+\p{Lu}[\p{L}.'’-]*){0,3}[ \t]*,?[ \t]*[A-Z]{2}[ \t]+\d{5}(?:-\d{4})?\b`, 'gu');
const DIR_MX = new RegExp(String.raw`\b(?:calle|av\.?|avenida|blvd\.?|boulevard|calzada|privada|paseo|andador|prolongaci[óo]n|carretera)[ \t]+[^\n]{2,70}?(?:[ \t]*(?:#|No\.?|n[úu]m\.?)[ \t]*)?\d{1,6}[^\n]{0,90}?\bC\.?[ \t]?P\.?[ \t]*\d{5}\b`, 'giu');

function direcciones(t) {
  return t.replace(DIR_US, () => { cuenta++; return MARCA_DIRECCION; }).replace(DIR_MX, () => { cuenta++; return MARCA_DIRECCION; });
}

// (1) «On <fecha>, Nombre <correo|[PII]> wrote:» (y «El …, Nombre escribió:»), con o sin marcas de cita «>».
const ENC = new RegExp(String.raw`^([ \t>]*(?:On|El|Le|Am|Em|Il)\b)([^\n]*?)([ \t]*(?:<[^>\n]*>|\[(?:[A-Z_]+|dato personal oculto)\]|\([^)\n]*\))?[ \t]*(?:wrote|escribi[óo]|a[ \t]+[ée]crit|schrieb|escreveu|ha[ \t]+scritto)[ \t]*:)`, 'gmu');
const COLA_NOMBRE = new RegExp(String.raw`^(.*?)(["“]?)(${NOMBRE})(["”]?[ \t]*)$`, 'su');
// Alemán: «Am <fecha> schrieb Nombre <correo>:» (el nombre va DESPUÉS del verbo).
const ENC_DE = new RegExp(String.raw`^([ \t>]*Am\b[^\n]*?\d[^\n]*?schrieb[ \t]+)(${NOMBRE})(?=[ \t]*(?:<[^>\n]*>|\[(?:[A-Z_]+|dato personal oculto)\]|:))`, 'gmu');
function encabezados(t) {
  t = t.replace(ENC_DE, (todo, ini, nombre) => { if (!esPersona(nombre)) return todo; cuenta++; return ini + MARCA_NOMBRE; });
  return t.replace(ENC, (todo, ini, medio, fin) => {
    const m = COLA_NOMBRE.exec(medio.replace(/[ \t]+$/, ''));
    if (!m || !esPersona(m[3])) return todo;
    // El nombre debe venir tras una fecha/hora o coma: exige al menos un dígito antes (fecha) para no tocar frases ordinarias.
    if (!/\d/.test(m[1])) return todo;
    cuenta++;
    return ini + m[1] + m[2] + MARCA_NOMBRE + m[4].trimEnd() + fin;
  });
}

// (2) Líneas From/To/Cc/Bcc/De/Para/Cc: nombre seguido de <correo> / [PII], o línea que es solo un nombre.
const CAB = /^([ \t>]*(?:From|To|Cc|Bcc|De|Para|CC|Enviado por|Reply-To|Sender|Von|An|Da|À|Remitente|Destinatario|Expéditeur|Destinataire|Remetente)[ \t]*:[ \t]*)(.+)$/gmu;
const NOMBRE_ANTES_DIR = new RegExp(String.raw`(["“]?)(${NOMBRE})(["”]?)(?=[ \t]*(?:<[^>\n]*>|\[(?:[A-Z_]+|dato personal oculto)\]))`, 'gu');
const SOLO_NOMBRE = new RegExp(String.raw`^${NOMBRE}$`, 'u');
function cabeceras(t) {
  return t.replace(CAB, (todo, ini, valor) => {
    const v = valor.trim();
    if (SOLO_NOMBRE.test(v)) { if (!esPersona(v)) return todo; cuenta++; return ini + MARCA_NOMBRE; }
    let cambio = false;
    const salida = valor.replace(NOMBRE_ANTES_DIR, (x, a, n, b) => { if (!esPersona(n)) return x; cambio = true; cuenta++; return MARCA_NOMBRE; });
    return cambio ? ini + salida : todo;
  });
}

// (3) Saludo al inicio de línea o de frase (tras . ! ? : comillas o «>»), solo si tras el nombre hay signo o fin de línea. «Hello world», «Hola, necesito ayuda» no entran.
const HOLA = String.raw`(?:Hello|Hi|Hey|Dear|Good (?:morning|afternoon|evening)|Hola|Estimad[oa]s?|Querid[oa]s?|Buen[oa]s (?:d[íi]as|tardes|noches)|Bonjour|Salut|Cher|Chère|Ol[áa]|Oi|Prezad[oa]s?|Caro|Cara|Hallo|Liebe[rn]?|Sehr geehrte[rn]?|Gentile|Ciao|Buongiorno)`;
const SALUDO = new RegExp(String.raw`(^[ \t>]*|[.!?:;"“”»][ \t]*|[ \t]>[ \t]*)(${HOLA}[ \t]+${TITULO})(${NOMBRE})(?=[ \t]*(?:[,!:;.]|$))`, 'gmu');
function saludos(t) {
  return t.replace(SALUDO, (todo, pre, ini, nombre) => { if (!esPersona(nombre)) return todo; cuenta++; return pre + ini + MARCA_NOMBRE; });
}

// (4) Cierre: «Thanks, Nombre» en la misma línea, con o sin coma si el nombre cierra la línea, o cierre con coma y el nombre solo en la línea siguiente.
const CIERRE = String.raw`(?:Thanks|Thank you|Many thanks|Thanks again|Regards|Best regards|Kind regards|Warm regards|Best wishes|Best|Sincerely|Yours sincerely|Cheers|Gracias|Muchas gracias|Saludos|Saludos cordiales|Un saludo|Atentamente|Cordialmente|Cordialement|Bien cordialement|Merci|Obrigad[oa]|Atenciosamente|Cumprimentos|Danke|Mit freundlichen Gr[üu](?:ß|ss)en|Viele Gr[üu](?:ß|ss)e|Grazie|Cordiali saluti|Distinti saluti)`;
const CIERRE_MISMA = new RegExp(String.raw`^([ \t>]*${CIERRE}[ \t]*,[ \t]*)(${NOMBRE})([ \t]*[.!]?[ \t]*)$`, 'gmu');
const CIERRE_SIN_COMA = new RegExp(String.raw`^([ \t>]*${CIERRE}[ \t]+)(${NOMBRE})([ \t]*[.!]?[ \t]*)$`, 'gmu');
const CIERRE_SIG = new RegExp(String.raw`^([ \t>]*${CIERRE}[ \t]*,?[ \t]*\r?\n[ \t>]*)(${NOMBRE})([ \t]*)$`, 'gmu');
const CIERRE_FRASE = new RegExp(String.raw`([.!?][ \t]+${CIERRE}[ \t]*,[ \t]*)(${NOMBRE})([ \t]*[.!]?[ \t]*)$`, 'gmu');
function cierres(t) {
  const f = (todo, ini, nombre, fin) => { if (!esPersona(nombre)) return todo; cuenta++; return ini + MARCA_NOMBRE + fin; };
  return t.replace(CIERRE_MISMA, f).replace(CIERRE_SIN_COMA, f).replace(CIERRE_SIG, f).replace(CIERRE_FRASE, f);
}

// (5b) «Ciudad, ST 12345» suelto (con CP de 5 dígitos): la ciudad y el estado de una dirección sin calle. Sin CP no se toca («Austin, TX» a secas es texto ordinario).
const ESTADOS_US = 'A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY]';
const CIUDAD_ESTADO_CP = new RegExp(String.raw`\b\p{Lu}[\p{L}'’.-]+(?:[ \t]+\p{Lu}[\p{L}'’.-]+){0,2}[ \t]*,[ \t]*(?:${ESTADOS_US})[ \t]+\d{5}(?:-\d{4})?\b`, 'gu');
const ciudades = t => t.replace(CIUDAD_ESTADO_CP, () => { cuenta++; return MARCA_DIRECCION; });

/** Devuelve {texto, cambios}: el texto con patrones estructurales de nombres/direcciones sustituidos, y cuántas sustituciones hizo. */
export function enmascararConConteo(texto) {
  cuenta = 0;
  if (typeof texto !== 'string' || !texto) return {texto: typeof texto === 'string' ? texto : '', cambios: 0};
  let t = texto;
  t = direcciones(t); t = ciudades(t); t = encabezados(t); t = cabeceras(t); t = saludos(t); t = cierres(t);
  // (7) Rótulo legible para los marcadores técnicos de la redacción en base (después de las reglas que los usan como ancla).
  t = t.replace(/\[(?:PII|REDACTED)\]/g, MARCA_PII);
  return {texto: t, cambios: cuenta};
}
/** Texto para MOSTRAR o EXPORTAR. Idempotente. No usar para calcular hashes ni para verificar citas (eso va sobre el original). */
export const enmascararTerceros = texto => enmascararConConteo(texto).texto;
