import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChartTip, ChartLegend} from '../src/components/ui/chart-parts';
import {ColumnPlot, type ColumnDatum} from '../src/components/ui/column-chart';
import {AreaChart} from '../src/components/ui/area-chart';
import {Sparkline} from '../src/components/ui/sparkline';
import {DonutChart, MAX_DONA} from '../src/components/ui/donut-chart';

const mes = (m: string, value: number | null, extra: Partial<ColumnDatum> = {}): ColumnDatum => ({key: m, label: m, long: m + ' 2026', value, display: value === null ? 'No disponible' : value + ' pedidos', ...extra});
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('tooltip: mes, cifra, variación contra el mes anterior e insignia de clase', () => {
  const html = renderToStaticMarkup(<ChartTip x={100} width={400} title="octubre 2026" kind="observed" delta={{dir: 'up', texto: '+8.4 %', contra: 'sep'}}><strong>1,200 pedidos</strong></ChartTip>);
  const t = text(html);
  assert.match(t, /octubre 2026/); assert.match(t, /1,200 pedidos/); assert.match(t, /\+8\.4 % vs sep/); assert.match(t, /Observado/);
  assert.match(html, /role="status"/);
});

test('tooltip: un mes parcial nunca muestra variación, la sustituye por el aviso', () => {
  const t = text(renderToStaticMarkup(<ChartTip x={390} width={400} title="oct" partial kind="estimated"><strong>5</strong></ChartTip>));
  assert.match(t, /parcial/); assert.match(t, /Sin variación: mes incompleto/); assert.match(t, /Estimado/); assert.doesNotMatch(t, /vs /);
});

test('tooltip: junto al borde derecho se ancla a la izquierda del punto (no se sale)', () => {
  assert.match(renderToStaticMarkup(<ChartTip x={390} width={400} title="x"><b>1</b></ChartTip>), /data-side="left"/);
  assert.match(renderToStaticMarkup(<ChartTip x={20} width={400} title="x"><b>1</b></ChartTip>), /data-side="right"/);
});

test('columnas: parcial con trama y «parcial»; sin datos = «s/d», nunca una barra en cero; 3 marcas de eje', () => {
  const data = [mes('ago', 100), mes('sep', 120), mes('oct', 40, {partial: true}), mes('nov', null)];
  const html = renderToStaticMarkup(<ColumnPlot data={data} title="Pedidos" />);
  assert.equal((html.match(/class="chart-tick"/g) ?? []).length, 3, '3 marcas finas en Y');
  assert.match(html, /parcial<\/text>/); assert.match(html, /s\/d<\/text>/);
  assert.equal((html.match(/class="col-bar /g) ?? []).length, 3, 'la columna sin datos no dibuja barra');
  assert.match(html, /col-partial/); assert.match(html, /fill:url\(#h/);
  assert.match(html, /sin datos/); // aria-label
  assert.match(html, /\(mes incompleto\)/);
  assert.match(text(renderToStaticMarkup(<ChartLegend partial nodata />)), /parcial: mes incompleto, no comparable.*s\/d sin datos/);
});

test('columnas: etiquetas directas del máximo y del último mes completo (no del parcial) y barras finas', () => {
  const data = [mes('may', 50), mes('jun', 90), mes('jul', 60), mes('ago', 55), mes('sep', 65), mes('oct', 70), mes('nov', 99, {partial: true})];
  const html = renderToStaticMarkup(<ColumnPlot data={data} title="x" />);
  const labels = [...html.matchAll(/class="chart-dlabel"[^>]*>([^<]*)</g)].map(m => m[1]);
  assert.deepEqual(labels, ['90', '70']); // 99 es parcial: no se etiqueta
  assert.match(html, /data-last="true"/);
});

test('línea: 3 marcas, etiqueta del último valor y sin puntos salvo el último; parcial punteado', () => {
  const pts = ['ene', 'feb', 'mar', 'abr'].map((l, i) => ({label: l, value: [10, 30, 20, 25][i], display: String([10, 30, 20, 25][i])}));
  pts[3] = {...pts[3], partial: true} as typeof pts[number];
  const html = renderToStaticMarkup(<AreaChart title="Serie" series={[{name: 'u', points: pts}]} />);
  assert.equal((html.match(/class="chart-tick"/g) ?? []).length, 3);
  assert.match(html, /area-line-partial/); assert.match(html, /parcial/);
  assert.doesNotMatch(html, /class="area-dot"/, 'sin hover no hay punto de cruz');
});

test('sparkline de 24 px sin ejes; dona con >5 categorías se sustituye por barras ordenadas', () => {
  const sp = renderToStaticMarkup(<Sparkline data={[1, 3, 2, 5]} label="t" />);
  assert.match(sp, /height="24"/); assert.doesNotMatch(sp, /<text/);
  const segs = Array.from({length: MAX_DONA + 1}, (_, i) => ({key: 'k' + i, label: 'Cat ' + i, value: 10 + i, display: String(10 + i)}));
  const barras = renderToStaticMarkup(<DonutChart title="D" centerValue={99} centerLabel="total" segments={segs} />);
  assert.match(barras, /donut-barras/); assert.doesNotMatch(barras, /<circle/);
  assert.ok(barras.indexOf('Cat 5') < barras.indexOf('Cat 0'), 'ordenadas de mayor a menor');
  const dona = renderToStaticMarkup(<DonutChart title="D" centerValue={99} centerLabel="total" segments={segs.slice(0, MAX_DONA)} />);
  assert.match(dona, /<circle/);
});
