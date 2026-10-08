"""Small local receipt fixtures; no app, build, Docker or external service."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('verify_series', HERE / 'verify-series.py')
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def write(file, value):
    file.write_text(json.dumps(value, indent=2) + '\n')


class SeriesControl(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='SYN-load-series-control-')
        self.root = pathlib.Path(self.tmp.name)
        self.candidate = self.root / 'candidate'
        benchmark_dir = self.candidate / 'packages/jobs/load'
        benchmark_dir.mkdir(parents=True)
        for name in control.BENCHMARK_INVENTORY:
            file = benchmark_dir / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('// SYN control fixture, never executed\n')
        for name in ('apps', 'supabase/migrations', 'tests/acceptance/support'):
            (self.candidate / name).mkdir(parents=True)
        for name in ('tests/acceptance/scaffold-copy.mjs', 'package-lock.json'):
            (self.candidate / name).write_text('{}\n')
        self.source = self.candidate / 'package.json'
        self.source.write_text('{"name":"SYN-fixture"}\n')
        self.manifest = benchmark_dir / 'dependencies.json'
        write(self.manifest, dict(schema='vexa-public-load-source-v1', baselineSha='a' * 40,
                                 files=[dict(path=name, sha256=sha((self.candidate / name).read_bytes())) for name in ('package.json', 'package-lock.json', 'tests/acceptance/scaffold-copy.mjs')]))
        benchmark = {name: sha((benchmark_dir / name).read_bytes()) for name in control.BENCHMARK}
        self.paths, self.reports = [], []
        for index, rows in enumerate(control.SCALES):
            directory = self.root / str(rows)
            dataset_dir = directory / ('dataset-' + str(rows))
            dataset_dir.mkdir(parents=True)
            t = datetime(2026, 10, 7, tzinfo=timezone.utc) + timedelta(hours=index)
            stamp = lambda seconds: (t + timedelta(seconds=seconds)).isoformat()
            expected = dict(total=rows, accepted=rows * 98 // 100, rejected=rows // 100, duplicates=rows // 100, pending=0)
            files, declared, chunks = [], [], []
            for part, offset in enumerate(range(0, rows, 50000)):
                count = min(50000, rows - offset)
                # Realistic 98/1/1 SYN rows; never sent to a product.
                records = []
                for i in range(offset, offset + count):
                    date = 'SYN-invalid-date' if i % 100 == 49 else '2026-09-01T00:00:00Z'
                    records.append(records[-1] if i % 100 == 99 else f'SYN-{rows}-{i},SYN fixture {i},{date},customer,SYN-conversation-{i}')
                raw = ('id,text,date,role,conversation\n' + '\n'.join(records) + '\n').encode()
                name = f'SYN-{rows}-{rows + 308}-part-{part + 1}.csv'
                (dataset_dir / name).write_bytes(raw)
                descriptor = dict(filename=name, rows=count, bytes=len(raw), sha256=sha(raw), firstIndex=offset, lastIndex=offset + count - 1)
                declared.append(descriptor)
                count_data = dict(total=count, accepted=count * 98 // 100, rejected=count // 100, duplicates=count // 100, pending=0)
                job = f'{index + 1:08x}-0000-0000-0000-{part + 1:012x}'
                file = dict(descriptor, jobId=job, importId=f'{index + 1:08x}-1111-0000-0000-{part + 1:012x}',
                            observed=dict(count_data, fileHash=sha(raw)), apiCounters=count_data,
                            jobTiming=dict(state='partial', firstStartedAt=stamp(2), lastFinishedAt=stamp(102), deadline=stamp(902), elapsedMs=100000, failureCount=0))
                files.append(file)
                for n in range(100, count + 1, 100):
                    begin = len(chunks) * 2
                    chunks.append(dict(kind='chunk', jobId=job, rows=100, offset=n, done=n == count,
                                       committed=True, startedAt=stamp(3), finishedAt=stamp(3.001),
                                       monotonicStartMs=begin, monotonicEndMs=begin + 1, commitMs=1,
                                       cpuMicroseconds=dict(user=100, system=20), memory=dict(rss=1024), maxRssKiB=100))
            dataset = dict(schema='vexa-synthetic-load-v1', synthetic=True, rows=rows, seed=rows + 308,
                           generator='SYN control fixture', limits=dict(rowsPerFile=50000, bytesPerFile=20971520), expected=expected, files=declared)
            dataset['sha256'] = sha(json.dumps(dataset, separators=(',', ':'), ensure_ascii=False).encode())
            write(dataset_dir / 'manifest.json', dataset)
            requests = [dict(label=label, ms=1) for label in ['reserve', 'storage_upload', 'mapping_preview', 'confirm'] * len(files) + ['job_status'] * len(files)]
            metrics = dict(inputRowsPerSecond=rows / 200, acceptedRowsPerSecond=expected['accepted'] / 200,
                           commitP50Ms=1, commitP95Ms=1, apiP95Ms=1, commitSamples=len(chunks), apiSamples=len(requests), workerMaxRssKiB=100)
            scale = dict(rows=rows, seed=rows + 308, status='pass', concurrency=1, workerChunkRows=100,
                         jobDeadlineMs=900000, files=files, dataset=dataset, observed=expected, chunks=chunks,
                         startedAt=stamp(.5), processingMs=200000, endToEndMs=201000, metrics=metrics,
                         apiRequests=requests, explain='[{"Plan":{"Node Type":"Aggregate"}}]')
            broker = f'{index + 1:08x}-2222-0000-0000-000000000001'
            name = f'vexa-f01-03-{index + 1:08x}-3333-0000-0000-000000000001'
            journal = [dict(kind='network' if not suffix else 'container', name=name + suffix, broker=broker) for suffix in ('', '-db', '-auth', '-rest', '-storage')]
            resources = [dict(item, id=f'{index * 5 + n + 1:064x}', absent=True) for n, item in enumerate(journal)]
            (directory / 'resources.jsonl').write_text(''.join(json.dumps(item) + '\n' for item in journal))
            cleanup = dict(ownResourcesRemoved=True, temporaryPathsRemoved=True, resources=resources)
            write(directory / 'cleanup.json', cleanup)
            report = dict(schema='vexa-load-result-v1', synthetic=True, status='measured', candidate=str(self.candidate),
                          baselineSha='a' * 40, proposalDependencies=False, dependencyManifestSha256=sha(self.manifest.read_bytes()),
                          benchmarkImplementation=benchmark, startedAt=stamp(0), finishedAt=stamp(210),
                          hardware=dict(environment='SYN fixture'), versions=dict(node='v22.23.2'),
                          cost=dict(measured=False, total=None), slo=dict(approved=False), indexes=['SYN index'], samples=[dict(at=stamp(1))],
                          scales=[scale], processes=[dict(pid=100 + index, startedAt=stamp(1), endedAt=stamp(205),
                                                        chunks=chunks, maxRssKiB=100, exitCode=None, signal='SIGKILL', stderr='')],
                          cleanup=cleanup,
                          priorEvidence=None if not index else dict(path=str(self.paths[-1]), sha256=sha(self.paths[-1].read_bytes()), validatedScale=control.SCALES[index - 1]))
            file = directory / 'report.json'
            write(file, report)
            self.paths.append(file)
            self.reports.append(report)
        self.originals = [p.read_bytes() for p in self.paths]

    def tearDown(self):
        self.tmp.cleanup()

    def verify(self):
        return control.verify_series(self.paths, self.manifest, self.candidate)

    def corrupt_last(self, change, message):
        value = copy.deepcopy(self.reports[-1])
        change(value)
        write(self.paths[-1], value)
        with self.assertRaisesRegex(ValueError, message):
            self.verify()

    def test_positive_all_originals_preserved(self):
        result = self.verify()
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual([x['recount'] for x in result['scales']], list(control.SCALES))
        self.assertFalse(result['accepted'])
        self.assertFalse(result['production'])
        self.assertEqual([p.read_bytes() for p in self.paths], self.originals)

    def test_tampered_terminal_count(self):
        self.corrupt_last(lambda d: d['scales'][0]['observed'].update(accepted=146999), 'COUNTER_CONSERVATION')

    def test_tampered_api_count(self):
        self.corrupt_last(lambda d: d['scales'][0]['files'][0]['apiCounters'].update(accepted=48999, rejected=501), 'API_SQL_COUNTERS')

    def test_tampered_prior_hash(self):
        self.corrupt_last(lambda d: d['priorEvidence'].update(sha256='0' * 64), 'PRIOR_REPORT_BINDING')

    def test_changed_source(self):
        self.source.write_text('tampered')
        with self.assertRaisesRegex(ValueError, 'SOURCE_HASH'):
            self.verify()

    def test_failed_cleanup(self):
        self.corrupt_last(lambda d: d['cleanup'].update(temporaryPathsRemoved=False), 'CLEANUP_REQUIRED')

    def test_failed_prior_never_becomes_favorable(self):
        first = copy.deepcopy(self.reports[0])
        first['status'] = 'failed'
        write(self.paths[0], first)
        with self.assertRaisesRegex(ValueError, 'REPORT_MUST_BE_MEASURED'):
            self.verify()
        self.assertEqual(json.loads(self.paths[0].read_bytes())['status'], 'failed')

    def test_file_hash_and_chunk_offset_tampering(self):
        self.corrupt_last(lambda d: d['scales'][0]['chunks'][0].update(offset=101), 'TERMINAL_OFFSETS')
        write(self.paths[-1], self.reports[-1])
        file = self.paths[-1].parent / 'dataset-150000' / 'SYN-150000-150308-part-1.csv'
        file.write_bytes(file.read_bytes() + b'tampered\n')
        with self.assertRaisesRegex(ValueError, 'DATASET_HASH'):
            self.verify()

    def test_job_deadline_and_rss(self):
        self.corrupt_last(lambda d: d['scales'][0]['files'][0]['jobTiming'].update(deadline=d['startedAt']), 'JOB_DEADLINE')
        self.corrupt_last(lambda d: d['scales'][0]['metrics'].update(workerMaxRssKiB=101), 'METRIC_RSS')

    def test_added_source_and_benchmark_file(self):
        for path, code in [('apps/unlisted.ts', 'SOURCE_EXACT_INVENTORY'), ('packages/jobs/load/unlisted.mjs', 'BENCHMARK_EXACT_INVENTORY')]:
            file = self.candidate / path
            file.write_text('SYN extra')
            with self.assertRaisesRegex(ValueError, code):
                self.verify()
            file.unlink()

    def test_source_symlink(self):
        file = self.candidate / 'apps/link'
        file.symlink_to(self.source)
        with self.assertRaisesRegex(ValueError, 'SOURCE_SYMLINK'):
            self.verify()

    def test_processing_limit(self):
        self.corrupt_last(lambda d: d['scales'][0].update(processingMs=3600000, endToEndMs=3600001), 'PROCESSING_DEADLINE')

    def test_job_state_failures_and_elapsed_boundaries(self):
        for values, code in [(dict(state='succeeded'), 'TERMINAL_JOB_REQUIRED'), (dict(failureCount=1), 'JOB_FAILURE_COUNT'), (dict(elapsedMs=0), 'JOB_TIMING'), (dict(elapsedMs=900000), 'JOB_TIMING')]:
            self.corrupt_last(lambda d: d['scales'][0]['files'][0]['jobTiming'].update(values), code)

    def test_dataset_hash_limits_and_partition(self):
        original = self.paths[-1].parent / 'dataset-150000/manifest.json'
        for kind, code in [('hash', 'DATASET_MANIFEST_HASH'), ('limits', 'DATASET_LIMITS'), ('partition', 'FILE_PARTITION')]:
            value = copy.deepcopy(self.reports[-1])
            dataset = value['scales'][0]['dataset']
            if kind == 'hash':
                dataset['sha256'] = '0' * 64
            else:
                if kind == 'limits':
                    dataset['limits']['rowsPerFile'] = 150000
                else:
                    dataset['files'][1]['firstIndex'] = 0
                    value['scales'][0]['files'][1]['firstIndex'] = 0
                unsigned = {k: v for k, v in dataset.items() if k != 'sha256'}
                dataset['sha256'] = sha(json.dumps(unsigned, separators=(',', ':'), ensure_ascii=False).encode())
            write(original, dataset)
            write(self.paths[-1], value)
            with self.assertRaisesRegex(ValueError, code):
                self.verify()

    def test_cleanup_journal_coverage(self):
        root = self.paths[-1].parent
        value = copy.deepcopy(self.reports[-1])
        value['cleanup']['resources'].pop()
        write(root / 'cleanup.json', value['cleanup'])
        write(self.paths[-1], value)
        with self.assertRaisesRegex(ValueError, 'RESOURCE_ABSENCE_RECEIPTS'):
            self.verify()
        write(self.paths[-1], self.reports[-1])
        write(root / 'cleanup.json', self.reports[-1]['cleanup'])
        journal = root / 'resources.jsonl'
        entries = [json.loads(line) for line in journal.read_text().splitlines()]
        entries[0]['name'] = entries[0]['name'] + '-foreign'
        journal.write_text(''.join(json.dumps(item) + '\n' for item in entries))
        with self.assertRaisesRegex(ValueError, 'CLEANUP_JOURNAL_COVERAGE'):
            self.verify()

    def test_strict_control_types_and_terminal_marker(self):
        self.corrupt_last(lambda d: d['scales'][0].update(concurrency=True), 'UNCHANGED_LOAD_LIMITS')
        self.corrupt_last(lambda d: d['scales'][0]['chunks'][0].update(done=0), 'CHUNK_TERMINAL_MARKER')

    def test_unique_identifiers_between_reports(self):
        self.corrupt_last(lambda d: d['scales'][0]['files'][0].update(importId=self.reports[0]['scales'][0]['files'][0]['importId']), 'SERIES_UNIQUE_JOB_IMPORT')

    def test_cli_fail_closed_under_python_optimization(self):
        self.corrupt_last(lambda d: d.update(status='failed'), 'REPORT_MUST_BE_MEASURED')
        out = self.root / 'review.json'
        command = [sys.executable, '-O', str(HERE / 'verify-series.py'), *map(str, self.paths), '--candidate', str(self.candidate), '--manifest', str(self.manifest), '--out', str(out)]
        result = subprocess.run(command, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(out.read_bytes())['status'], 'FAIL')
        before = out.read_bytes()
        again = subprocess.run(command, capture_output=True, timeout=10)
        self.assertNotEqual(again.returncode, 0)
        self.assertEqual(out.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
