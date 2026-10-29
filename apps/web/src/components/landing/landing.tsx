/* eslint-disable @next/next/no-img-element -- webp ya optimizado y servido estático; next/image sumaría optimización facturable en Vercel */
import React from 'react';
import {RovaqLogo} from '../rovaq-logo';
import {SITE, APP_URL, landingUrl} from '../../lib/site.mjs';
import {traductor, type Idioma, type Traductor} from '../../lib/i18n';
import {Miniatura} from './mocks';
import {MovimientoLanding, SelectorTemaLanding} from './cliente';
import './landing.css';

const PASOS = [1, 2, 3, 4] as const;
const MARQ = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const TOTAL = 5;
const SELLO_PASO = ['obs', 'obs', 'inf', 'est'] as const;
const SELLOS = [['obs', 'landing.val.obs'], ['est', 'landing.val.est'], ['inf', 'landing.val.inf'], ['sin', 'landing.val.sin']] as const;

/** Datos estructurados mínimos de la landing: organización y sitio. Sin valoraciones, precios ni clientes. */
export function jsonLdLanding(base = landingUrl(), idioma: Idioma = 'es') {
  return {'@context': 'https://schema.org', '@graph': [
    {'@type': 'Organization', '@id': `${base}/#organizacion`, name: SITE.nombre, alternateName: [SITE.corto], url: base, logo: `${base}/brand/rovaq-logo-horizontal-positivo-600px.png`, email: SITE.contacto},
    {'@type': 'WebSite', '@id': `${base}/#sitio`, name: SITE.nombre, url: base, inLanguage: idioma === 'es' ? 'es-MX' : 'en', publisher: {'@id': `${base}/#organizacion`}},
  ]};
}


/** Cabecera de una banda con índice: píldora negra a la izquierda y «0n / 05» a la derecha, como una celda más de la rejilla. */
function Cinta({pill, n, t, texto}: {pill: string; n: number; t: Traductor; texto?: string}) {
  return <div className="banda banda-cinta">
    <div className="c"><span className="pildora">{pill}</span></div>
    <div className="c c-texto mono">{texto}</div>
    <div className="c c-der mono">{t('landing.indice', {n: String(n).padStart(2, '0'), total: String(TOTAL).padStart(2, '0')})}</div>
  </div>;
}
function Visor({children, clase = ''}: {children: React.ReactNode; clase?: string}) {
  return <div className={'visor ' + clase}><i className="e e1" aria-hidden="true" /><i className="e e2" aria-hidden="true" /><i className="e e3" aria-hidden="true" /><i className="e e4" aria-hidden="true" />{children}</div>;
}

