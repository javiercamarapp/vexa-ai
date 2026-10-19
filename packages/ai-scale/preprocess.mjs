// SOBRE-REDACCIÓN: se conservan fechas válidas (ISO y d-m-a), versiones precedidas de palabra clave (v/versión/firmware/build) y SKUs
// alfanuméricos (ya no se redactan por ser largos; sí si contienen 8+ dígitos seguidos). NO se conserva '10.2.3.4' sin palabra clave: es
// indistinguible de una IPv4 y se prefiere redactar (riesgo de fuga > costo de contexto).
// NOTA: conversaciones con más de 40 mensajes se truncan a 6 primeros + 34 últimos (LIMITS). Nombres/direcciones NO se redactan (riesgo residual aceptado).
// Preprocesado LOCAL de una conversación antes de enviar texto a un LLM. Sin red, sin dependencias externas.
// Orden fijo: (1) REDACCIÓN del texto completo, (2) recorte de cola (historial citado, firmas, avisos legales),
// (3) tope por mensaje. Los pasos 2 y 3 SOLO truncan el final del texto ya redactado, de modo que los offsets
// (puntos de código Unicode) del texto enviado son idénticos a los del texto redactado completo.
import {redactText} from '../intelligence/redact.mjs';
import {sha256} from '../intelligence/index.mjs';

export const LIMITS=Object.freeze({maxMessages:40,headMessages:6,maxCharsPerMessage:3800,maxCharsConversation:24000,maxRawChars:100000});
// Política de redacción: la misma función de producción (emails, teléfonos) + una pasada propia para números largos.
export const REDACTION_POLICY=Object.freeze({version:'ia-escala-redact-v1',emails:true,phones:true,namesMode:'dictionary',names:[]});

