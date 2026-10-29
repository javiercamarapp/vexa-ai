// Mockups M1 Hoy, M2 Fuga de reembolsos y M3 Problemas. Todo se dibuja desde datos.ts; el texto de cada pantalla viene de T11.
import {CANALES, DINERO_ATORADO, EXPOSICION_SUBTOTAL, HILOS_MAS_24H, INGRESO_BRUTO, PARETO, PROBLEMAS, REEMBOLSOS, SERIE_INGRESO, SERIE_REEMBOLSOS, T, UI, acumuladoPareto, fmt, totalCanal, totalMes} from './datos';
import type {Lang} from './datos';
import {Alerta, Raya, Sello, Tendencia, Usd, nivelCalor} from './piezas';
import type {Variante} from './piezas';

type Props = {lang: Lang; variante: Variante};

const Periodos = ({lista, activo, extra = ''}: {lista: string[]; activo: number; extra?: string}) => (
  <div className={`s-mock-periodos ${extra}`.trim()}>
    {lista.map((p, i) => (
      <span key={p} className="s-mock-periodo" {...(i === activo ? {'data-activo': ''} : {})}>
        {p}
      </span>
    ))}
  </div>
);

/** M1 Hoy: cuatro cifras con su sello, lo que requiere atención y la siguiente acción. Es la ventana de la sección de valor. */
export function M1({lang, variante}: Props) {
  const t = T(lang).m1;
  const ui = UI(lang);
  const rojo = variante !== 'miniatura';
  const tendencia = [SERIE_INGRESO, SERIE_REEMBOLSOS];
  const claves = ['ingreso-bruto', 'reembolsos', 'dinero-atorado', 'respuestas-24h'];
  const nav = [t.marco, T(lang).m2.marco, T(lang).m3.marco, T(lang).m4.marco, T(lang).m5.marco, T(lang).m6.marco];
  return (
    <div className="s-mock-m1">
      <div className="s-mock-lateral s-mock-sec">
        {nav.map((n, i) => (
          <span key={n} className="s-mock-lateral__item" {...(i === 0 ? {'data-activo': ''} : {})}>
            {n}
          </span>
        ))}
      </div>
      <div className="s-mock-principal">
        <div className="s-mock-cab">
          <p className="s-mock-titulo">{t.marco}</p>
          <Periodos lista={t.periodos} activo={ui.periodoActivo} extra="s-mock-sec" />
          <span className="s-mock-boton s-mock-sec">{t.boton}</span>
        </div>
        <div className="s-mock-cifras">
          {t.tarjetas.map((c, i) => (
            <div key={claves[i]} className="s-mock-cifra" data-cifra={claves[i]} {...(i === 0 ? {'data-enfasis': ''} : {})}>
              <p className="s-mock-etiqueta">{c.t}</p>
              <p className="s-mock-valor">{i === 0 ? <Usd n={INGRESO_BRUTO} /> : i === 1 ? <Usd n={REEMBOLSOS} /> : i === 2 ? <Usd n={DINERO_ATORADO} /> : `${HILOS_MAS_24H} ${lang === 'es' ? 'hilos' : 'threads'}`}</p>
              {i < 2 ? <Tendencia valores={tendencia[i]} /> : <span className="s-mock-tendencia s-mock-tendencia--vacia" aria-hidden="true" />}
              <Sello clase="observado" lang={lang} />
            </div>
          ))}
        </div>
        <div className="s-mock-bloques s-mock-ter">
          <div className="s-mock-bloque" data-atencion="">
            <p className="s-mock-bloque__titulo">
              <Alerta visible={rojo} />
              {t.atencionTitulo}
            </p>
            <p className="s-mock-bloque__texto">{t.atencion}</p>
          </div>
          <div className="s-mock-bloque">
            <p className="s-mock-bloque__titulo">{t.siguienteTitulo}</p>
            <p className="s-mock-bloque__texto">{t.siguiente}</p>
            <span className="s-mock-enlace">{ui.verPaquete}</span>
          </div>
        </div>
        <p className="s-mock-sellopie s-mock-sec">{t.sello}</p>
      </div>
    </div>
  );
}

