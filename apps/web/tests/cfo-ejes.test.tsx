import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {seriesPoints} from '../src/components/cfo/series';
import {MonthBars, type MonthPoint} from '../src/components/cfo/month-bars';
import {buildCfoReport, ledgerMonthlyFixture, FIXTURE_WATERMARK} from '../../../packages/cfo-copilot/src/index.mjs';

// QA2-001: el eje debe estar en la misma unidad que la tarjeta y el tooltip (unidades mayores), no en centavos.
const report = buildCfoReport(ledgerMonthlyFixture(), {watermark: FIXTURE_WATERMARK});
const ticksOf = (html: string) => [...html.matchAll(/<text[^>]*class="chart-tick"[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
// Etiqueta compacta es-MX («804 k», «1 M», «8 k») -> número. El eje usa marcas «agradables»: el tope es >= el máximo y a lo sumo 1.5 veces mayor.
const parseCompact = (t: string) => { const m = /^(-?[\d.,]+)\s?(k|mil|M)?$/.exec(t.replace(/\u00a0/g, ' ')); assert.ok(m, 'etiqueta ilegible: ' + t); return Number(m[1].replace(/,/g, '')) * (m[2] === 'M' ? 1e6 : m[2] ? 1e3 : 1); };
const assertTopAxis = (top: string, maxMajor: number, msg: string) => { const v = parseCompact(top); assert.ok(v >= maxMajor * 0.995 && v <= maxMajor * 1.5, `${msg}: tope ${top} fuera de [${maxMajor}, ${maxMajor * 1.5}]`); };
const parseDisplay = (d: string) => Number(d.replace(/[^\d.,-]/g, '').replace(/,/g, ''));

test('ejes de Ingresos y Reembolsos: el tick máximo coincide con el mayor valor mostrado en tooltip/tabla, en cada moneda', () => {
  let checked = 0;
  for (const pc of report.perCurrency) {
    const line = pc.orderBases[0];
    for (const [title, series] of [['Ingresos por mes', line.series], ['Importe reembolsado por mes', pc.refunds.series]] as const) {
      const points: MonthPoint[] = series.map((s) => ({month: s.month, partial: s.partial, value: s.known > 0 ? Number(BigInt(s.amount)) : null, label: s.amountDisplay}));
      const known = series.filter((s) => s.known > 0);
      if (!known.length) continue;
      const html = renderToStaticMarkup(<MonthBars title={title} unit={pc.currency} points={points} exponent={pc.exponent} />);
      const top = ticksOf(html).at(-1)!;
      const maxMinor = known.reduce((a: bigint, s) => (BigInt(s.amount) > a ? BigInt(s.amount) : a), 0n);
      const maxDisplay = known.find((s) => BigInt(s.amount) === maxMinor)!.amountDisplay as string;
      assertTopAxis(top, Number(maxMinor) / 10 ** pc.exponent, `${pc.currency} ${title}`);
      // El número del eje es del orden de magnitud del tooltip (no 100x): compacto == display redondeado.
      const shown = parseDisplay(maxDisplay);
      assert.ok(Math.abs(shown - Number(maxMinor) / 10 ** pc.exponent) < 0.01, 'display coherente con exponente');
      assert.ok(shown < 1e8 ? !/\bM$/.test(top) || shown >= 6e5 : true, `eje inflado: ${top} vs ${maxDisplay}`);
      checked++;
    }
  }
  assert.ok(checked >= 3);
});

test('cableado real del tablero CFO: seriesPoints entrega exponente y el eje cuadra con el tooltip en cada medida y moneda', () => {
  for (const pc of report.perCurrency) for (const measure of ['ingresos', 'reembolsos', 'pedidos', 'tasa'] as const) {
    const v = seriesPoints(pc, measure);
    const html = renderToStaticMarkup(<MonthBars title={v.title} unit={v.unit} points={v.points} exponent={v.exponent} />);
    const top = ticksOf(html).at(-1)!;
    const best = v.points.filter(p => p.value !== null).sort((a, b) => b.value! - a.value!)[0];
    if (!best) continue;
    assertTopAxis(top, best.value! / 10 ** v.exponent, `${pc.currency} ${measure}`);
    if (measure === 'ingresos' || measure === 'reembolsos') assert.equal(v.exponent, pc.exponent);
  }
});

test('caso conocido de QA2-001: 803,982.16 USD en centavos se rotula 804 mil, no 80.4 M', () => {
  const html = renderToStaticMarkup(<MonthBars title="Ingresos por mes" unit="USD" exponent={2} points={[{month: '2026-09', value: 80398216, label: '803,982.16 USD'}]} />);
  const top = ticksOf(html).at(-1)!;
  assertTopAxis(top, 803982.16, 'QA2-001'); // nunca 80.4 M (centavos sin reescalar)
  assert.ok(parseCompact(top) < 1.2e6, 'eje inflado 100x: ' + top);
});

test('sin exponente (conteos y proyecciones ya en unidades mayores) el eje no se reescala', () => {
  const html = renderToStaticMarkup(<MonthBars title="Pedidos" unit="pedidos" points={[{month: '2026-09', value: 6316, label: '6,316 pedidos'}]} />);
  assertTopAxis(ticksOf(html).at(-1)!, 6316, 'conteos');
});

test('Tendencias del Resumen (TrendCharts): el eje de importes mide el importe, no puntos base del máximo', async () => {
  const {Bars, ledgerAxis} = await import('../src/components/ui/trend-chart');
  const html = renderToStaticMarkup(<Bars title="Pedidos registrados por mes" unit="USD" kind="observed" tickLabel={ledgerAxis(80398216n, 2)} points={[{month: '2026-08', value: 5000, label: '401,991.08 USD'}, {month: '2026-09', value: 10000, label: '803,982.16 USD'}]} />);
  const t = ticksOf(html);
  assert.match(t.at(-1)!, /^80[34][.,]?\d*\s?(k|mil)$/);
  assert.match(t.at(-2)!, /^40[12][.,]?\d*\s?(k|mil)$/);
  assert.ok(!t.some(x => /^10\s?(k|mil)$/.test(x)), 'no debe mostrar 10 k (bps)');
});
