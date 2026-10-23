// Extractor de ESTADO (EE. UU. y México) a partir de texto libre de una dirección. Función pura y sin red.
// Contrato de privacidad: recibe el texto, devuelve SOLO un código de estado ({pais, codigo}) o null. El texto jamás se guarda, se registra ni se devuelve.
// Orden de decisión (la primera regla que acierta gana):
//   1. Nombre completo de estado de EE. UU. (sin que siga un tipo de vía: «Florida Ave» no es Florida).
//   2. Nombre de estado de México (o CDMX/Edomex) o «Estado de México».
//   3. Abreviatura de EE. UU. SOLO en forma «, XX 12345» o «, XX» al final / antes de «USA» (evita confundir IN, OR, ME, OK, LA, DE… con palabras).
//   4. Código postal de 5 dígitos: con marca explícita de México -> tabla CP->estado de México; si no, tabla ZIP3->estado de EE. UU. (el negocio vende en EE. UU.: un CP suelto se lee como ZIP).
export const ESTADOS_US = Object.freeze({AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Distrito de Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawái', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Luisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Míchigan', MN: 'Minnesota', MS: 'Misisipi', MO: 'Misuri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'Nuevo Hampshire', NJ: 'Nueva Jersey', NM: 'Nuevo México (EE. UU.)', NY: 'Nueva York', NC: 'Carolina del Norte', ND: 'Dakota del Norte', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregón', PA: 'Pensilvania', RI: 'Rhode Island', SC: 'Carolina del Sur', SD: 'Dakota del Sur', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'Virginia Occidental', WI: 'Wisconsin', WY: 'Wyoming'});
// Códigos ISO 3166-2:MX.
export const ESTADOS_MX = Object.freeze({AGU: 'Aguascalientes', BCN: 'Baja California', BCS: 'Baja California Sur', CAM: 'Campeche', CHP: 'Chiapas', CHH: 'Chihuahua', CMX: 'Ciudad de México', COA: 'Coahuila', COL: 'Colima', DUR: 'Durango', GUA: 'Guanajuato', GRO: 'Guerrero', HID: 'Hidalgo', JAL: 'Jalisco', MEX: 'Estado de México', MIC: 'Michoacán', MOR: 'Morelos', NAY: 'Nayarit', NLE: 'Nuevo León', OAX: 'Oaxaca', PUE: 'Puebla', QUE: 'Querétaro', ROO: 'Quintana Roo', SLP: 'San Luis Potosí', SIN: 'Sinaloa', SON: 'Sonora', TAB: 'Tabasco', TAM: 'Tamaulipas', TLA: 'Tlaxcala', VER: 'Veracruz', YUC: 'Yucatán', ZAC: 'Zacatecas'});

