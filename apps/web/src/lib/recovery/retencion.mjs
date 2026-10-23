// La API guarda la retención de copias en segundos; el cliente la ve y la edita en días. Sin decimales inventados.
export const segundosADias=(segundos)=>{const n=Number(segundos);return Number.isFinite(n)&&n>0?String(Math.round(n/864)/100):'';};
export const diasASegundos=(dias)=>{const n=Number(dias);return Number.isFinite(n)&&n>0?Math.max(1,Math.round(n*86400)):NaN;};
export const textoVersionPolitica=(version)=>version>0?`Política guardada (versión ${version}).`:'Aún no hay una política guardada: se usa la predeterminada.';
