import{need}from'./contract.mjs';
// Additional preventive logical charge, not a heap/RSS measurement or mathematical AST bound.
export function projectionCharge(richText,observerRetainedBytes){
 need(typeof richText==='string'&&Number.isSafeInteger(observerRetainedBytes)&&observerRetainedBytes>=0,'S01_PROJECTION_ACCOUNTING');const bytes=Buffer.byteLength(richText,'utf8');need(bytes<=8*1024*1024,'S01_PROJECTION_INPUT_LIMIT');let delimiters=0;for(const ch of richText)if(ch==='<')delimiters++;
 const callbackCharge=12*bytes+1024*(3*delimiters+32),aggregateCharge=observerRetainedBytes+callbackCharge;need(aggregateCharge<=64*1024*1024,'S01_PROJECTION_ACCOUNTED_LIMIT');return Object.freeze({callbackCharge,aggregateCharge});
}