const sinAcentos = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const NOMBRES_US = {ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE', 'DISTRICT OF COLUMBIA': 'DC', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY'};
const NOMBRES_MX = {AGUASCALIENTES: 'AGU', 'BAJA CALIFORNIA SUR': 'BCS', 'BAJA CALIFORNIA': 'BCN', CAMPECHE: 'CAM', CHIAPAS: 'CHP', CHIHUAHUA: 'CHH', 'CIUDAD DE MEXICO': 'CMX', CDMX: 'CMX', 'DISTRITO FEDERAL': 'CMX', COAHUILA: 'COA', COLIMA: 'COL', DURANGO: 'DUR', GUANAJUATO: 'GUA', GUERRERO: 'GRO', HIDALGO: 'HID', JALISCO: 'JAL', 'ESTADO DE MEXICO': 'MEX', EDOMEX: 'MEX', MICHOACAN: 'MIC', MORELOS: 'MOR', NAYARIT: 'NAY', 'NUEVO LEON': 'NLE', OAXACA: 'OAX', PUEBLA: 'PUE', QUERETARO: 'QUE', 'QUINTANA ROO': 'ROO', 'SAN LUIS POTOSI': 'SLP', SINALOA: 'SIN', SONORA: 'SON', TABASCO: 'TAB', TAMAULIPAS: 'TAM', TLAXCALA: 'TLA', VERACRUZ: 'VER', YUCATAN: 'YUC', ZACATECAS: 'ZAC'};
const VIA = '(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|WAY|CT|COURT|PL|PLACE|PKWY|PARKWAY|HWY|HIGHWAY|CIR|CIRCLE|TRL|TRAIL|TER|TERRACE|SQ|CALLE|AV|AVENIDA)';
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const porLargo = o => Object.keys(o).sort((a, b) => b.length - a.length);
const RE_NOMBRE_US = new RegExp(`(?:^|[^A-Z])(${porLargo(NOMBRES_US).map(escapar).join('|')})(?![A-Z])(?!\\s+${VIA}\\b)`);
const RE_NOMBRE_MX = new RegExp(`(?:^|[^A-Z])(${porLargo(NOMBRES_MX).map(escapar).join('|')})(?![A-Z])`);
const ABREV_US = Object.keys(ESTADOS_US).join('|');
const RE_ABREV_CP = new RegExp(`(?:^|[,\\s])(${ABREV_US})\\.?[\\s,]+\\d{5}(?:-\\d{4})?(?!\\d)`);
const RE_ABREV_FIN = new RegExp(`,\\s*(${ABREV_US})\\.?\\s*(?:,\\s*(?:USA|US|U\\.S\\.A?\\.?|UNITED STATES(?: OF AMERICA)?))?\\s*$`);
const RE_MARCA_MX = /(?:^|[^A-Z])(?:MEXICO|MEX\.|MX|C\.P\.|COL\.|COLONIA)(?![A-Z])/;
const RE_CP = /(?:^|[^0-9])(\d{5})(?:-\d{4})?(?![0-9])/;

/** ZIP3 -> estado (rangos USPS aproximados; los ZIP que cruzan frontera de estado son raros y se asignan al estado mayoritario del prefijo). */
const RANGOS_ZIP3 = [['AL', [[350, 352], [354, 369]]], ['AK', [[995, 999]]], ['AZ', [[850, 850], [852, 853], [855, 857], [859, 860], [863, 865]]], ['AR', [[716, 729], [755, 755]]], ['CA', [[900, 908], [910, 928], [930, 961]]], ['CO', [[800, 816]]],
  ['CT', [[60, 69]]], ['DE', [[197, 199]]], ['DC', [[200, 200], [202, 205], [569, 569]]], ['FL', [[320, 339], [341, 342], [344, 344], [346, 347], [349, 349]]], ['GA', [[300, 319], [398, 399]]], ['HI', [[967, 968]]], ['ID', [[832, 838]]], ['IL', [[600, 629]]],
  ['IN', [[460, 479]]], ['IA', [[500, 516], [520, 528]]], ['KS', [[660, 662], [664, 679]]], ['KY', [[400, 427]]], ['LA', [[700, 701], [703, 708], [710, 714]]], ['ME', [[39, 49]]], ['MD', [[206, 212], [214, 219]]], ['MA', [[10, 27], [55, 55]]],
  ['MI', [[480, 499]]], ['MN', [[550, 567]]], ['MS', [[386, 397]]], ['MO', [[630, 631], [633, 641], [644, 658]]], ['MT', [[590, 599]]], ['NE', [[680, 681], [683, 693]]], ['NV', [[889, 891], [893, 898]]], ['NH', [[30, 38]]], ['NJ', [[70, 89]]],
  ['NM', [[870, 871], [873, 884]]], ['NY', [[5, 5], [100, 149]]], ['NC', [[270, 289]]], ['ND', [[580, 588]]], ['OH', [[430, 459]]], ['OK', [[730, 731], [734, 741], [743, 749]]], ['OR', [[970, 979]]], ['PA', [[150, 196]]], ['RI', [[28, 29]]],
  ['SC', [[290, 299]]], ['SD', [[570, 577]]], ['TN', [[370, 385]]], ['TX', [[733, 733], [750, 799], [885, 885]]], ['UT', [[840, 847]]], ['VT', [[50, 54], [56, 59]]], ['VA', [[201, 201], [220, 246]]], ['WA', [[980, 986], [988, 994]]],
  ['WV', [[247, 268]]], ['WI', [[530, 532], [534, 535], [537, 549]]], ['WY', [[820, 831], [834, 834]]]];
