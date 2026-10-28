import {RovaqLogo} from '../rovaq-logo';
import {SITE, APP_URL, landingUrl} from '../../lib/site.mjs';
import {traductor, type Idioma} from '../../lib/i18n';
import {IdiomaLocal} from '../i18n/proveedor';
import {SelectorIdioma} from '../i18n/selector-idioma';
import {MockHoy, MockFuentes, MockProblemas, MockReembolsos, MockDecidir, Miniatura} from './mocks';
import {MovimientoLanding, SelectorTemaLanding, SombreadoLanding} from './cliente';
import './landing.css';

const PASOS = [1, 2, 3, 4] as const;
const CAPS = [1, 2, 3, 4, 5, 6] as const;
const CUENTAS = [1, 2, 3, 4] as const;
const SEG = [1, 2, 3, 4, 5, 6] as const;
const FAQ = [1, 2, 3, 4, 5, 6, 7] as const;

/** Datos estructurados mínimos de la landing: organización y sitio. Sin valoraciones, precios ni clientes. */
export function jsonLdLanding(base = landingUrl()) {
  return {'@context': 'https://schema.org', '@graph': [
    {'@type': 'Organization', '@id': `${base}/#organizacion`, name: SITE.nombre, alternateName: [SITE.corto], url: base, logo: `${base}/brand/rovaq-logo-horizontal-positivo-600px.png`, email: SITE.contacto},
    {'@type': 'WebSite', '@id': `${base}/#sitio`, name: SITE.nombre, url: base, publisher: {'@id': `${base}/#organizacion`}},
  ]};
}