export function Landing({idioma}: {idioma: Idioma}) {
  const t = traductor(idioma);
  const acceso = `mailto:${SITE.contacto}?subject=${encodeURIComponent(t('landing.acceso.asunto'))}&body=${encodeURIComponent(t('landing.acceso.cuerpo'))}`;
  const seguridad = `mailto:${SITE.contacto}?subject=${encodeURIComponent(t('landing.pie.asuntoSeg'))}`;
  const palabras = MARQ.map((n) => t(`landing.marq.${n}` as 'landing.marq.1'));
  return <div className="landing">
    <MovimientoLanding />
    <header className="l-nav">
      <div className="marco">
        <div className="banda banda-nav">
          <a className="c c-logo" href="#inicio" aria-label={t('landing.nav.inicio')}><RovaqLogo variante="horizontal" ancho={108} espacioLibre={false} decorativo /></a>
          <nav className="c c-links" aria-label={t('landing.nav.aria')}>
            <a href="#como">{t('landing.nav.como')}</a><a href="#producto">{t('landing.nav.producto')}</a><a href="#seguridad">{t('landing.nav.seguridad')}</a><a href="#faq">{t('landing.nav.faq')}</a>
          </nav>
          <nav className="c c-idioma" aria-label={t('idioma.etiqueta')}>
            {(['es', 'en'] as const).map((i) => <a key={i} href={i === 'es' ? '/' : '/en'} lang={i} hrefLang={i} aria-current={i === idioma ? 'page' : undefined} aria-label={t('idioma.cambiar', {idioma: t(i === 'es' ? 'idioma.es' : 'idioma.en')})}>{i.toUpperCase()}</a>)}
          </nav>
          <div className="c c-tema"><SelectorTemaLanding etiqueta={t('landing.tema.cambiar')} /></div>
          <a className="c c-boton" href={acceso}>{t('landing.nav.acceso')}<span aria-hidden="true">{' ↗'}</span></a>
        </div>
      </div>
    </header>

    <div className="marco" id="contenido">
      <section id="inicio" className="hero" aria-labelledby="t-hero">
        <Cinta pill={t('landing.hero.pill')} n={1} t={t} texto={t('landing.hero.eyebrow')} />
        <div className="banda banda-hero">
          <div className="c c-titular">
            <h1 id="t-hero" className="h-gigante" data-in="0">{t('landing.hero.titulo')}</h1>
            <p className="desc" data-in="1">{t('landing.hero.sub')}</p>
            <div className="acciones" data-in="2">
              <a className="l-btn" href={acceso}>{t('landing.hero.cta')}<span aria-hidden="true">{' ↗'}</span></a>
              <a className="l-btn l-btn-borde" href="#como">{t('landing.hero.cta2')}</a>
            </div>
          </div>
          <Visor clase="hero-visor">
            {/* Imagen del LCP: prioridad alta, tamaño fijo. El lienzo con la secuencia de cuadros se superpone al cargar y avanza con el scroll. */}
            <img className="obj" src="/landing/objeto-nucleo.webp" width={900} height={900} alt={t('landing.hero.render')} fetchPriority="high" decoding="async" />
            <canvas className="esc3d" data-escena3d="nucleo" data-modelos="/landing/3d/nucleo.glb" aria-hidden="true" />
          </Visor>
        </div>
        <ul className="banda banda-hechos" data-in="3">
          {[1, 2, 3].map((n) => <li key={n} className="c"><span className="mono l-num">{String(n).padStart(2, '0')}</span>{t(`landing.hero.hecho${n}` as 'landing.hero.hecho1')}</li>)}
        </ul>
      </section>

      <div className="marquesina" aria-hidden="true">
        <div className="pista-marq">
          {[0, 1].map((k) => <ul key={k}>{palabras.map((w, i) => <li key={i}>{w}<b>{'*'}</b></li>)}</ul>)}
        </div>
      </div>

      <section id="como" className="fw" aria-labelledby="t-como">
        <div className="banda banda-cinta banda-fw">
          <div className="c"><span className="pildora">{t('landing.como.eyebrow')}</span></div>
          <div className="c c-texto mono"><h2 id="t-como" className="mini-h">{t('landing.fw.tab')}</h2></div>
          <div className="c c-der mono">{t('landing.indice', {n: '02', total: String(TOTAL).padStart(2, '0')})}</div>
        </div>
        <div className="fw-pista" data-escena data-activo="1">
          <div className="fw-fijo">
            <div className="fw-grid">
              <Visor clase="fw-visor">
                {PASOS.map((n) => <React.Fragment key={n}><img className="obj" data-paso={n} src={`/landing/objeto-${n}.webp`} width={720} height={720} alt={t(`landing.fw.${n}.alt` as 'landing.fw.1.alt')} loading="lazy" decoding="async" /></React.Fragment>)}
                <canvas className="esc3d" data-escena3d="pasos" data-modelos="/landing/3d/paso-1.glb,/landing/3d/paso-2.glb,/landing/3d/paso-3.glb,/landing/3d/paso-4.glb" aria-hidden="true" />
                <ol className="sellos" aria-label={t('landing.fw.sellos')}>{SELLOS.map(([k, c]) => <li key={k} data-s={k}><em className={'etq' + (k === 'sin' ? ' sin' : '')}>{t(c)}</em></li>)}</ol>
                <span className="visor-rotulo mono">{t('landing.fw.visor')}</span>
              </Visor>
              <div className="fw-textos">
                {PASOS.map((n) => <article key={n} className="panel" data-paso={n} data-s={SELLO_PASO[n - 1]}>
                  <div className="cifra-m" aria-hidden="true"><p className="cifra">{String(n).padStart(2, '0')}</p></div>
                  <div className="panel-cuerpo">
                    <h3 className="h-medio"><span className="mono sr-paso">{t('landing.como.paso', {n, total: PASOS.length})}</span>{t(`landing.fw.${n}.t` as 'landing.fw.1.t')}</h3>
                    <p className="desc">{t(`landing.fw.${n}.d` as 'landing.fw.1.d')}</p>
                    <p className="sello-paso"><em className="etq">{t(SELLOS.find(([k]) => k === SELLO_PASO[n - 1])![1])}</em><span className="mono tenue">{t('landing.fw.sellos.nota')}</span></p>
                  </div>
                  <img className="panel-obj" src={`/landing/objeto-${n}.webp`} width={720} height={720} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                </article>)}
              </div>
            </div>
          </div>
          <div className="fw-centinelas" aria-hidden="true">{PASOS.map((n) => <i key={n} data-centinela={n} />)}</div>
        </div>
      </section>

      <section id="producto" className="sec" aria-labelledby="t-cap">
        <Cinta pill={t('landing.cap.eyebrow')} n={3} t={t} />
        <div className="banda banda-cab">
          <div className="c"><h2 id="t-cap" className="h-gigante h-2" data-rv>{t('landing.cap.titulo')}</h2></div>
          <div className="c c-def" data-rv>
            <p className="mono def-clase">{t('landing.def.clase')}</p>
            <p className="def-palabra">{t('landing.def.palabra')}</p>
            <ol className="def-lista"><li>{t('landing.def.1')}</li><li>{t('landing.def.2')}</li></ol>
            <p className="mono tenue def-nota">{t('landing.def.nota')}</p>
          </div>
        </div>
        <ul className="banda banda-caps">
          {[1, 2, 3, 4, 5, 6].map((n) => <li key={n} className="c cap" data-rv><div className="cap-vis"><Miniatura n={n} t={t} /></div><h3 className="h-medio">{t(`landing.cap.${n}.t` as 'landing.cap.1.t')}</h3><p className="desc">{t(`landing.cap.${n}.d` as 'landing.cap.1.d')}</p></li>)}
        </ul>
        <div className="banda banda-nota"><p className="c mono tenue"><span className="sint">{t('landing.sintetico')}</span> {t('landing.cap.nota')}</p></div>

        <div className="banda banda-cab">
          <div className="c"><h2 id="t-val" className="h-gigante h-2" data-rv>{t('landing.val.titulo')}</h2><p className="desc" data-rv>{t('landing.val.sub')}</p></div>
          <dl className="c c-etq">
            {([['obs', 'landing.val.obs', 'landing.val.obs.d'], ['est', 'landing.val.est', 'landing.val.est.d'], ['inf', 'landing.val.inf', 'landing.val.inf.d'], ['sin', 'landing.val.sin', 'landing.val.sin.d']] as const).map(([k, a, b]) =>
              <div key={k} data-rv><dt><em className={'etq' + (k === 'sin' ? ' sin' : '')}>{t(a)}</em></dt><dd>{t(b)}</dd></div>)}
          </dl>
        </div>
        <ul className="banda banda-tres">
          {[1, 2, 3].map((n) => <li key={n} className="c" data-rv><h3 className="h-medio">{t(`landing.val.c${n}.t` as 'landing.val.c1.t')}</h3><p className="desc">{t(`landing.val.c${n}.d` as 'landing.val.c1.d')}</p></li>)}
        </ul>
      </section>

      <section className="sec" aria-labelledby="t-cuentas">
        <div className="banda banda-cab"><div className="c"><h2 id="t-cuentas" className="h-gigante h-2" data-rv>{t('landing.cuentas.titulo')}</h2></div><div className="c c-sub"><p className="desc" data-rv>{t('landing.cuentas.sub')}</p></div></div>
        <ul className="banda banda-cuatro">
          {[1, 2, 3, 4].map((n) => <li key={n} className="c" data-rv><span className="mono l-num">{String(n).padStart(2, '0')}</span><h3 className="h-medio">{t(`landing.cuentas.${n}.t` as 'landing.cuentas.1.t')}</h3><p className="desc">{t(`landing.cuentas.${n}.d` as 'landing.cuentas.1.d')}</p></li>)}
        </ul>
        <div className="banda banda-nota"><p className="c mono tenue">{t('landing.cuentas.nota')}</p></div>
      </section>

      <section id="seguridad" className="sec" aria-labelledby="t-seg">
        <Cinta pill={t('landing.seg.eyebrow')} n={4} t={t} />
        <div className="banda banda-cab">
          <div className="c"><h2 id="t-seg" className="h-gigante h-2" data-rv>{t('landing.seg.titulo')}</h2><p className="desc" data-rv>{t('landing.seg.sub')}</p></div>
          <aside className="c c-ruta" aria-labelledby="t-ruta" data-rv>
            <h3 id="t-ruta" className="h-medio">{t('landing.seg.ruta.t')}</h3>
            <p className="desc">{t('landing.seg.ruta.d')}</p>
            <p className="mono tenue">{t('landing.seg.cert')}</p>
          </aside>
        </div>
        <ul className="banda banda-seis">
          {[1, 2, 3, 4, 5, 6].map((n) => <li key={n} className="c" data-rv><span className="mono l-num">{String(n).padStart(2, '0')}</span>{t(`landing.seg.${n}` as 'landing.seg.1')}</li>)}
        </ul>
        <div className="banda banda-cab" aria-labelledby="t-int">
          <div className="c"><h2 id="t-int" className="h-gigante h-2" data-rv>{t('landing.int.titulo')}</h2></div>
          <div className="c c-int" data-rv>
            <h3 className="mono">{t('landing.int.hoy')}</h3>
            <ul><li><b>HubSpot</b><p>{t('landing.int.hubspot')}</p></li><li><b>{t('landing.int.excel')}</b><p>{t('landing.int.excel.d')}</p></li></ul>
            <h3 className="mono">{t('landing.int.ruta')}</h3>
            <ul><li><b>Amazon, Walmart, Shopify</b><p>{t('landing.int.ruta.d')}</p></li></ul>
          </div>
        </div>
      </section>

      <section id="faq" className="sec" aria-labelledby="t-faq">
        <div className="banda banda-cab">
          <div className="c"><h2 id="t-faq" className="h-gigante h-2" data-rv>{t('landing.faq.titulo')}</h2></div>
          <div className="c c-faq">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <details key={n} data-rv><summary>{t(`landing.faq.${n}.q` as 'landing.faq.1.q')}</summary><p>{t(`landing.faq.${n}.a` as 'landing.faq.1.a')}</p></details>)}
          </div>
        </div>
      </section>

      <section className="cierre" aria-labelledby="t-cta">
        <Cinta pill={t('landing.nav.acceso')} n={5} t={t} />
        <div className="banda banda-cierre">
          <div className="c c-cierre">
            <h2 id="t-cta" className="h-gigante" data-rv>{t('landing.cta.titulo')}</h2>
            <p className="desc" data-rv>{t('landing.cta.sub')}</p>
            <a className="l-btn" href={acceso} data-rv>{t('landing.hero.cta')}<span aria-hidden="true">{' ↗'}</span></a>
          </div>
          <p className="c c-palabra" aria-hidden="true">Rovaq</p>
        </div>
      </section>
    </div>

    <footer className="marco l-pie">
      <div className="banda banda-pie">
        <div className="c"><RovaqLogo variante="horizontal" ancho={108} espacioLibre={false} decorativo /><p className="tenue">{t('landing.pie.nota')}</p></div>
        <ul className="c">
          <li><a href={`mailto:${SITE.contacto}`}>{t('landing.pie.contacto')}</a></li>
          <li><a href={seguridad}>{t('landing.pie.seguridad')}</a></li>
          <li><a href={`${APP_URL}/login`}>{t('landing.nav.entrar')}</a></li>
        </ul>
        <p className="c mono tenue">{t('landing.pie.derechos', {anio: new Date().getFullYear()})}</p>
      </div>
    </footer>
  </div>;
}
