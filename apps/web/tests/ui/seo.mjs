// SEO de producción en las páginas públicas (/ y /login) y recursos públicos sin sesión. Uso (con `next dev` y fixtures en marcha):
//   VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev --webpack -p 3380   (otra terminal)
//   node tests/ui/seo.mjs [baseUrl]      Sale 1 si algo falla.
// Comprueba por página: title, description, canonical, og:*, twitter:*, h1 único, imágenes con alt y medidas, JSON-LD, 0 errores de consola, 0 recursos 404;
// y con peticiones sin cookies: robots.txt, sitemap.xml, manifest, íconos, imágenes sociales y security.txt responden 200 sin redirigir a /login.
import {createRequire} from 'node:module';
const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const base=(process.argv[2]??'http://localhost:3380').replace(/\/$/,'');
const fails=[];const check=(ok,msg)=>{console.log((ok?'   ok: ':'   FALLA: ')+msg);if(!ok)fails.push(msg);};
const CANON='https://rovaq-ai.vercel.app';
const browser=await chromium.launch();
for(const [ruta,esperaCanon] of [['/login',CANON+'/login'],['/',CANON]]){
 for(const [w,h] of [[1440,900],[375,812]]){
  console.log(`== ${ruta} @${w}px`);
  const ctx=await browser.newContext({viewport:{width:w,height:h}});const page=await ctx.newPage();
  const consola=[],malos=[];
  page.on('console',m=>{if(m.type()==='error')consola.push(m.text());});
  page.on('pageerror',e=>consola.push('pageerror: '+e.message));
  page.on('response',r=>{if(r.status()>=400)malos.push(r.status()+' '+r.url());});
  const resp=await page.goto(base+ruta,{waitUntil:'networkidle',timeout:120000});
  check(resp.status()===200,`${ruta}: HTTP 200 (${resp.status()})`);
  const d=await page.evaluate(()=>{const m=(s,a='content')=>document.querySelector(s)?.getAttribute(a)??null;
   const imgs=[...document.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),alt:i.getAttribute('alt'),w:i.getAttribute('width'),h:i.getAttribute('height')}));
   const svgs=[...document.querySelectorAll('svg')].filter(s=>s.getAttribute('aria-hidden')!=='true').map(s=>({role:s.getAttribute('role'),label:s.getAttribute('aria-label')}));
   const ld=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent);
   const enlaces=[...document.querySelectorAll('a')].map(a=>({t:(a.textContent||'').trim()||a.getAttribute('aria-label')||'',h:a.getAttribute('href')}));
   return {lang:document.documentElement.lang,title:document.title,desc:m('meta[name=description]'),canon:m('link[rel=canonical]','href'),viewport:m('meta[name=viewport]'),cs:m('meta[name=color-scheme]'),
    og:Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map(x=>[x.getAttribute('property'),x.content])),
    tw:Object.fromEntries([...document.querySelectorAll('meta[name^="twitter:"]')].map(x=>[x.getAttribute('name'),x.content])),
    robots:m('meta[name=robots]'),manifest:m('link[rel=manifest]','href'),icons:[...document.querySelectorAll('link[rel~=icon],link[rel=apple-touch-icon]')].map(l=>l.getAttribute('href')),
    h1:[...document.querySelectorAll('h1')].map(x=>x.textContent.trim()),imgs,svgs,ld,enlaces};});
  check(d.lang==='en',`lang="en" por omisión (${d.lang})`);
  check(/Rovaq AI/.test(d.title)&&d.title.length>=10&&d.title.length<=70,`title «${d.title}»`);
  check(!!d.desc&&d.desc.length>=150&&d.desc.length<=160,`description ${d.desc?.length} caracteres`);
  check(d.canon===esperaCanon||d.canon===CANON,`canonical ${d.canon}`);
  check(/width=device-width/.test(d.viewport??'')&&!/user-scalable=no|maximum-scale=1\b/.test(d.viewport??''),'viewport accesible');
  check(d.cs==='light dark','color-scheme light dark');
  check(d.robots==='index, follow',`robots «${d.robots}»`);
  check(d.manifest==='/site.webmanifest','manifest enlazado');
  check(['/favicon.ico','/favicon.svg','/apple-touch-icon.png','/icon-192.png','/icon-512.png'].every(i=>d.icons.includes(i)),'íconos enlazados');
  for(const k of ['og:title','og:description','og:url','og:site_name','og:locale','og:type','og:image','og:image:width','og:image:height','og:image:alt'])check(!!d.og[k],`${k}`);
  check(d.og['og:locale']==='es_MX'&&/\/opengraph-image/.test(d.og['og:image']??'')&&(ruta!=='/login'||d.og['og:image'].startsWith(CANON+'/'))&&d.og['og:image:width']==='1200'&&d.og['og:image:height']==='630','og: locale, imagen absoluta 1200x630');
  for(const k of ['twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt'])check(!!d.tw[k],`${k}`);
  check(d.tw['twitter:card']==='summary_large_image','twitter:card summary_large_image');
  check(d.h1.length===1,`un solo h1 (${JSON.stringify(d.h1)})`);
  check(d.imgs.every(i=>i.alt!==null&&i.alt.length>0),`imágenes con alt (${d.imgs.length})`);
  check(d.imgs.every(i=>i.w&&i.h),'imágenes con width/height');
  check(d.svgs.every(s=>s.role==='img'?!!s.label:true),'logos SVG con nombre accesible');
  check(d.enlaces.every(e=>e.t.length>0&&!/^(aquí|click|clic|más)$/i.test(e.t)),'enlaces con texto descriptivo');
  if(ruta==='/login'){
   check(d.ld.length===1,'JSON-LD presente');
   const j=JSON.parse(d.ld[0]);const tipos=j['@graph']?.map(n=>n['@type']);check(JSON.stringify(tipos)==='["Organization","SoftwareApplication"]','JSON-LD Organization + SoftwareApplication');
   check(!/aggregateRating|offers|price/.test(d.ld[0]),'JSON-LD sin ratings ni precios');
  }
  // Foco visible: Tab lleva a un elemento con contorno.
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');if(await page.evaluate(()=>!/NEXTJS-PORTAL|BODY/.test(document.activeElement?.tagName??'BODY')))break;}
  const foco=await page.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;const c=getComputedStyle(e);return {tag:e.tagName,outline:c.outlineStyle!=='none'&&parseFloat(c.outlineWidth)>0,sombra:c.boxShadow!=='none'};});
  check(!!foco&&(foco.outline||foco.sombra),`foco visible tras Tab (${JSON.stringify(foco)})`);
  // CLS: sin saltos de diseño durante la carga.
  const cls=await page.evaluate(()=>new Promise(res=>{let v=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)v+=e.value;}).observe({type:'layout-shift',buffered:true});setTimeout(()=>res(v),500);}));
  check(cls<0.1,`CLS ${cls.toFixed(3)} < 0.1`);
  check(consola.length===0,`0 errores de consola ${JSON.stringify(consola.slice(0,3))}`);
  check(malos.length===0,`0 recursos con error HTTP ${JSON.stringify(malos.slice(0,3))}`);
  await ctx.close();
 }
}
console.log('== recursos públicos sin sesión (sin cookies, sin redirecciones)');
for(const [ruta,tipo] of [['/robots.txt',/text\/plain/],['/sitemap.xml',/xml/],['/site.webmanifest',/manifest\+json|json/],['/push-manifest.webmanifest',/./],['/favicon.ico',/icon/],['/favicon.svg',/svg/],['/favicon-16x16.png',/png/],['/favicon-32x32.png',/png/],['/favicon-48x48.png',/png/],['/apple-touch-icon.png',/png/],['/icon-192.png',/png/],['/icon-512.png',/png/],['/icon-maskable-512.png',/png/],['/opengraph-image',/image\/png/],['/twitter-image',/image\/png/],['/.well-known/security.txt',/text\/plain/],['/humans.txt',/text\/plain/],['/brand/rovaq-logo-horizontal-positivo-600px.png',/png/]]){
 const r=await fetch(base+ruta,{redirect:'manual'});
 check(r.status===200&&tipo.test(r.headers.get('content-type')??''),`${ruta} -> ${r.status} ${r.headers.get('content-type')}`);
}
const cab=await fetch(base+'/login',{redirect:'manual'});
for(const [k,re] of [['strict-transport-security',/max-age=31536000; includeSubDomains/],['x-content-type-options',/nosniff/],['x-frame-options',/DENY/],['permissions-policy',/camera=\(\)/],['cross-origin-opener-policy',/same-origin/],['content-security-policy-report-only',/default-src/],['referrer-policy',/./]])check(re.test(cab.headers.get(k)??''),`cabecera ${k}`);
for(const ruta of ['/overview','/platform','/seguridad','/sin-acceso','/pain-points','/api/health/version']){const r=await fetch(base+ruta,{redirect:'manual'});check(/noindex/.test(r.headers.get('x-robots-tag')??''),`X-Robots-Tag noindex en ${ruta}`);}
const nf=await fetch(base+'/no-existe-seo');check(nf.status===404,'404 real en ruta inexistente');
await browser.close();
console.log(fails.length?`\n${fails.length} FALLAS`:'\nSEO: todo en orden');process.exit(fails.length?1:0);
