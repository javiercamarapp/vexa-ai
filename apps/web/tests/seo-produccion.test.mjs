import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {SITE,SITE_URL_RESPALDO,siteUrl,RUTAS_PUBLICAS,PREFIJOS_PRIVADOS,metadatosPublicos,jsonLd} from '../src/lib/site.mjs';
import {MENU} from '../src/lib/workspace/menu.mjs';
/** SEO y publicación: metadatos, robots, sitemap, manifest, íconos, cabeceras y títulos leídos del código (sin servidor). */
const raiz=join(import.meta.dirname,'..'),src=join(raiz,'src/app');
const leer=r=>readFileSync(join(raiz,r),'utf8'),pub=r=>join(raiz,'public',r);
const pngTam=r=>{const b=readFileSync(pub(r));assert.equal(b.subarray(1,4).toString(),'PNG',r+' no es PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)];};

test('dominio canónico: NEXT_PUBLIC_SITE_URL con respaldo al dominio nuevo', () => {
  assert.equal(SITE_URL_RESPALDO,'https://rovaq-ai.vercel.app');
  assert.equal(siteUrl(undefined),SITE_URL_RESPALDO);
  assert.equal(siteUrl('no es url'),SITE_URL_RESPALDO);
  assert.equal(siteUrl('http://evil.example'),SITE_URL_RESPALDO,'http fuera de localhost no se acepta');
  assert.equal(siteUrl('https://rovaq.ai/ruta/x'),'https://rovaq.ai');
  assert.match(leer('src/app/layout.tsx'),/metadataBase:\s*new URL\(siteUrl\(\)\)/);
});
test('layout raíz: campos obligatorios de metadata', () => {
  const s=leer('src/app/layout.tsx');
  for (const k of ['applicationName','keywords','authors','creator','publisher','category','alternates','openGraph','twitter','robots','formatDetection','manifest','icons','appleWebApp','themeColor']) assert.match(s,new RegExp('\\b'+k+'\\b'),'falta '+k);
  assert.match(s,/template:\s*"%s · Rovaq AI"/);
  assert.match(s,/locale:SITE\.locale/);
  assert.match(s,/summary_large_image/);
  assert.match(s,/<html lang=\{idioma\}/);assert.match(s,/idiomaActual\(\)/);
  assert.equal(SITE.locale,'es_MX');
});
test('title y description con longitud útil para buscadores', () => {
  assert.ok(SITE.descripcion.length>=150&&SITE.descripcion.length<=160,'description '+SITE.descripcion.length);
  assert.ok(SITE.titulo.length>=30&&SITE.titulo.length<=70,'title '+SITE.titulo.length);
  assert.doesNotMatch(SITE.descripcion+SITE.titulo,/\d{2,}\s?%|clientes como|garantiz/i,'sin cifras ni clientes inventados');
  const m=metadatosPublicos({titulo:'Iniciar sesión',ruta:'/login'});
  assert.equal(m.alternates.canonical,'/login');
  assert.equal(m.openGraph.type,'website');assert.equal(m.openGraph.locale,'es_MX');assert.equal(m.openGraph.siteName,'Rovaq AI');
  assert.deepEqual([m.openGraph.images[0].width,m.openGraph.images[0].height],[1200,630]);assert.ok(m.openGraph.images[0].alt.length>10);
  assert.equal(m.twitter.card,'summary_large_image');assert.equal(m.robots.index,true);
  assert.match(leer('src/app/login/layout.tsx'),/metadatosPublicos\(\{titulo:'Iniciar sesión',ruta:'\/login'\}\)/);
});
test('páginas privadas: noindex en cada segmento y cabecera X-Robots-Tag', () => {
  for (const f of ['src/app/(workspace)/layout.tsx','src/app/platform/layout.tsx','src/app/seguridad/page.tsx','src/app/sin-acceso/page.tsx','src/app/not-found.tsx','src/app/auth/invitations/[id]/layout.tsx','src/app/auth/email/complete/layout.tsx'])
    assert.match(leer(f),/robots:\s*ROBOTS_PRIVADO/,f+' sin noindex');
  const cfg=leer('next.config.ts');
  assert.match(cfg,/X-Robots-Tag/);assert.match(cfg,/PREFIJOS_PRIVADOS/);
  // Cada carpeta del espacio de trabajo debe estar en PREFIJOS_PRIVADOS (si se añade una pantalla nueva, esta prueba obliga a cerrarla en robots y cabeceras).
  for (const d of readdirSync(join(src,'(workspace)')).filter(n=>statSync(join(src,'(workspace)',n)).isDirectory()))
    assert.ok(PREFIJOS_PRIVADOS.includes('/'+d),'falta /'+d+' en PREFIJOS_PRIVADOS');
  for (const p of ['/api','/auth','/platform','/seguridad','/sin-acceso']) assert.ok(PREFIJOS_PRIVADOS.includes(p),p);
  for (const p of RUTAS_PUBLICAS) assert.ok(!PREFIJOS_PRIVADOS.some(x=>p===x||p.startsWith(x+'/')),p+' es pública y privada a la vez');
});
test('robots.ts y sitemap.ts: solo lo público, con sitemap absoluto', () => {
  const r=leer('src/app/robots.ts'),s=leer('src/app/sitemap.ts');
  assert.match(r,/allow:\['\/',\.\.\.RUTAS_PUBLICAS\]/);assert.match(r,/disallow:PREFIJOS_PRIVADOS/);assert.match(r,/sitemap:`\$\{base\}\/sitemap\.xml`/);
  assert.match(s,/lastModified/);assert.match(s,/RUTAS_PUBLICAS\.map/);
  assert.deepEqual([...RUTAS_PUBLICAS],['/login']);
});
test('el middleware de auth no intercepta robots, sitemap, manifest, íconos ni imágenes sociales (el matcher abarca todo salvo estáticos para decidir por host; la autenticación solo corre en la lista anterior)', async () => {
  const {rutaConAutenticacion}=await import('../src/lib/host-routing.mjs');
  for (const ruta of ['/robots.txt','/sitemap.xml','/site.webmanifest','/opengraph-image','/twitter-image','/favicon.ico','/.well-known/security.txt','/humans.txt','/landing'])
    assert.equal(rutaConAutenticacion(ruta),false,ruta+' pasaría por el middleware de auth');
  const m=leer('src/middleware.ts');
  assert.match(m,/decidirHost\(/);assert.match(m,/if\(!rutaConAutenticacion\(path\)\)return NextResponse\.next\(\)/);
  assert.match(m,/matcher:\s*\['\/\(\(\?!_next\/static\|_next\/image\|fonts\/\|brand\/\|images\/\)\.\*\)'\]/);
});
test('landing: robots y sitemap por host (rovaq.ai solo anuncia la landing), canonical propio y la app sigue sin listar la raíz', () => {
  const r=leer('src/app/robots.ts'),s=leer('src/app/sitemap.ts');
  for (const f of [r,s]) {assert.match(f,/ES_HOST_LANDING/);assert.match(f,/landingUrl\(\)/);}
  assert.match(r,/rules:\[\{userAgent:'\*',allow:\['\/'\]\}\]/);
  assert.match(s,/url:`\$\{landingUrl\(\)\}\/`/);
  assert.ok(!RUTAS_PUBLICAS.includes('/'),'la raíz de la app redirige y no se lista');
});
test('íconos: existen y tienen el tamaño declarado', () => {
  const esperados={'favicon-16x16.png':[16,16],'favicon-32x32.png':[32,32],'favicon-48x48.png':[48,48],'apple-touch-icon.png':[180,180],'icon-192.png':[192,192],'icon-512.png':[512,512],'icon-maskable-192.png':[192,192],'icon-maskable-512.png':[512,512]};
  for (const [f,t] of Object.entries(esperados)) assert.deepEqual(pngTam(f),t,f);
  for (const f of ['favicon.ico','favicon.svg','push-icon.svg','brand/rovaq-app-icon.svg','brand/rovaq-logo-horizontal-positivo-600px.png','.well-known/security.txt','humans.txt']) assert.ok(existsSync(pub(f))&&statSync(pub(f)).size>0,f);
  const ico=readFileSync(pub('favicon.ico'));assert.equal(ico.readUInt16LE(2),1,'ico');assert.ok(ico.readUInt16LE(4)>=2,'ico con varias medidas');
  const layout=leer('src/app/layout.tsx');
  for (const f of ['/favicon.ico','/favicon.svg','/favicon-16x16.png','/favicon-32x32.png','/favicon-48x48.png','/icon-192.png','/icon-512.png','/apple-touch-icon.png']) assert.ok(layout.includes(f),f+' sin declarar en icons');
});
test('imágenes Open Graph y Twitter 1200×630 de segmento', () => {
  const og=leer('src/app/opengraph-image.tsx'),tw=leer('src/app/twitter-image.tsx');
  assert.match(og,/contentType='image\/png'/);assert.match(og,/ImageResponse/);assert.match(og,/LOGOS\.horizontal/);
  assert.equal(SITE.og.ancho,1200);assert.equal(SITE.og.alto,630);
  assert.match(tw,/export const size=sizeOg/);assert.match(tw,/export const contentType=tipoOg/);assert.match(tw,/export default OpenGraphImage/);
});
test('manifest PWA y manifest de avisos coherentes', () => {
  const m=JSON.parse(leer('public/site.webmanifest')),p=JSON.parse(leer('public/push-manifest.webmanifest'));
  assert.equal(m.name,'Rovaq AI');assert.equal(m.short_name,'Rovaq');assert.equal(m.lang,'es-MX');assert.equal(m.id,'/');assert.equal(m.start_url,'/');assert.equal(m.scope,'/');assert.equal(m.display,'standalone');assert.ok(m.orientation);
  assert.ok(m.description.length>40);assert.deepEqual([...m.categories],['business','productivity']);
  assert.ok(m.shortcuts.length>=2&&m.shortcuts.every(s=>s.url.startsWith('/')&&s.name));
  for (const [sz,pur] of [['192x192','any'],['512x512','any'],['192x192','maskable'],['512x512','maskable']]) assert.ok(m.icons.some(i=>i.sizes===sz&&i.purpose===pur&&existsSync(pub(i.src.slice(1)))),sz+' '+pur);
  assert.match(m.theme_color,/^#[0-9A-Fa-f]{6}$/);assert.match(m.background_color,/^#[0-9A-Fa-f]{6}$/);
  assert.equal(p.name,m.name);assert.equal(p.short_name,m.short_name);assert.equal(p.lang,m.lang);assert.equal(p.id,m.id);assert.equal(p.start_url,'/notifications');
  assert.equal(p.theme_color,m.theme_color);assert.ok(p.icons.every(i=>existsSync(pub(i.src.slice(1)))));
});
test('cabeceras de seguridad y caché en next.config.ts', () => {
  const c=leer('next.config.ts');
  for (const k of ['X-Content-Type-Options','nosniff','X-Frame-Options','DENY','Strict-Transport-Security','max-age=31536000; includeSubDomains','Referrer-Policy','strict-origin-when-cross-origin','Permissions-Policy','camera=()','microphone=()','geolocation=()','Cross-Origin-Opener-Policy','same-origin','Content-Security-Policy-Report-Only','frame-ancestors','max-age=31536000, immutable','stale-while-revalidate'])
    assert.ok(c.includes(k),'falta '+k);
  assert.doesNotMatch(c,/preload/,'sin preload de HSTS en *.vercel.app');
  assert.match(c,/key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'"/,'la CSP vigente no se debilita');
  assert.match(c,/\/api\/briefs\/:id\/export/);
});
test('JSON-LD válido: Organization + SoftwareApplication, sin ratings ni precios', () => {
  const j=JSON.parse(JSON.stringify(jsonLd('https://rovaq-ai.vercel.app')));
  assert.equal(j['@context'],'https://schema.org');
  const tipos=j['@graph'].map(n=>n['@type']);assert.deepEqual(tipos,['Organization','SoftwareApplication']);
  const org=j['@graph'][0],app=j['@graph'][1];
  assert.equal(org.url,'https://rovaq-ai.vercel.app');assert.match(org.logo.url,/^https:\/\/rovaq-ai\.vercel\.app\/brand\/.+\.png$/);assert.ok(existsSync(pub(org.logo.url.replace('https://rovaq-ai.vercel.app/',''))));
  assert.equal(app.publisher['@id'],org['@id']);assert.equal(app.inLanguage,'es-MX');
  assert.doesNotMatch(JSON.stringify(j),/aggregateRating|offers|price|review/i);
  assert.match(leer('src/app/login/layout.tsx'),/application\/ld\+json/);
});
test('security.txt con contacto y expiración vigente', () => {
  const t=leer('public/.well-known/security.txt');
  assert.match(t,/^Contact: mailto:javiercamaraportepetit@gmail\.com$/m);
  const exp=/^Expires: (.+)$/m.exec(t)[1];assert.ok(new Date(exp)>new Date(),'security.txt vencido: renovar Expires');
  assert.match(t,/^Preferred-Languages: es, en$/m);
});
test('títulos de pestaña: toda pantalla del menú tiene título propio, único y coherente con el menú', () => {
  const titulos=new Map();
  const itemsMenu=MENU.flatMap(e=>e.tipo==='grupo'?e.items:[e]);
  for (const it of itemsMenu) {
    const f=join(src,'(workspace)',it.href.slice(1),'page.tsx');assert.ok(existsSync(f),it.href+' sin page.tsx');
    const m=/export const metadata\s*=\s*\{title:\s*'([^']+)'/.exec(readFileSync(f,'utf8'));assert.ok(m,it.href+' sin metadata.title');
    const esperado=it.titulo??it.etiqueta;assert.ok(m[1].startsWith(esperado),`${it.href}: «${m[1]}» no empieza con «${esperado}»`);
    assert.ok(!titulos.has(m[1]),`título repetido «${m[1]}» (${titulos.get(m[1])} y ${it.href})`);titulos.set(m[1],it.href);
  }
  // Toda página (no solo las del menú) declara título, directo o en su layout.
  const paginas=d=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?paginas(p):n==='page.tsx'?[p]:[];});
  const sin=paginas(src).filter(f=>{const s=readFileSync(f,'utf8');if(/metadata|generateMetadata/i.test(s))return false;const l=join(f,'..','layout.tsx');return !(existsSync(l)&&/metadata/.test(readFileSync(l,'utf8')));}).map(f=>f.replace(src+'/',''));
  assert.deepEqual(sin.filter(f=>f!=='page.tsx'),[],'páginas sin título: '+sin.join(', '));
});
test('páginas de error de marca: noindex, logo y salida a Hoy; «use client» primero', () => {
  const nf=leer('src/app/not-found.tsx'),ge=leer('src/app/global-error.tsx'),er=leer('src/app/error.tsx');
  assert.match(nf,/Ir a Hoy/);assert.match(er,/href="\/overview"/);
  assert.match(ge,/^'use client';/);assert.match(er,/^'use client';/);
  assert.match(ge,/noindex/);assert.match(ge,/rovaq-logo-horizontal-positivo-600px\.png/);assert.match(ge,/alt="Rovaq AI"/);assert.match(ge,/width=\{160\} height=\{45\}/);
});