// ---- Redacción ----
// Límite por mensaje ANTES de cualquier regex (ReDoS y costo); el texto enviado nunca pasa de 3800 puntos de código.
export const MAX_RAW_CHARS=20000;
// 1) Normalización: NFKC (fullwidth, compatibilidad), guiones y espacios raros -> ASCII, dígitos árabe-índicos -> ASCII,
//    caracteres invisibles fuera, rachas de relleno colapsadas. TODO lo posterior (corte de cola, offsets, citas) usa este texto.
export function normalizeText(text){
  if(typeof text!=='string')return '';
  let t=text.length>MAX_RAW_CHARS?text.slice(0,MAX_RAW_CHARS):text;
  if(!t.isWellFormed())t=t.toWellFormed();
  t=t.normalize('NFKC');
  // NFKC puede EXPANDIR (U+FDFA -> 18 caracteres): tope final DESPUÉS de normalizar (sin partir un par sustituto).
  if(t.length>MAX_RAW_CHARS){t=t.slice(0,MAX_RAW_CHARS);if(!t.isWellFormed())t=t.toWellFormed();}
  t=t.replace(/[\uE000-\uE0FF]/g,'') // uso interno como marcadores de protección
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g,'-')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g,' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g,'')
    .replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[\u06F0-\u06F9]/g,d=>String(d.charCodeAt(0)-0x6F0))
    .replace(/([ \t])\1{2,}/g,'$1$1').replace(/([-.=*~])\1{3,}/g,'$1$1$1').replace(/(?:[ \t]*\n){3,}/g,'\n\n');
  return t;
}
const PII='[PII]';
const SENSITIVE_KEY=/(?<![\p{L}\p{N}])(api[_ -]?key|apikey|access[_ -]?token|token|secret|password|passwd|pwd|contrase[ñn]a|clave|pin|bearer)(?![\p{L}\p{N}])(\s*(?:es|is|:|=|de acceso es)?\s*)(\S{4,200})/giu;
const secretLike=v=>/[\d!@#$%^&*_=+\/-]/.test(v)||/^(eyJ|sk_|pk_)/.test(v);
const URL_RE=/(?<![\p{L}\p{N}])(?:https?:\/\/|www\.)[^\s<>"')\]]{1,500}/giu;
const EMAIL_OBF=/[\p{L}\p{N}._%+-]{1,64}\s{0,3}(?:@|\[at\]|\(at\)|\(arroba\)|\[arroba\])\s{0,3}[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63}|\s{0,3}(?:\[dot\]|\(dot\)|\(punto\)|\s(?:punto|dot)\s)\s{0,3}[\p{L}\p{N}-]{1,63}){0,6}|[\p{L}\p{N}._%+-]{1,64}\s(?:\(arroba\)|arroba)\s[\p{L}\p{N}-]{1,63}(?:\s(?:punto|dot)\s[\p{L}\p{N}-]{1,63}){1,4}/giu;
const CURP=/(?<![\p{L}\p{N}])[A-ZÑ]{4}\d{6}[HM][A-ZÑ]{5}[A-Z0-9]\d(?![\p{L}\p{N}])/giu;
const RFC=/(?<![\p{L}\p{N}])[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}(?![\p{L}\p{N}])/giu;
const BASE64ISH=/(?<![\p{L}\p{N}_-])(?:eyJ[\w-]{5,}\.[\w-]{5,}(?:\.[\w-]*)?|(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+|[A-Za-z0-9_-]{32,})(?![\p{L}\p{N}_-])/gu;
const TOKEN_WITH_LONG_DIGITS=/[\p{L}\p{N}_#:/.-]{0,40}\d{8,}[\p{L}\p{N}_-]{0,40}/gu;
const SEPARATED_NUMBER=/(?<![\p{L}\p{N}])\+?\d(?:[ .,/-]{0,2}\d){8,30}(?![\p{L}\p{N}])/gu;
const IPV4=/(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g;
const DATE_LIKE=/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})(?: \d{1,2})?$/;
export function redact(text){
  let t=normalizeText(text);
  if(!t)return '';
  t=t.replace(URL_RE,u=>/[?#=@]|\d{6,}/.test(u)?PII:u)
    .replace(SENSITIVE_KEY,(m,k,sep,v)=>/^bearer$/i.test(k)||secretLike(v)?`${k}${sep}${PII}`:m)
    .replace(BASE64ISH,PII)
    .replace(EMAIL_OBF,PII)
    .replace(CURP,PII).replace(RFC,PII)
    .replace(SEPARATED_NUMBER,m=>DATE_LIKE.test(m)?m:PII)
    .replace(TOKEN_WITH_LONG_DIGITS,PII)
    .replace(IPV4,(m,off,str)=>VERSION_KW_BEFORE.test(str.slice(Math.max(0,off-14),off))?m:PII);
  // La función de teléfonos de producción toma por número las fechas y las versiones: se protegen con marcadores SIN dígitos
  // (solo fechas válidas y versiones precedidas de palabra clave; cualquier otra cosa sigue pasando por la redacción) y se restauran.
  const {text:p,saved}=protect(t);
  // El regex de correos de producción es cuadrático en rachas largas sin espacios (p. ej. CJK, 20k caracteres = 2.4 s). Se parten
  // las rachas >300 con un separador invisible interno (U+E0FF) SOLO para esa llamada y se quita después. Teléfonos/correos ya fueron
  // redactados por las pasadas propias de arriba; la de producción queda como respaldo.
  const chunked=p.replace(/[\p{L}\p{N}._%+-]{300,}/gu,run=>{const cps=Array.from(run);const parts=[];for(let i=0;i<cps.length;i+=200)parts.push(cps.slice(i,i+200).join(''));return parts.join('\uE0FF');});
  let out=redactText(chunked,REDACTION_POLICY).text.replace(/\uE0FF/g,'');
  return restore(out,saved);
}
const ISO_DATE=/(?<![\d-])(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\d-])/g;
const DMY_DATE=/(?<![\d\/.-])(?:0?[1-9]|[12]\d|3[01])[-\/.](?:0?[1-9]|[12]\d|3[01])[-\/.](?:19|20)\d{2}(?![\d\/.-])/g;
const VERSION_KW=/(?<![\p{L}\p{N}])((?:v|ver\.?|versi[óo]n|version|firmware|fw|build)\s?)(\d{1,3}(?:\.\d{1,3}){2,3})(?![\d.])/giu;
const VERSION_KW_BEFORE=/(?:^|[^\p{L}\p{N}])(?:v|ver\.?|versi[óo]n|version|firmware|fw|build)\s?$/iu;
const L='abcdefghijklmnopqrstuvwxyz';
const mark=i=>{let s='',n=i;do{s=L[n%26]+s;n=Math.floor(n/26)-1;}while(n>=0);return '\uE000'+s+'\uE001';};
function protect(t){
  const saved=[];const keep=m=>{saved.push(m);return mark(saved.length-1);};
  t=t.replace(ISO_DATE,keep).replace(DMY_DATE,keep).replace(VERSION_KW,(m,kw,num)=>kw+keep(num));
  return{text:t,saved};
}
function restore(t,saved){return saved.length?t.replace(/\uE000([a-z]+)\uE001/g,(m,s)=>{let n=0;for(const ch of s)n=n*26+(ch.charCodeAt(0)-96);return saved[n-1]??m;}):t;}

// ---- Recorte de cola ----
const QUOTE_HEADERS=[
  /^[ \t]*(?:El|On)\s.{3,200}?\b(?:escribi[óo]|wrote)\s*:?[ \t]*$/imu,
  /^[ \t]*-{2,}\s*(?:Original Message|Mensaje original|Mensaje reenviado|Forwarded message)\s*-{2,}/imu,
  /^[ \t]*_{10,}[ \t]*$/mu,
  /^[ \t]*(?:De|From)[ \t]*:[ \t].+\n[ \t]*(?:Enviado(?: el)?|Sent|Fecha|Date)\s*:/imu,
  /^[ \t]*Begin forwarded message:/imu,
];
const QUOTE_BLOCK=/(?:^|\n)(>[^\n]*\n){2,}/u; // 2+ líneas citadas consecutivas
const SIGNATURE_MARKERS=[
  /\n-- ?\n/u,
  /\n[ \t]*(?:Enviado desde mi (?:iPhone|iPad|Android|Samsung|dispositivo|móvil)|Sent from my [A-Za-z ]+|Obtener (?:Outlook|Gmail) para (?:iOS|Android)|Get Outlook for (?:iOS|Android))/iu,
  /\n[ \t]*(?:AVISO (?:DE )?(?:CONFIDENCIALIDAD|LEGAL)|Este (?:mensaje|correo|e-?mail)[^\n]{0,80}(?:confidencial|destinatario)|This (?:e-?mail|message)[^\n]{0,80}(?:confidential|intended))/iu,
];
const CLOSING=/\n[ \t]*(?:Saludos(?: cordiales)?|Atentamente|Quedo a sus órdenes|Cordialmente|Un saludo|Best regards|Kind regards|Regards|Gracias y saludos)[ \t]*[,.!]?[ \t]*\n/iu;

export function cutQuoted(text){
  let cut=text.length;
  for(const re of QUOTE_HEADERS){const m=re.exec(text);if(m&&m.index<cut)cut=m.index;}
  const b=QUOTE_BLOCK.exec(text);if(b&&b.index<cut)cut=b.index;
  return cut;
}
export function cutSignature(text,boilerplate){
  let cut=text.length;
  for(const re of SIGNATURE_MARKERS){const m=re.exec(text);if(m&&m.index<cut)cut=m.index;}
  // Despedida con firma corta debajo: solo si lo que sigue es breve (no se corta contenido real).
  const c=CLOSING.exec(text);if(c&&text.length-c.index<=400&&c.index<cut)cut=c.index;
  // Líneas finales que se repiten en muchos mensajes del corpus (firmas/pies repetidos).
  if(boilerplate?.size){
    const lines=text.slice(0,cut).split('\n');let end=lines.length,dropped=false;
    while(end>0){const norm=normLine(lines[end-1]);if(norm===''||boilerplate.has(norm)){if(norm!=='')dropped=true;end--;}else break;}
    if(dropped)cut=Math.min(cut,lines.slice(0,end).join('\n').length);
  }
  return cut;
}
export const normLine=l=>l.toLowerCase().replace(/\s+/g,' ').trim();

// Aprendizaje de pies repetidos: una línea final que aparece en >= minCount mensajes distintos (tras redactar) es firma.
export function learnBoilerplate(texts,{minCount=8,minShare=0.003,tailLines=8}={}){
  const counts=new Map();let n=0;
  for(const raw of texts){
    let t;try{t=redact(raw);}catch{continue;}n++;const lines=t.slice(0,cutQuoted(t)).split('\n').map(normLine).filter(Boolean).slice(-tailLines);
    for(const l of new Set(lines)){if(l.length>=4&&l.length<=200)counts.set(l,(counts.get(l)??0)+1);}
  }
  const th=Math.max(minCount,Math.ceil(n*minShare));
  return new Set([...counts].filter(([,c])=>c>=th).map(([l])=>l));
}

// ---- Notificaciones automáticas (regla) ----
const AUTO=[
  /\b(?:no[- ]?reply|noreply|do[- ]not[- ]reply|mailer-daemon|postmaster)\b/iu,
  /\b(?:delivery status notification|undeliverable|mail delivery (?:failed|subsystem)|returned mail)\b/iu,
  /\b(?:respuesta autom[áa]tica|auto-?reply|automatic reply|out of office|fuera de (?:la )?oficina|autorespuesta)\b/iu,
  /\b(?:este es un (?:correo|mensaje|e-?mail) (?:generado )?autom[áa]tic|esto es un mensaje autom[áa]tico|mensaje generado autom[áa]ticamente|no responda (?:a )?este (?:correo|mensaje))/iu,
  /\b(?:this is an automated (?:message|email)|automated notification|please do not reply)\b/iu,
  /\b(?:tu|su) (?:pedido|compra|paquete|env[ií]o) (?:ha sido|fue|est[áa]) (?:confirmad|enviad|entregad|procesad)/iu,
  /\b(?:confirmaci[óo]n de (?:pedido|compra|env[ií]o)|recibo de pago|your order (?:has|is)|order confirmation|shipping confirmation)\b/iu,
  /\b(?:newsletter|darse de baja|cancelar suscripci[óo]n|unsubscribe)\b/iu,
];
export function isAutomatic(text){const head=text.slice(0,1200);return AUTO.some(re=>re.test(head));}

// ---- Conversación completa ----
// conv = {conversation_id, messages:[{id, role, text, at?}]} (orden cronológico por `at` si existe).
export function prepareConversation(conv,{boilerplate=null,skipAutomatic=true,limits=LIMITS,redactFn=redact}={}){
  const stats={msgs_in:conv.messages.length,msgs_out:0,chars_in:0,chars_out:0,auto_dropped:0,truncated_conv:false};
  const seenIds=new Set();const uniq=conv.messages.filter(m=>{if(seenIds.has(m.id))return false;seenIds.add(m.id);return true;}); // jamás el mismo mensaje dos veces
  stats.dup_msgs=conv.messages.length-uniq.length;
  const msgs=[...uniq].sort((a,b)=>String(a.at??'').localeCompare(String(b.at??''))||0);
  const kept=[];
  let redactFailed=false;
  msgs.forEach((m,i)=>{
    if(redactFailed)return;
    const raw=typeof m.text==='string'?m.text:'';stats.chars_in+=raw.length;
    let full;try{full=redactFn(raw);}catch{redactFailed=true;return;}
    let cut=Math.min(cutQuoted(full),full.length);
    let head=full.slice(0,cut);
    cut=Math.min(cut,cutSignature(head,boilerplate));
    let text=full.slice(0,cut).trimEnd();
    if(!text){ // todo el mensaje era cita/firma: no se envía
      return;
    }
    if(skipAutomatic&&m.role==='customer'&&isAutomatic(text)){stats.auto_dropped++;return;}
    const pts=Array.from(text);
    if(pts.length>limits.maxCharsPerMessage)text=pts.slice(0,limits.maxCharsPerMessage).join('');
    kept.push({message_id:m.id,role:m.role,text,orig_index:i,keptLen:Array.from(text).length});
  });
  if(redactFailed)return{status:'skipped',reason:'redaccion_fallida',revisions:[],stats}; // nada se envía si la redacción falla
  let sel=kept;
  if(sel.length>limits.maxMessages){stats.truncated_conv=true;sel=[...sel.slice(0,limits.headMessages),...sel.slice(sel.length-(limits.maxMessages-limits.headMessages))];}
  let total=0;const fit=[];
  for(const r of sel){if(total+r.text.length>limits.maxCharsConversation){stats.truncated_conv=true;continue;}total+=r.text.length;fit.push(r);}
  stats.msgs_out=fit.length;stats.chars_out=total;
  const customer=fit.filter(r=>r.role==='customer');
  if(!customer.length){
    const autoOnly=stats.auto_dropped>0&&conv.messages.some(m=>m.role==='customer');
    return{status:'skipped',reason:autoOnly?'automatica':'sin_texto_cliente',revisions:[],stats};
  }
  return{status:'ok',reason:null,revisions:fit,stats,input_hash:sha256(JSON.stringify(fit.map(r=>[r.message_id,r.role,r.text])))};
}