const ZIP3 = new Map();
for (const [st, rs] of RANGOS_ZIP3) for (const [a, b] of rs) for (let z = a; z <= b; z++) ZIP3.set(z, st);
/** Prefijo de 2 dígitos del CP mexicano (SEPOMEX) -> estado. Aproximado: algunos CP fronterizos de estado caen en el vecino. */
const RANGOS_CP_MX = [['CMX', 1, 16], ['AGU', 20, 20], ['BCN', 21, 22], ['BCS', 23, 23], ['CAM', 24, 24], ['COA', 25, 27], ['COL', 28, 28], ['CHP', 29, 30], ['CHH', 31, 33], ['DUR', 34, 35], ['GUA', 36, 38], ['GRO', 39, 41], ['HID', 42, 43], ['JAL', 44, 49],
  ['MEX', 50, 57], ['MIC', 58, 61], ['MOR', 62, 62], ['NAY', 63, 63], ['NLE', 64, 67], ['OAX', 68, 71], ['PUE', 72, 75], ['QUE', 76, 76], ['ROO', 77, 77], ['SLP', 78, 79], ['SIN', 80, 82], ['SON', 83, 85], ['TAB', 86, 86], ['TAM', 87, 89], ['TLA', 90, 90], ['VER', 91, 96], ['YUC', 97, 97], ['ZAC', 98, 99]];
const CP_MX = new Map();
for (const [st, a, b] of RANGOS_CP_MX) for (let z = a; z <= b; z++) CP_MX.set(z, st);
export const estadoDeZip = zip5 => { const z = String(zip5 ?? ''); return /^\d{5}$/.test(z) ? ZIP3.get(Number(z.slice(0, 3))) ?? null : null; };
export const estadoDeCpMx = cp5 => { const z = String(cp5 ?? ''); return /^\d{5}$/.test(z) ? CP_MX.get(Number(z.slice(0, 2))) ?? null : null; };

/** @returns {{pais:'US'|'MX', codigo:string, via:'nombre'|'abreviatura'|'codigo_postal'} | null} */
export function estadoDeDireccion(texto) {
  const t = sinAcentos(texto).replace(/\s+/g, ' ').trim();
  if (!t || t.length > 400) return null;
  let m = RE_NOMBRE_US.exec(t);
  if (m) return {pais: 'US', codigo: NOMBRES_US[m[1]], via: 'nombre'};
  m = RE_ABREV_CP.exec(t) ?? RE_ABREV_FIN.exec(t);
  if (m) return {pais: 'US', codigo: m[1], via: 'abreviatura'};
  m = RE_NOMBRE_MX.exec(t);
  if (m) return {pais: 'MX', codigo: NOMBRES_MX[m[1]], via: 'nombre'};
  m = RE_CP.exec(t);
  if (m) {
    if (RE_MARCA_MX.test(t)) { const e = estadoDeCpMx(m[1]); return e ? {pais: 'MX', codigo: e, via: 'codigo_postal'} : null; }
    const e = estadoDeZip(m[1]);
    return e ? {pais: 'US', codigo: e, via: 'codigo_postal'} : null;
  }
  return null;
}
export const claveEstado = e => (e ? `${e.pais}-${e.codigo}` : null);
export const nombreEstado = clave => { const [p, c] = String(clave).split('-'); return (p === 'US' ? ESTADOS_US[c] : p === 'MX' ? ESTADOS_MX[c] : null) ?? null; };
