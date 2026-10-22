// Etiquetas en español de las categorías de la IA («Familia: Subcategoría», taxonomía de 45 entradas
// del manual operativo). Una categoría desconocida (p. ej. una variante nueva) se muestra TAL CUAL.
// Módulo puro: sin red, sin base de datos, sin React.
export const FAMILIAS=Object.freeze({'Pre-sale':'Preventa','Order':'Pedido','Shipping':'Envío','Return':'Devolución','Warranty':'Garantía','Feedback':'Opinión','Subscription':'Suscripción','Dealers':'Distribuidores','Other':'Otros'});
const T=[
 ['Pre-sale: Product Question','Preventa: Pregunta sobre un producto'],
 ['Pre-sale: Recommendation','Preventa: Recomendación'],
 ['Pre-sale: Notify When in Stock','Preventa: Aviso de reposición de inventario'],
 ['Pre-sale: Website Questions','Preventa: Dudas sobre el sitio web'],
 ['Pre-sale: Coupon / Discount','Preventa: Cupón o descuento'],
 ['Order: Cancel, Not Shipped','Pedido: Cancelación, aún sin enviar'],
 ['Order: Cancel, Shipped','Pedido: Cancelación, ya enviado'],
 ['Order: Change','Pedido: Cambio en el pedido'],
 ['Order: Confirmation','Pedido: Confirmación'],
 ['Order: Spare Parts','Pedido: Refacciones'],
 ['Order: Manual Request','Pedido: Solicitud de manual'],
 ['Order: Missing Parts, New Tool (NT)','Pedido: Piezas faltantes, herramienta nueva (NT)'],
 ['Order: Wrong Item','Pedido: Artículo equivocado'],
 ['Shipping: Change Address','Envío: Cambio de dirección'],
 ['Shipping: Delivery Not Received','Envío: Entrega no recibida'],
 ['Shipping: Damaged in Transit','Envío: Dañado en tránsito'],
 ['Shipping: Lost in Transit','Envío: Perdido en tránsito'],
 ['Shipping: Arrived Late','Envío: Llegó tarde'],
 ['Shipping: Unable to Deliver','Envío: No se pudo entregar'],
 ['Shipping: Questions','Envío: Preguntas'],
 ['Return: Incorrect Item, Customer Error','Devolución: Artículo incorrecto, error del cliente'],
 ['Return: Incorrect Item, Warehouse Error','Devolución: Artículo incorrecto, error del almacén'],
 ['Return: Missing Parts','Devolución: Piezas faltantes'],
 ['Return: Damaged (New Tool)','Devolución: Dañado (herramienta nueva)'],
 ['Return: No Longer Wanted','Devolución: Ya no lo quiere'],
 ['Return: Difficult Setup / Not Compatible','Devolución: Instalación difícil o incompatible'],
 ['Return: Bought Somewhere Else','Devolución: Lo compró en otro lugar'],
 ['Return: Incorrect Website Information','Devolución: Información incorrecta en el sitio'],
 ['Warranty: Briggs & Stratton','Garantía: Briggs & Stratton'],
 ['Warranty: Tool Replacement OT','Garantía: Reemplazo de herramienta (OT)'],
 ['Warranty: Part Replacement OT','Garantía: Reemplazo de pieza (OT)'],
 ['Warranty: Battery Replacement','Garantía: Reemplazo de batería'],
 ['Warranty: Charger Replacement','Garantía: Reemplazo de cargador'],
 ['Warranty: Battery/Charger Kit','Garantía: Kit de batería y cargador'],
 ['Warranty: Tool Replacement, non-engine failure','Garantía: Reemplazo de herramienta, falla ajena al motor'],
 ['Warranty: Troubleshooting (before deciding)','Garantía: Diagnóstico previo a decidir'],
 ['Feedback: Positive','Opinión: Positiva'],
 ['Feedback: Negative','Opinión: Negativa'],
 ['Subscription: Cancel','Suscripción: Cancelación'],
 ['Subscription: Product Registration','Suscripción: Registro de producto'],
 ['Dealers: Warranty','Distribuidores: Garantía'],
 ['Dealers: Partnership','Distribuidores: Alianza comercial'],
 ['Other: Gift Hunters','Otros: Buscadores de obsequios'],
 ['Other: Sponsorship','Otros: Patrocinio'],
 ['Other: Retailer notifications and system alerts','Otros: Notificaciones automáticas de minoristas y alertas del sistema']
];
export const CATEGORIAS=Object.freeze(Object.fromEntries(T));
export const CATEGORIA_RUIDO='Other: Retailer notifications and system alerts';
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const INDICE=new Map(T.map(([en,es])=>[norm(en),es]));
const INVERSO=new Map(T.map(([en,es])=>[norm(es),en]));
/** Etiqueta en español; si la categoría no está en la tabla se devuelve tal cual (sin inventar). */
export function etiquetaCategoria(categoria){
 if(typeof categoria!=='string'||!categoria.trim())return 'Sin categoría';
 return INDICE.get(norm(categoria))??categoria;
}
/** Nombre original en inglés de una etiqueta (o el mismo texto si no se reconoce). */
export function categoriaOriginal(texto){const k=norm(texto);return INVERSO.get(k)??(INDICE.has(k)?T.find(([en])=>norm(en)===k)[0]:String(texto??''));}
/** ¿Es la categoría de notificaciones automáticas (inglés o español)? */
export function esCategoriaRuido(categoria){const k=norm(categoria);return k===norm(CATEGORIA_RUIDO)||k===norm(CATEGORIAS[CATEGORIA_RUIDO]);}
/** Total de entradas conocidas (para pruebas y documentación). */
export const TOTAL_CATEGORIAS=T.length;