export function Landing({idioma}: {idioma: Idioma}) {
  const t = traductor(idioma);
  const acceso = `mailto:${SITE.contacto}?subject=${encodeURIComponent(t('landing.acceso.asunto'))}&body=${encodeURIComponent(t('landing.acceso.cuerpo'))}`;
  const seguridad = `mailto:${SITE.contacto}?subject=${encodeURIComponent(t('landing.pie.asuntoSeg'))}`;
  const palabras = t('landing.prob.frase').split(' ');
  const mocks = [<MockFuentes key="1" t={t} />, <MockProblemas key="2" t={t} />, <MockReembolsos key="3" t={t} contar />, <MockDecidir key="4" t={t} />];
  return <div className="landing">
    <MovimientoLanding />
    <header className="l-nav">
      <div className="l-nav-in">
        <a className="l-logo" href="#inicio" aria-label={t('landing.nav.inicio')}><RovaqLogo variante="horizontal" ancho={112} espacioLibre={false} decorativo /></a>
        <nav className="l-nav-links" aria-label={t('landing.nav.aria')}>
          <a href="#producto">{t('landing.nav.producto')}</a><a href="#como">{t('landing.nav.como')}</a><a href="#seguridad">{t('landing.nav.seguridad')}</a><a href="#faq">{t('landing.nav.faq')}</a>
        </nav>
        <div className="l-nav-der">
          <IdiomaLocal idioma={idioma}><SelectorIdioma /></IdiomaLocal>
          <SelectorTemaLanding etiqueta={t('landing.tema.cambiar')} />
          <a className="l-btn l-btn-sm l-nav-cta" href={acceso}>{t('landing.nav.acceso')}</a>
        </div>
      </div>
    </header>

    <section className="l-hero" id="inicio">
      <SombreadoLanding />
      <div className="l-wrap l-hero-in">
        <p className="l-eyebrow l-in" data-i="0"><i className="punto-rojo" />{t('landing.hero.eyebrow')}</p>
        <h1 className="l-h1"><span className="linea"><span className="linea-in" data-i="1">{t('landing.hero.titulo')}</span></span></h1>
        <div className="l-hero-fila l-in" data-i="2">
          <p className="l-lead">{t('landing.hero.sub')}</p>
          <div className="l-acciones">
            <a className="l-btn" href={acceso}>{t('landing.hero.cta')}</a>
            <a className="l-btn l-btn-borde" href="#como">{t('landing.hero.cta2')}</a>
          </div>
        </div>
        <ul className="l-hechos l-in" data-i="3"><li>{t('landing.hero.hecho1')}</li><li>{t('landing.hero.hecho2')}</li><li>{t('landing.hero.hecho3')}</li></ul>
      </div>
      <div className="l-wrap l-hero-mock l-in" data-i="4"><MockHoy t={t} /></div>
    </section>

    <section className="l-sec l-problema" aria-labelledby="t-prob">
      <div className="l-wrap">
        <h2 id="t-prob" className="l-h2 rv">{t('landing.prob.titulo')}</h2>
        <p className="frase" data-frase>{palabras.map((w, i) => <span className="w" key={i}>{w}{' '}</span>)}</p>
        <ul className="l-tres">
          {[1, 2, 3].map((n) => <li key={n} className="rv"><h3>{t(`landing.prob.p${n}.t` as 'landing.prob.p1.t')}</h3><p>{t(`landing.prob.p${n}.d` as 'landing.prob.p1.d')}</p></li>)}
        </ul>
      </div>
    </section>

    <section className="l-sec" id="producto" aria-labelledby="t-val">
      <div className="l-wrap">
        <div className="l-cab"><h2 id="t-val" className="l-h2 rv">{t('landing.val.titulo')}</h2><p className="l-lead rv">{t('landing.val.sub')}</p></div>
        <dl className="l-etq-lista">
          {([['obs', 'landing.val.obs', 'landing.val.obs.d'], ['est', 'landing.val.est', 'landing.val.est.d'], ['inf', 'landing.val.inf', 'landing.val.inf.d'], ['sin', 'landing.val.sin', 'landing.val.sin.d']] as const).map(([k, a, b]) =>
            <div key={k} className="rv"><dt><em className={'etq' + (k === 'sin' ? ' sin' : '')}>{t(a)}</em></dt><dd>{t(b)}</dd></div>)}
        </dl>
        <ul className="l-tres l-tarjetas">
          {[1, 2, 3].map((n) => <li key={n} className="rv tilt"><h3>{t(`landing.val.c${n}.t` as 'landing.val.c1.t')}</h3><p>{t(`landing.val.c${n}.d` as 'landing.val.c1.d')}</p></li>)}
        </ul>
      </div>
    </section>

    <section className="l-oscura" id="como" aria-labelledby="t-como">
      <div className="l-wrap l-cab-como">
        <p className="l-eyebrow"><i className="punto-rojo" />{t('landing.como.eyebrow')}</p>
        <h2 id="t-como" className="l-h2">{t('landing.como.titulo')}</h2>
        <p className="l-lead">{t('landing.como.sub')}</p>
      </div>
      <div className="pasos-pista" data-pasos>
        <div className="pasos-fijo">
          <div className="l-wrap pasos-grid">
            <div className="pasos-riel" aria-hidden="true">{PASOS.map((n) => <i key={n} data-paso={n} />)}</div>
            <div className="pasos-escena">
              {PASOS.map((n) => <article key={n} className="panel" data-paso={n}>
                <div className="panel-texto">
                  <p className="mono">{t('landing.como.paso', {n, total: PASOS.length})}</p>
                  <h3>{t(`landing.como.${n}.t` as 'landing.como.1.t')}</h3>
                  <p>{t(`landing.como.${n}.d` as 'landing.como.1.d')}</p>
                </div>
                <div className="panel-mock">{mocks[n - 1]}</div>
              </article>)}
            </div>
          </div>
        </div>
        <div className="pasos-centinelas" aria-hidden="true">{PASOS.map((n) => <i key={n} data-centinela={n} />)}</div>
      </div>
    </section>

    <section className="l-sec" aria-labelledby="t-cap">
      <div className="l-wrap">
        <div className="l-cab"><h2 id="t-cap" className="l-h2 rv">{t('landing.cap.titulo')}</h2><p className="l-lead rv">{t('landing.cap.sub')}</p></div>
        <ul className="l-caps">
          {CAPS.map((n) => <li key={n} className="rv tilt"><div className="cap-vis"><Miniatura n={n} t={t} /></div><h3>{t(`landing.cap.${n}.t` as 'landing.cap.1.t')}</h3><p>{t(`landing.cap.${n}.d` as 'landing.cap.1.d')}</p></li>)}
        </ul>
        <p className="l-nota"><span className="sint">{t('landing.sintetico')}</span> {t('landing.cap.nota')}</p>
      </div>
    </section>

    <section className="l-sec l-gris" aria-labelledby="t-cuentas">
      <div className="l-wrap">
        <div className="l-cab"><h2 id="t-cuentas" className="l-h2 rv">{t('landing.cuentas.titulo')}</h2><p className="l-lead rv">{t('landing.cuentas.sub')}</p></div>
        <ul className="l-cuatro">
          {CUENTAS.map((n) => <li key={n} className="rv"><h3>{t(`landing.cuentas.${n}.t` as 'landing.cuentas.1.t')}</h3><p>{t(`landing.cuentas.${n}.d` as 'landing.cuentas.1.d')}</p></li>)}
        </ul>
        <p className="l-nota">{t('landing.cuentas.nota')}</p>
      </div>
    </section>

    <section className="l-sec" id="seguridad" aria-labelledby="t-seg">
      <div className="l-wrap l-seg">
        <div>
          <p className="l-eyebrow rv"><i className="punto-rojo" />{t('landing.seg.eyebrow')}</p>
          <h2 id="t-seg" className="l-h2 rv">{t('landing.seg.titulo')}</h2>
          <p className="l-lead rv">{t('landing.seg.sub')}</p>
          <ul className="l-checks">{SEG.map((n) => <li key={n} className="rv">{t(`landing.seg.${n}` as 'landing.seg.1')}</li>)}</ul>
        </div>
        <aside className="l-ruta rv" aria-labelledby="t-ruta">
          <h3 id="t-ruta">{t('landing.seg.ruta.t')}</h3>
          <p>{t('landing.seg.ruta.d')}</p>
          <p className="tenue">{t('landing.seg.cert')}</p>
        </aside>
      </div>
    </section>

    <section className="l-sec l-gris" aria-labelledby="t-int">
      <div className="l-wrap">
        <div className="l-cab"><h2 id="t-int" className="l-h2 rv">{t('landing.int.titulo')}</h2></div>
        <div className="l-int">
          <div className="rv"><h3 className="mono">{t('landing.int.hoy')}</h3>
            <ul>
              <li><b>HubSpot</b><p>{t('landing.int.hubspot')}</p></li>
              <li><b>{t('landing.int.excel')}</b><p>{t('landing.int.excel.d')}</p></li>
            </ul></div>
          <div className="rv"><h3 className="mono">{t('landing.int.ruta')}</h3>
            <ul><li><b>Amazon, Walmart, Shopify</b><p>{t('landing.int.ruta.d')}</p></li></ul></div>
        </div>
      </div>
    </section>

    <section className="l-sec" id="faq" aria-labelledby="t-faq">
      <div className="l-wrap l-faq">
        <h2 id="t-faq" className="l-h2 rv">{t('landing.faq.titulo')}</h2>
        <div className="l-faq-lista">
          {FAQ.map((n) => <details key={n} className="rv"><summary>{t(`landing.faq.${n}.q` as 'landing.faq.1.q')}</summary><p>{t(`landing.faq.${n}.a` as 'landing.faq.1.a')}</p></details>)}
        </div>
      </div>
    </section>

    <section className="l-cierre" aria-labelledby="t-cta">
      <div className="l-wrap">
        <h2 id="t-cta" className="l-h2 rv">{t('landing.cta.titulo')}</h2>
        <p className="l-lead rv">{t('landing.cta.sub')}</p>
        <a className="l-btn l-btn-claro rv" href={acceso}>{t('landing.hero.cta')}</a>
      </div>
    </section>

    <footer className="l-pie">
      <div className="l-wrap l-pie-in">
        <div><RovaqLogo variante="horizontal" ancho={112} espacioLibre={false} decorativo /><p>{t('landing.pie.nota')}</p></div>
        <ul>
          <li><a href={`mailto:${SITE.contacto}`}>{t('landing.pie.contacto')}</a></li>
          <li><a href={seguridad}>{t('landing.pie.seguridad')}</a></li>
          <li><a href={`${APP_URL}/login`}>{t('landing.nav.entrar')}</a></li>
        </ul>
        <p className="tenue">{t('landing.pie.derechos', {anio: new Date().getFullYear()})}</p>
      </div>
      <p className="l-marca" aria-hidden="true">Rovaq</p>
    </footer>
  </div>;
}