/** M2 Fuga de reembolsos: titular con su cifra, Pareto por SKU con línea de acumulado, tabla por canal y mes en gris y el paquete de evidencia. */
export function M2({lang}: Props) {
  const t = T(lang).m2;
  const ui = UI(lang);
  const resto = t.titular.replace(/^\S+ \S+ /, '');
  const max = Math.max(...PARETO.map((p) => p.v));
  const tope = Math.ceil(max / 2000) * 2000;
  const acum = acumuladoPareto();
  const puntos = acum.map((a, i) => `${i * 10 + 5},${(100 - (a / REEMBOLSOS) * 100).toFixed(2)}`).join(' ');
  const maxCelda = Math.max(...CANALES.flatMap((c) => c.meses));
  const minCelda = Math.min(...CANALES.flatMap((c) => c.meses));
  const [causa] = t.noSe.replace(/\.$/, '').split(': ');
  return (
    <div className="s-mock-m2">
      <div className="s-mock-principal">
        <div className="s-mock-cab">
          <p className="s-mock-titulo">{t.marco}</p>
          <Periodos lista={[T(lang).m1.periodos[ui.periodoActivo]]} activo={0} extra="s-mock-sec" />
        </div>
        <div className="s-mock-titular">
          <p className="s-mock-valor s-mock-valor--grande"><Usd n={REEMBOLSOS} /></p>
          <p className="s-mock-titular__resto">{resto}</p>
          <Sello clase="observado" lang={lang} />
        </div>
        <div className="s-mock-m2__cuerpo">
          <div className="s-mock-panel">
            <p className="s-mock-sub">{ui.m2.barras}</p>
            <div className="s-mock-pareto">
              <svg className="s-mock-pareto__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                {[0, 25, 50, 75, 100].map((y) => (
                  <line key={y} className="s-mock-rejilla" x1="0" x2="100" y1={y} y2={y} />
                ))}
                <line className="s-mock-referencia" x1="0" x2="100" y1="20" y2="20" />
                {PARETO.map((p, i) => (
                  <rect key={p.sku} className={i === 0 ? 's-mock-barra-pareto s-mock-barra-pareto--enfasis' : 's-mock-barra-pareto'} x={i * 10 + 2} width="6" y={100 - (p.v / tope) * 100} height={(p.v / tope) * 100} />
                ))}
                <polyline className="s-mock-acumulado" points={puntos} />
              </svg>
              <span className="s-mock-eje s-mock-eje--sup">100 %</span>
              <span className="s-mock-eje s-mock-eje--ref">80 %</span>
              <span className="s-mock-eje s-mock-eje--inf">0</span>
            </div>
            <div className="s-mock-pareto__etiquetas" aria-hidden="true">
              {PARETO.map((p) => (
                <span key={p.sku}>{p.sku.slice(3)}</span>
              ))}
            </div>
            <p className="s-mock-leyenda">
              <span className="s-mock-leyenda__linea" aria-hidden="true" />
              {ui.m2.acumulado}
              <span className="s-mock-leyenda__sku">{ui.m2.sku} HM</span>
            </p>
          </div>
          <div className="s-mock-panel s-mock-sec">
            <p className="s-mock-sub">{ui.m2.canalTitulo}</p>
            <div className="s-mock-tabla">
              <span />
              {ui.m2.meses.map((m) => (
                <span key={m} className="s-mock-tabla__cab">
                  {m}
                </span>
              ))}
              <span className="s-mock-tabla__cab">{ui.m2.total}</span>
              {CANALES.map((c, i) => (
                <div key={c.id} className="s-mock-tabla__fila">
                  <span className="s-mock-tabla__canal">{t.canales[i]}</span>
                  {c.meses.map((v, j) => (
                    <span key={j} className={`s-mock-celda s-mock-calor-${nivelCalor(v, minCelda, maxCelda)}`}>
                      {fmt(v)}
                    </span>
                  ))}
                  <span className="s-mock-tabla__total">{fmt(totalCanal(i))}</span>
                </div>
              ))}
              <span className="s-mock-tabla__canal">{ui.m2.total}</span>
              {[0, 1, 2].map((j) => (
                <span key={j} className="s-mock-tabla__pie">
                  {fmt(totalMes(j))}
                </span>
              ))}
              <span className="s-mock-tabla__total s-mock-tabla__total--gran">{fmt(REEMBOLSOS)}</span>
            </div>
            <p className="s-mock-causa">
              <span>{causa}</span>
              <Raya />
              <Sello clase="sindato" lang={lang} />
            </p>
          </div>
        </div>
        <div className="s-mock-acciones s-mock-ter">
          <span className="s-mock-boton s-mock-boton--primario">{t.boton}</span>
          <span className="s-mock-nota">{t.notaBoton}</span>
        </div>
      </div>
    </div>
  );
}

/** M3 Problemas: tres problemas con severidad, casos y clase de exposición; una ficha con dos citas enmascaradas. */
export function M3({lang, variante}: Props) {
  const t = T(lang).m3;
  const ui = UI(lang);
  void variante;
  return (
    <div className="s-mock-m3">
      <div className="s-mock-principal">
        <div className="s-mock-cab">
          <p className="s-mock-titulo">{t.marco}</p>
          <span className="s-mock-resumen s-mock-sec">
            <span className="s-mock-etiqueta">{ui.m3.exposicion}</span>
            <span className="s-mock-valor"><Usd n={EXPOSICION_SUBTOTAL} /></span>
            <Sello clase="inferido" lang={lang} compacto />
          </span>
        </div>
        <div className="s-mock-m3__cuerpo">
          <div className="s-mock-lista">
            <p className="s-mock-sub">{ui.m3.lista}</p>
            {t.filas.map((f, i) => {
              const d = PROBLEMAS[i];
              const [etqExpo] = f.expo.split(': ');
              return (
                <div key={f.t} className="s-mock-problema" {...(i === 0 ? {'data-activo': ''} : {})}>
                  <span className="s-mock-sev" data-sev={d.sev}>
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={n <= d.sev ? 's-mock-sev__b s-mock-sev__b--on' : 's-mock-sev__b'} />
                    ))}
                  </span>
                  <p className="s-mock-problema__t">{f.t}</p>
                  <p className="s-mock-problema__meta">
                    <span>{f.sev}</span>
                    <span className="s-mock-problema__casos">{f.casos}</span>
                  </p>
                  <p className="s-mock-problema__expo">
                    <span className="s-mock-etiqueta">{etqExpo}</span>
                    {d.clase === 'sindato' ? <Raya /> : null}
                    <Sello clase={d.clase} lang={lang} compacto />
                  </p>
                </div>
              );
            })}
          </div>
          <div className="s-mock-ficha s-mock-sec">
            <p className="s-mock-sub">{ui.m3.ficha}</p>
            {t.citas.map((c) => (
              <p key={c} className="s-mock-cita">
                {c}
              </p>
            ))}
            <p className="s-mock-nota">{t.enmascarado}</p>
          </div>
        </div>
        <p className="s-mock-nota s-mock-ter">{t.pie}</p>
      </div>
    </div>
  );
}
