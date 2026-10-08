"""Read-only control for three original, separately measured load reports.

Preserves verify-report.py's oracles, applied once per scale, and verifies the
PREVIOUS_REPORT chain. Stdout (or a new --out file) is a review receipt, never a
replacement measurement, task acceptance, or production-capacity claim.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import pathlib
import re
import sys
from datetime import datetime

SCALES = (10000, 50000, 150000)
BENCHMARK = ('generator.mjs', 'harness.mjs', 'run.mjs', 'worker.mjs', 'dependencies.json')
SOURCE_ROOTS = ('apps', 'packages', 'supabase/migrations', 'tests/acceptance/support', 'tests/acceptance/scaffold-copy.mjs', 'package.json', 'package-lock.json')
BENCHMARK_INVENTORY = ('README.md', 'dependencies.json', 'generator.mjs', 'harness.mjs', 'run.mjs', 'summarize.mjs', 'tests/escalation.test.mjs', 'tests/generator.test.mjs', 'worker.mjs')
UUID = r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}'
COUNTERS = ('total', 'accepted', 'rejected', 'duplicates', 'pending')


def require(condition, code):
    # Do not use Python assert: python -O must not disable the exam.
    if not condition:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def number(value, code, minimum=0):
    require(type(value) in (int, float) and math.isfinite(value) and value >= minimum, code)
    return value


def counters(value):
    result = {}
    for key in COUNTERS:
        v = value[key]
        require(type(v) is int or isinstance(v, str) and v.isdecimal(), 'COUNTER_INTEGER')
        result[key] = int(v)
        require(result[key] >= 0, 'COUNTER_NONNEGATIVE')
    require(result['accepted'] + result['rejected'] + result['duplicates'] + result['pending'] == result['total'], 'COUNTER_CONSERVATION')
    return result


def stamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(parsed.tzinfo is not None, 'TIMEZONE_REQUIRED')
    return parsed.timestamp()


def close(actual, expected, code):
    require(abs(number(actual, code) - expected) < 1e-6, code)


def percentile(values, p):
    require(bool(values), 'SAMPLES_REQUIRED')
    return sorted(values)[math.ceil(len(values) * p) - 1]


def read_file(file):
    require(file.is_file() and not file.is_symlink(), 'REGULAR_FILE_REQUIRED:' + str(file))
    return file.read_bytes()


def relative_file(root, name):
    p = pathlib.PurePosixPath(name)
    require(not p.is_absolute() and '..' not in p.parts and bool(p.parts), 'RELATIVE_SOURCE_PATH')
    file = root.joinpath(*p.parts)
    require(file.resolve().is_relative_to(root.resolve()), 'SOURCE_PATH_ESCAPE')
    for parent in [file, *file.parents]:
        if parent == root:
            break
        require(not parent.is_symlink(), 'SOURCE_SYMLINK')
    return file


def verify_inventory(candidate, source):
    actual, benchmark = [], []

    def walk(name):
        file = relative_file(candidate, name)
        require(not file.is_symlink(), 'SOURCE_SYMLINK')
        if file.is_dir():
            for child in sorted(file.iterdir()):
                walk(name + '/' + child.name)
        else:
            require(file.is_file(), 'SOURCE_FILE_TYPE')
            if name.startswith('packages/jobs/load/'):
                benchmark.append(name[len('packages/jobs/load/'):])
            else:
                actual.append(name)

    for root in SOURCE_ROOTS:
        walk(root)
    require(sorted(actual) == sorted(f['path'] for f in source['files']), 'SOURCE_EXACT_INVENTORY')
    require(sorted(benchmark) == sorted(BENCHMARK_INVENTORY), 'BENCHMARK_EXACT_INVENTORY')
    for file in source['files']:
        require(digest(read_file(relative_file(candidate, file['path']))) == file['sha256'], 'SOURCE_HASH:' + file['path'])


def verify_cleanup(report, root):
    cleanup = report['cleanup']
    require(cleanup['ownResourcesRemoved'] is True and cleanup['temporaryPathsRemoved'] is True, 'CLEANUP_REQUIRED')
    require(json.loads(read_file(root / 'cleanup.json')) == cleanup, 'CLEANUP_RECEIPT_BINDING')
    resources = cleanup['resources']
    require(len(resources) == 5 and all(r['absent'] is True and re.fullmatch('[0-9a-f]{64}', r['id']) for r in resources), 'RESOURCE_ABSENCE_RECEIPTS')
    entries = [json.loads(line) for line in read_file(root / 'resources.jsonl').splitlines() if line]
    require(len(entries) == 5 and all(set(e) == {'kind', 'name', 'broker'} for e in entries), 'JOURNAL_RESOURCE_INVENTORY')
    brokers = {e['broker'] for e in entries}
    require(len(brokers) == 1 and re.fullmatch(UUID, next(iter(brokers))), 'JOURNAL_BROKER')
    require(all(e['kind'] in ('network', 'container') and re.fullmatch(r'vexa-f01-0[234]-' + UUID + r'(?:-[a-z]+)?', e['name']) for e in entries), 'JOURNAL_RESOURCE_IDENTITY')
    key = lambda r: (r['kind'], r['name'], r['broker'])
    require({key(e) for e in entries} == {key(r) for r in resources} and len({key(r) for r in resources}) == 5, 'CLEANUP_JOURNAL_COVERAGE')
    require(sum(r['kind'] == 'container' for r in resources) == 4 and sum(r['kind'] == 'network' for r in resources) == 1, 'CLEANUP_RESOURCE_KINDS')
    require(len({r['id'] for r in resources}) == 5, 'UNIQUE_CLEANUP_RESOURCES')
    return len(resources)


def verify_scale(report, root, rows):
    require(all(type(s['rows']) is int for s in report['scales']) and [s['rows'] for s in report['scales']] == [rows], 'EXACT_SINGLE_SCALE')
    s = report['scales'][0]
    require(s['status'] == 'pass' and not s.get('error'), 'SCALE_MUST_PASS')
    expected = dict(total=rows, accepted=rows * 98 // 100, rejected=rows // 100, duplicates=rows // 100, pending=0)
    require(counters(s['observed']) == expected, 'SCALE_ACCOUNTING')
    dataset_path = root / ('dataset-' + str(rows)) / 'manifest.json'
    dataset_bytes = read_file(dataset_path)
    dataset = json.loads(dataset_bytes)
    require(dataset == s['dataset'], 'DATASET_MANIFEST_BINDING')
    require(dataset['schema'] == 'vexa-synthetic-load-v1' and dataset['synthetic'] is True, 'SYNTHETIC_DATASET_REQUIRED')
    require(dataset['rows'] == rows and dataset['seed'] == s['seed'] == rows + 308, 'DATASET_SCALE_SEED')
    require(counters(dataset['expected']) == expected, 'DATASET_EXPECTED_ACCOUNTING')
    require(dataset['limits'] == dict(rowsPerFile=50000, bytesPerFile=20971520), 'DATASET_LIMITS')
    unsigned = {k: v for k, v in dataset.items() if k != 'sha256'}
    require(dataset['sha256'] == digest(json.dumps(unsigned, separators=(',', ':'), ensure_ascii=False).encode()), 'DATASET_MANIFEST_HASH')
    require(all(type(s[k]) is int for k in ('concurrency', 'workerChunkRows', 'jobDeadlineMs')) and s['concurrency'] == 1 and s['workerChunkRows'] == 100 and s['jobDeadlineMs'] == 900000, 'UNCHANGED_LOAD_LIMITS')
    require(len(s['files']) == math.ceil(rows / 50000), 'PARTITION_COUNT')
    require(len(dataset['files']) == len(s['files']), 'DATASET_FILE_INVENTORY')
    require(len({f['jobId'] for f in s['files']}) == len(s['files']), 'UNIQUE_JOBS')
    require(len({f['importId'] for f in s['files']}) == len(s['files']), 'UNIQUE_IMPORTS')
    require(len({f['filename'] for f in s['files']}) == len(s['files']), 'UNIQUE_DATASET_FILES')
    observed = dict.fromkeys(COUNTERS, 0)
    chunks = s['chunks']
    require(len(chunks) == rows // 100, 'CHUNK_COUNT')
    recount = 0
    for part, (file, declared) in enumerate(zip(s['files'], dataset['files']), 1):
        require(all(file[k] == value for k, value in declared.items()), 'FILE_MANIFEST_BINDING')
        require(set(declared) == {'filename', 'rows', 'bytes', 'sha256', 'firstIndex', 'lastIndex'}, 'FILE_DESCRIPTOR')
        part_rows = min(50000, rows - recount)
        require(type(file['rows']) is int and file['rows'] == part_rows and
                type(file['firstIndex']) is int and file['firstIndex'] == recount and
                type(file['lastIndex']) is int and file['lastIndex'] == recount + part_rows - 1 and
                file['filename'] == f'SYN-{rows}-{rows + 308}-part-{part}.csv', 'FILE_PARTITION')
        for key in ('jobId', 'importId'):
            require(isinstance(file[key], str) and re.fullmatch(UUID, file[key]), 'JOB_IMPORT_ID')
        name = file['filename']
        require(pathlib.Path(name).name == name and name.endswith('.csv'), 'DATASET_FILENAME')
        raw = read_file(relative_file(dataset_path.parent, name))
        require(digest(raw) == file['sha256'], 'DATASET_HASH')
        records = list(csv.reader(io.StringIO(raw.decode('utf8'))))
        require(records and records[0] == ['id', 'text', 'date', 'role', 'conversation'], 'DATASET_HEADER')
        count = len(records) - 1
        require(count == file['rows'] and 0 < count <= 50000, 'DATASET_ROW_COUNT')
        require(type(file['bytes']) is int and len(raw) == file['bytes'] and len(raw) <= 20971520, 'DATASET_BYTES')
        recount += count
        sql = counters(file['observed'])
        require(sql == dict(total=count, accepted=count * 98 // 100, rejected=count // 100, duplicates=count // 100, pending=0), 'FILE_TERMINAL_ACCOUNTING')
        require(file['observed']['fileHash'] == file['sha256'], 'SQL_FILE_HASH')
        require(counters(file['apiCounters']) == sql, 'API_SQL_COUNTERS')
        for key in COUNTERS:
            observed[key] += sql[key]
        timing = file['jobTiming']
        require(timing['state'] == 'partial', 'TERMINAL_JOB_REQUIRED')
        begin, end, deadline = (stamp(timing[k]) for k in ('firstStartedAt', 'lastFinishedAt', 'deadline'))
        require(stamp(s['startedAt']) <= begin <= end <= deadline, 'JOB_DEADLINE')
        elapsed = number(timing['elapsedMs'], 'JOB_ELAPSED_MS')
        require(0 < elapsed < 900000 and abs(elapsed - (end - begin) * 1000) < 1, 'JOB_TIMING')
        require(type(timing['failureCount']) is int and timing['failureCount'] == 0, 'JOB_FAILURE_COUNT')
        relevant = chunks[(recount - count) // 100:recount // 100]
        require(all(c['kind'] == 'chunk' and c['jobId'] == file['jobId'] and begin <= stamp(c['startedAt']) <= stamp(c['finishedAt']) <= deadline for c in relevant), 'JOB_CHUNK_COVERAGE')
        require(all(type(c['offset']) is int for c in relevant) and [c['offset'] for c in relevant] == list(range(100, count + 1, 100)), 'TERMINAL_OFFSETS')
        require(all(type(c['rows']) is int and c['rows'] == 100 and c['committed'] is True for c in relevant), 'CHUNKS_COMMITTED')
        require(all(c['done'] is (i == len(relevant) - 1) for i, c in enumerate(relevant)), 'CHUNK_TERMINAL_MARKER')
    require(recount == rows and observed == expected, 'RECOUNT_ACCOUNTING')
    process, = report['processes']
    require(type(process['pid']) is int and process['pid'] > 0, 'WORKER_PID')
    require(process['chunks'] == chunks, 'WORKER_CHUNK_OBSERVATIONS')
    start, finish = stamp(report['startedAt']), stamp(report['finishedAt'])
    worker_start, worker_end = stamp(process['startedAt']), stamp(process['endedAt'])
    require(start <= stamp(s['startedAt']) <= worker_start <= worker_end <= finish, 'PROCESS_TIMELINE')
    # The unchanged runner explicitly terminates each completed worker with SIGKILL.
    require((process['exitCode'] == 0 and process['signal'] is None) or
            (process['exitCode'] is None and process['signal'] == 'SIGKILL'), 'WORKER_TERMINATED')
    require(not process.get('stderr'), 'WORKER_STDERR')
    rss = number(process['maxRssKiB'], 'WORKER_RSS', 1)
    prior_end = -1
    for chunk in chunks:
        begin = number(chunk['monotonicStartMs'], 'CHUNK_CLOCK')
        end = number(chunk['monotonicEndMs'], 'CHUNK_CLOCK')
        require(prior_end <= begin <= end, 'CHUNK_MONOTONIC_ORDER')
        prior_end = end
        close(chunk['commitMs'], end - begin, 'CHUNK_DURATION')
        require(chunk['commitMs'] < 900000, 'CHUNK_DEADLINE')
        require(worker_start <= stamp(chunk['startedAt']) <= stamp(chunk['finishedAt']) <= worker_end, 'CHUNK_WALL_TIME')
        require(number(chunk['maxRssKiB'], 'CHUNK_RSS', 1) <= rss, 'WORKER_RSS_HIGH_WATER')
        number(chunk['memory']['rss'], 'CHUNK_MEMORY_RSS', 1)
        for key in ('user', 'system'):
            number(chunk['cpuMicroseconds'][key], 'CHUNK_CPU')
    processing = number(s['processingMs'], 'PROCESSING_DURATION', 1e-9)
    require(processing < 3600000, 'PROCESSING_DEADLINE')
    require(number(s['endToEndMs'], 'END_TO_END_DURATION') >= processing, 'END_TO_END_INCLUDES_PROCESSING')
    metrics = s['metrics']
    commits = [number(c['commitMs'], 'COMMIT_DURATION') for c in chunks]
    requests = s['apiRequests']
    require(len(requests) == 5 * len(s['files']), 'API_REQUEST_COUNT')
    require([r['label'] for r in requests] == ['reserve', 'storage_upload', 'mapping_preview', 'confirm'] * len(s['files']) + ['job_status'] * len(s['files']), 'API_OPERATION_INVENTORY')
    api_times = [number(r['ms'], 'API_DURATION') for r in requests]
    close(metrics['commitP50Ms'], percentile(commits, .5), 'COMMIT_P50')
    close(metrics['commitP95Ms'], percentile(commits, .95), 'COMMIT_P95')
    close(metrics['apiP95Ms'], percentile(api_times, .95), 'API_P95')
    close(metrics['inputRowsPerSecond'], rows / (processing / 1000), 'INPUT_THROUGHPUT')
    close(metrics['acceptedRowsPerSecond'], expected['accepted'] / (processing / 1000), 'ACCEPTED_THROUGHPUT')
    require(metrics['commitSamples'] == len(chunks) and metrics['apiSamples'] == len(requests), 'METRIC_DENOMINATORS')
    require(metrics['workerMaxRssKiB'] == rss, 'METRIC_RSS')
    require(json.loads(s['explain'])[0]['Plan'], 'EXPLAIN_REQUIRED')
    resource_count = verify_cleanup(report, root)
    return dict(rows=rows, recount=recount, chunks=len(chunks), files=len(s['files']),
                datasetManifestSha256=digest(dataset_bytes), metrics=metrics,
                processingMs=processing, endToEndMs=s['endToEndMs'], cleanupResources=resource_count)


def verify_series(paths, manifest, candidate):
    require(len(paths) == 3 and len(set(paths)) == 3, 'THREE_DISTINCT_REPORTS_REQUIRED')
    require(candidate.is_absolute() and manifest.is_absolute(), 'ABSOLUTE_INPUT_PATHS_REQUIRED')
    manifest_bytes = read_file(manifest)
    source = json.loads(manifest_bytes)
    require(source['schema'] == 'vexa-public-load-source-v1', 'SOURCE_MANIFEST_SCHEMA')
    require(read_file(candidate / 'packages/jobs/load/dependencies.json') == manifest_bytes, 'CANDIDATE_MANIFEST_BINDING')
    require(len({f['path'] for f in source['files']}) == len(source['files']) and source['files'], 'SOURCE_INVENTORY')
    verify_inventory(candidate, source)
    benchmark = {name: digest(read_file(candidate / 'packages/jobs/load' / name)) for name in BENCHMARK}
    originals = [read_file(p) for p in paths]
    reports = [json.loads(raw) for raw in originals]
    checks = []
    seen = {'jobId': set(), 'importId': set()}
    for index, (p, d, rows) in enumerate(zip(paths, reports, SCALES)):
        require(d['schema'] == 'vexa-load-result-v1' and d['status'] == 'measured' and not d.get('error'), 'REPORT_MUST_BE_MEASURED')
        require(d['candidate'] == str(candidate), 'MEASURED_CANDIDATE_REQUIRED')
        require(d['dependencyManifestSha256'] == digest(manifest_bytes) and d['baselineSha'] == source['baselineSha'], 'SOURCE_MANIFEST_BINDING')
        require(d['benchmarkImplementation'] == benchmark, 'BENCHMARK_SOURCE_BINDING')
        require(d['proposalDependencies'] is False and d['synthetic'] is True, 'LOCAL_SYNTHETIC_SCOPE')
        require(d['slo']['approved'] is False and d['cost']['total'] is None and d['cost']['measured'] is False, 'NO_COMMERCIAL_CLAIM')
        require(d['indexes'] and d['samples'] and d['hardware'] and d['versions'], 'MEASUREMENT_CONTEXT')
        require(str(d['versions']['node']).startswith('v22.'), 'NODE22_REQUIRED')
        if index == 0:
            require(d['priorEvidence'] is None, 'SERIES_STARTS_FRESH_AT_10K')
        else:
            prior = d['priorEvidence']
            require(prior['path'] == str(paths[index - 1]) and prior['sha256'] == digest(originals[index - 1]) and prior['validatedScale'] == SCALES[index - 1], 'PRIOR_REPORT_BINDING')
            require(stamp(reports[index - 1]['finishedAt']) <= stamp(d['startedAt']), 'SEQUENTIAL_ESCALATION')
        for file in d['scales'][0]['files']:
            for key in seen:
                require(file[key] not in seen[key], 'SERIES_UNIQUE_JOB_IMPORT')
                seen[key].add(file[key])
        checks.append(dict(report=str(p), sha256=digest(originals[index]), **verify_scale(d, p.parent, rows)))
    require(all(read_file(p) == raw for p, raw in zip(paths, originals)), 'REPORT_CHANGED_DURING_REVIEW')
    return dict(schema='rovaq-load-series-review-v1', status='PASS', candidate=str(candidate),
                dependencyManifestSha256=digest(manifest_bytes), benchmarkImplementation=benchmark,
                scales=checks, accepted=False, production=False,
                limits=['Local synthetic ingestion only; no inference or commercial SLO measured.',
                        'Cleanup is checked against original receipts; no new Docker inspection is performed.',
                        'Original failed attempts remain failed; this receipt verifies only the three explicitly supplied reports.'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reports', nargs=3, type=pathlib.Path)
    parser.add_argument('--candidate', required=True, type=pathlib.Path)
    parser.add_argument('--manifest', required=True, type=pathlib.Path)
    parser.add_argument('--out', type=pathlib.Path, help='New receipt only; existing files are never overwritten')
    args = parser.parse_args()
    try:
        receipt = verify_series(args.reports, args.manifest, args.candidate)
        code = 0
    except (ValueError, KeyError, TypeError, OSError, IndexError) as error:
        receipt = dict(schema='rovaq-load-series-review-v1', status='FAIL', error=str(error), accepted=False, production=False)
        code = 1
    text = json.dumps(receipt, indent=2, allow_nan=False) + '\n'
    if args.out:
        with args.out.open('x') as output:
            output.write(text)
        args.out.chmod(0o600)
    else:
        sys.stdout.write(text)
    return code


if __name__ == '__main__':
    sys.exit(main())
