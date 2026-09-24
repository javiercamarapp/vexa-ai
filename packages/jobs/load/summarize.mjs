import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Usage: node summarize.mjs report10K.json report50K.json report150K.json
// Output is a report of observed evidence, never an acceptance decision.
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const inputs = process.argv.slice(2);
assert.equal(inputs.length, 3, 'THREE_REPORTS_REQUIRED');
const reports = inputs.map((filename) => {
  const bytes = fs.readFileSync(filename);
  return { filename, sha256: sha256(bytes), report: JSON.parse(bytes) };
});
assert.equal(new Set(reports.map(({ report }) => report.candidate)).size, 1, 'SAME_CANDIDATE_REQUIRED');
const scales = reports.map(({ filename, sha256: reportHash, report }, index) => {
  const scale = report.scales.find((item) => item.rows === [10000, 50000, 150000][index]);
  assert.ok(scale, 'EXPECTED_SCALE_REQUIRED');
  const directory = path.dirname(filename);
  const manifest = path.join(directory, 'immutable-manifest.json');
  const dataset = path.join(directory, `dataset-${scale.rows}`, 'manifest.json');
  let explainExecutionMs = null;
  if (scale.explain) explainExecutionMs = JSON.parse(scale.explain)[0]['Execution Time'];
  return {
    rows: scale.rows,
    status: scale.status,
    seed: scale.seed,
    files: scale.files.map((file) => ({
      filename: file.filename, rows: file.rows, bytes: file.bytes, sha256: file.sha256,
      importId: file.importId, jobId: file.jobId, observed: file.observed,
      jobTiming: file.jobTiming ?? null,
    })),
    tenantsWithLoad: 1,
    connectionsWithLoad: 1,
    concurrency: scale.concurrency,
    chunkRows: scale.workerChunkRows,
    deadlineMs: scale.jobDeadlineMs,
    expected: scale.dataset.expected,
    observed: scale.observed ?? null,
    processingMs: scale.processingMs ?? null,
    endToEndMs: scale.endToEndMs ?? null,
    metrics: scale.metrics ?? null,
    explainExecutionMs,
    report: filename,
    reportSha256: reportHash,
    immutableManifestSha256: fs.existsSync(manifest) ? sha256(fs.readFileSync(manifest)) : null,
    datasetManifestSha256: fs.existsSync(dataset) ? sha256(fs.readFileSync(dataset)) : null,
    benchmarkImplementation: report.benchmarkImplementation ?? null,
    benchmarkSource: path.join(directory, 'benchmark-source'),
    hardware: report.hardware,
    versions: report.versions,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt ?? null,
    processes: report.processes.map(({ pid, startedAt, endedAt, exitCode, signal, maxRssKiB }) => ({
      pid, startedAt, endedAt, exitCode, signal, maxRssKiB,
    })),
    resourceCleanup: report.cleanup ?? null,
    error: report.error ?? null,
  };
});
const latest = reports.at(-1).report;
const result = {
  schema: 'vexa-load-results-summary-v1',
  task_id: 'F07-04',
  status: scales.every((scale) => scale.status === 'pass')
    ? 'measured_proposal_not_accepted' : 'partial_measurement_proposal_not_accepted',
  baseline_sha: latest.baselineSha,
  candidate: latest.candidate,
  dependency_manifest: 'packages/jobs/load/dependencies.json',
  dependencyManifestSha256: sha256(fs.readFileSync(new URL('./dependencies.json', import.meta.url))),
  dependencies_status: 'Proposed F06-09 to F06-12 composition; not authored by this change. Independent acceptance and blocked F06-09 security review remain pending.',
  cost: latest.cost,
  slo: latest.slo,
  scales,
  limitations: [
    'Local shared hardware; no commercial capacity, monthly volume, or concurrent-user extrapolation.',
    'One tenant, one connection and one worker carry the load; 150K uses three actual sequential jobs.',
    'Synthetic short texts; no extraction, LLM, usable snapshot or human comprehension benchmark.',
    'The different proposed 1000-message, two-tenant, two-job pipeline target is not tested here.',
    'API p95 mixes a few different operations; denominators are reported. Commit p95 concerns measured chunks only.',
    'Worker RSS is a process high-water mark. Docker memory is sampled every five seconds; web process RSS is not measured.',
    'Money costs are unknown null; no paid providers or real customer data.',
    'Node 22 ran the actual load. Generator and escalation probes also ran on Node 26; this does not constitute a Node 26 full-load run.',
    'Earlier measurements retain their exact benchmark source. The final runner adds dependency verification and per-job timing without rerunning them.',
    'Independent external gate remains pending. No accepted counter or orchestration state is changed.',
  ],
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
