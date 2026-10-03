import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
const fields = (text) => Object.fromEntries(text.trim().split('\n').map(line => line.trim().split(/\s+/).slice(0, 2)));
export function parseHost(cpu, mem, vm) {
  const c = cpu.split('\n')[0].trim().split(/\s+/);
  assert.equal(c.shift(), 'cpu', 'CPU_LINE_REQUIRED');
  assert.ok(c.length >= 8 && c.every(v => /^\d+$/.test(v)), 'CPU_COUNTERS_INVALID');
  const n = c.slice(0, 8).map(Number), m = fields(mem), v = fields(vm);
  for (const x of [...n, Number(m['MemAvailable:']), Number(v.pswpout)]) assert.ok(Number.isSafeInteger(x) && x >= 0, 'HOST_COUNTER_INVALID');
  return {total: n.reduce((a, b) => a + b, 0), idle: n[3] + n[4], steal: n[7], availableKiB: Number(m['MemAvailable:']), swapouts: Number(v.pswpout)};
}
export function hostDelta(a, b) {
  const total = b.total - a.total, idle = b.idle - a.idle, steal = b.steal - a.steal;
  assert.ok(total > 0 && idle >= 0 && idle <= total && steal >= 0 && steal <= total && b.swapouts >= a.swapouts, 'HOST_COUNTER_RESET');
  return {idlePercent: idle / total * 100, stealPercent: steal / total * 100, availableMiB: b.availableKiB / 1024, swapoutsDelta: b.swapouts - a.swapouts};
}
export const hostReady = s => ['idlePercent','stealPercent','availableMiB','swapoutsDelta'].every(k=>Number.isFinite(s[k])&&s[k]>=0) && s.idlePercent<=100 && s.stealPercent<=100 && s.idlePercent >= 50 && s.availableMiB >= 2048 && s.swapoutsDelta === 0 && s.stealPercent <= 5;
export async function sampleHost() {
  assert.equal(os.platform(), 'linux', 'LINUX_HOST_REQUIRED');
  const read = () => parseHost(...['/proc/stat', '/proc/meminfo', '/proc/vmstat'].map(p => fs.readFileSync(p, 'utf8')));
  const a = read(), started = performance.now();
  await new Promise(resolve => setTimeout(resolve, 500));
  return {at: new Date().toISOString(), sampleMs: performance.now() - started, ...hostDelta(a, read())};
}
