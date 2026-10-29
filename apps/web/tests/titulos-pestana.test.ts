// Títulos de pestaña: cada pantalla de la app declara su título por clave i18n (meta.titulo.*) y se resuelve en español e inglés con el idioma activo.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {traducir} from '../src/lib/i18n';

const raiz=join(import.meta.dirname,'../src/app/(app)');
const archivos=(d:string,acc:string[]=[]):string[]=>{for(const n of readdirSync(d)){const p=join(d,n);if(statSync(p).isDirectory())archivos(p,acc);else if(/^(page|layout|not-found)\.tsx$/.test(n))acc.push(p);}return acc;};
const TODOS=archivos(raiz).map(p=>({ruta:relative(raiz,p),dir:relative(raiz,join(p,'..')),texto:readFileSync(p,'utf8')}));
const ESP=es as Record<string,string>,ING=en as Record<string,string>;
// Fuera de este contrato: la raíz (redirige), la página pública (metadatos propios por idioma en lib/landing) y la ruta de retorno del correo (hereda el título de su layout).
const EXENTAS=new Set(['page.tsx','layout.tsx','(landing)/landing/page.tsx','(landing)/landing/en/page.tsx','auth/email/complete/page.tsx','[...rest]/page.tsx']);
const claveDe=(texto:string)=>/(?:metaTitulo\(\s*|traducir\(.*?,\s*)'(meta\.titulo\.[a-z0-9-]+)'/.exec(texto)?.[1]??null;
const padres=(dir:string)=>{const salida:string[]=[];let d=dir;for(;;){salida.push(d);if(!d)break;d=d.includes('/')?d.slice(0,d.lastIndexOf('/')):'';}return salida;};
/** Clave del título de una pantalla: la de su página o, si no tiene, la del layout más cercano (sin contar el layout raíz). */
const tituloDe=(f:{ruta:string;dir:string;texto:string})=>{
  const propia=claveDe(f.texto);if(propia)return propia;
  for(const d of padres(f.dir)){if(!d)break;const lay=TODOS.find(x=>x.ruta===(d+'/layout.tsx'));const c=lay&&claveDe(lay.texto);if(c)return c;}
  return null;
};

test('ninguna pantalla conserva un título fijo en español: todos salen de meta.titulo.*',()=>{
  for(const f of TODOS){
    if(f.ruta==='layout.tsx'||EXENTAS.has(f.ruta))continue;
    assert.doesNotMatch(f.texto,/export const metadata\s*(:\s*\w+\s*)?=\s*\{[^}]*title\s*:/,`${f.ruta}: título fijo`);
  }
});
test('cada página y cada pantalla de la app resuelve un título por clave',()=>{
  const pantallas=TODOS.filter(f=>/(^|\/)page\.tsx$|(^|\/)not-found\.tsx$/.test(f.ruta)&&!EXENTAS.has(f.ruta));
  assert.ok(pantallas.length>=50,'se esperaban todas las pantallas de la app, hay '+pantallas.length);
  const sin=pantallas.filter(f=>!tituloDe(f)).map(f=>f.ruta);
  assert.deepEqual(sin,[],'pantallas sin título');
  // /login declara su título desde el layout con la misma clave en ambos idiomas.
  assert.match(TODOS.find(f=>f.ruta==='login/layout.tsx')!.texto,/traducir\(await idiomaActual\(\),'meta\.titulo\.login'\)/);
});
test('todas las claves usadas existen en ES y EN y todas las claves meta.titulo.* se usan',()=>{
  const usadas=new Set(TODOS.map(f=>claveDe(f.texto)).filter(Boolean) as string[]);usadas.add('meta.titulo.login');
  for(const k of usadas){assert.ok(ESP[k]?.trim(),`falta ES ${k}`);assert.ok(ING[k]?.trim(),`falta EN ${k}`);}
  const definidas=Object.keys(ESP).filter(k=>k.startsWith('meta.titulo.'));
  assert.deepEqual(definidas.filter(k=>!usadas.has(k)),[],'claves sin pantalla');
  assert.deepEqual(Object.keys(ING).filter(k=>k.startsWith('meta.titulo.')).sort(),definidas.sort(),'paridad de claves ES y EN');
});
test('los títulos no mezclan idiomas, no llevan el nombre técnico ni repiten la marca',()=>{
  const ACENTOS=/[áéíóúñ¿¡]/i,INGLES=/\b(the|and|of|for|your|detail|settings?|sources?|alerts?)\b/i,ESPANOL=/\b(de|del|la|las|el|los|y|en|por|sin|tus?)\b/i;
  for(const k of Object.keys(ESP).filter(x=>x.startsWith('meta.titulo.'))){
    const a=ESP[k],b=ING[k];
    assert.doesNotMatch(b,ACENTOS,`EN con letras del español: ${k} = ${b}`);assert.doesNotMatch(b,ESPANOL,`EN con palabras del español: ${k} = ${b}`);
    assert.doesNotMatch(a,INGLES,`ES con palabras del inglés: ${k} = ${a}`);
    for(const t of [a,b]){assert.doesNotMatch(t,/vexa|@vexa|vexa_platform/i,`nombre técnico en ${k}`);assert.doesNotMatch(t,/Rovaq/,`la plantilla ya agrega la marca: ${k}`);assert.ok(t.length<=60,`título largo: ${k}`);}
  }
});
test('la plantilla agrega la marca una sola vez y traducir() sigue el idioma pedido',()=>{
  const layout=readFileSync(join(raiz,'layout.tsx'),'utf8');assert.match(layout,/template:"%s · Rovaq AI"/);
  assert.equal(traducir('es','meta.titulo.overview' as never),'Hoy');assert.equal(traducir('en','meta.titulo.overview' as never),'Today');
  assert.equal(traducir('es','meta.titulo.settings-team' as never),'Equipo');assert.equal(traducir('en','meta.titulo.settings-team' as never),'Team');
  assert.equal(traducir('en','meta.titulo.login' as never),'Sign in');assert.equal(traducir('es','meta.titulo.login' as never),'Iniciar sesión');
});
