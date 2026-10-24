/**
 * Logos de integraciones para BrandMark.
 *
 * Los trazados (path, viewBox 0 0 24 24) vienen del paquete público `simple-icons` v16.35.0 (licencia CC0 1.0, dominio público;
 * https://github.com/simple-icons/simple-icons). El paquete NO es dependencia de este repositorio: solo se copian los trazados necesarios.
 * Las marcas pertenecen a sus respectivos dueños (HubSpot, Shopify, Zendesk, Google, etc.) y se usan únicamente para identificar la integración
 * de la que vienen los datos; no implican respaldo ni alianza.
 *
 * Marcas SIN logo oficial en simple-icons (retiradas a petición de sus dueños): Amazon, Walmart, Best Buy y Microsoft Excel.
 * No se inventan logos: usan un monograma neutro (inicial en un cuadro). CSV y Excel usan un icono genérico de archivo de tabla, propio.
 * Sin scripts, sin estilos ni referencias externas: cada logo es un único <path> con relleno.
 */
export type LogoMarca={tipo:'logo';nombre:string;color:string;path:string};
export type MonogramaMarca={tipo:'monograma';nombre:string;letras:string};
export type ArchivoMarca={tipo:'archivo';nombre:string;etiqueta:string};
export type DefMarca=LogoMarca|MonogramaMarca|ArchivoMarca;
const LOGOS_SIMPLE:Record<string,{nombre:string;color:string;path:string}>={
 'hubspot': {nombre: 'HubSpot', color: '#FF7A59', path: 'M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z'},
 'shopify': {nombre: 'Shopify', color: '#7AB55C', path: 'M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z'},
 'zendesk': {nombre: 'Zendesk', color: '#03363D', path: 'M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z'},
 'google': {nombre: 'Google', color: '#4285F4', path: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z'},
 'gmail': {nombre: 'Gmail', color: '#EA4335', path: 'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z'},
 'google-sheets': {nombre: 'Google Sheets', color: '#34A853', path: 'M11.318 12.545H7.91v-1.909h3.41v1.91zM14.728 0v6h6l-6-6zm1.363 10.636h-3.41v1.91h3.41v-1.91zm0 3.273h-3.41v1.91h3.41v-1.91zM20.727 6.5v15.864c0 .904-.732 1.636-1.636 1.636H4.909a1.636 1.636 0 0 1-1.636-1.636V1.636C3.273.732 4.005 0 4.909 0h9.318v6.5h6.5zm-3.273 2.773H6.545v7.909h10.91v-7.91zm-6.136 4.636H7.91v1.91h3.41v-1.91z'},
 'openrouter': {nombre: 'OpenRouter', color: '#94A3B8', path: 'M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z'},
 'anthropic': {nombre: 'Anthropic', color: '#191919', path: 'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z'},
 'supabase': {nombre: 'Supabase', color: '#3FCF8E', path: 'M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z'},
 'whatsapp': {nombre: 'WhatsApp', color: '#25D366', path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'},
 'elevenlabs': {nombre: 'ElevenLabs', color: '#000000', path: 'M4.6035 0v24h4.9317V0zm9.8613 0v24h4.9317V0z'},
};
export const MARCAS:Record<string,DefMarca>={
 ...Object.fromEntries(Object.entries(LOGOS_SIMPLE).map(([k,v])=>[k,{tipo:'logo' as const,...v}])),
 amazon:{tipo:'monograma',nombre:'Amazon',letras:'A'},
 walmart:{tipo:'monograma',nombre:'Walmart',letras:'W'},
 bestbuy:{tipo:'monograma',nombre:'Best Buy',letras:'BB'},
 excel:{tipo:'archivo',nombre:'Excel',etiqueta:'XLS'},
 csv:{tipo:'archivo',nombre:'CSV',etiqueta:'CSV'},
};
export type MarcaClave=keyof typeof MARCAS|(string&{});
/** Superficies sobre las que se dibuja el logo (tokens --ui-surface de cada tema). */
export const SUPERFICIE={claro:'#ffffff',oscuro:'#17171a'} as const;
const lum=(h:string)=>[1,3,5].reduce((a,i,k)=>{let c=parseInt(h.slice(i,i+2),16)/255;c=c<=.03928?c/12.92:((c+.055)/1.055)**2.4;return a+c*[.2126,.7152,.0722][k];},0);
export const contraste=(a:string,b:string)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return(x+.05)/(y+.05);};
/** En tema oscuro el logo pasa a monocromo (tinta) cuando su color de marca no contrasta >= 3:1 con la superficie. */
export const monoEnOscuro=(m:DefMarca)=>m.tipo==='logo'&&contraste(m.color,SUPERFICIE.oscuro)<3;

const sinAcentos=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Reglas en orden: textos que NO son una sola integración (libros agregados, adjuntos) devuelven null aunque nombren una marca. */
const REGLAS:[RegExp,string][]=[
 [/\bhub ?spot\b/,'hubspot'],[/\bshopify\b/,'shopify'],[/\bzendesk\b/,'zendesk'],[/\bamazon\b/,'amazon'],[/\bwalmart\b/,'walmart'],
 [/\bbest ?buy\b|\bmirakl\b/,'bestbuy'],[/\bexcel\b|\bxlsx?\b|\btracker\b/,'excel'],[/\bcsv\b/,'csv'],
 [/\bopenrouter\b/,'openrouter'],[/\banthropic\b/,'anthropic'],[/\bgmail\b/,'gmail'],[/\bgoogle sheets\b|\bhoja de calculo en linea\b/,'google-sheets'],[/\bgoogle\b/,'google'],
 [/\bsupabase\b/,'supabase'],[/\bwhatsapp\b/,'whatsapp'],[/\belevenlabs\b/,'elevenlabs'],
];
const AGREGADOS=/\blibro\b|\bmarketplaces\b|\badjuntos?\b|\basociaciones\b/;
/**
 * Marca de una fuente/canal a partir de su nombre o clave («HubSpot (tickets)», «Tracker (Excel)», «Best Buy US (Mirakl)», `bestbuy`, `xlsx`…).
 * Devuelve la clave de MARCAS o null si no hay exactamente una marca reconocible (textos agregados como «Libro de pedidos» -> null).
 */
export function marcaDe(texto:unknown):string|null{
 if(typeof texto!=='string'||!texto.trim())return null;
 const t=sinAcentos(texto).replace(/[_-]+/g,' ');
 if(/\bcsv conversations\b/.test(t))return 'csv';
 if(AGREGADOS.test(t))return null;
 const hallazgos=new Set<string>();
 for(const[re,clave]of REGLAS)if(re.test(t)){
  if(clave==='google'&&(hallazgos.has('google-sheets')||hallazgos.has('gmail')))continue;
  hallazgos.add(clave);
 }
 return hallazgos.size===1?[...hallazgos][0]:null;
}
