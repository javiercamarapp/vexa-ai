"""Independent inventory: a marker or an empty test file is not a domain exam."""
import collections
import re

CASES = (
    'five entities and exact bigint known relationships',
    'replay and reorder keep IDs and ledger',
    'same revision conflicting hash preserves original and quarantines',
    'two independent Node processes deduplicate concurrent revision',
    'CSV known customer/order/SKU relationships survive persistence',
    'new revision retains one logical order and does not double money',
    'customer permits occurred_at null',
    'product permits occurred_at null',
    'conversation permits occurred_at null',
    'message permits occurred_at null',
    'tenant, source, account, content hash and mapping cannot be forged',
    'ambiguous reference quarantines, never selects arbitrary customer',
    'same import exact replay does not increment counters and changed row quarantines',
    'unknown amount remains SQL null rather than zero',
    'SQL failure propagates and entire transaction rolls back',
    'all five entity histories keep snapshots and one projection',
    'connection and account identity independent across imports',
    'normalization rejection exact metadata replay counters and SQL errors',
    'membership revocation denies persistence and history',
    'mapping and file hashes remain bound across imports',
    'SQL faults inside history and normalization never mean missing data',
    'owner selection fence rejects analyst SQL bypass',
)
PARENT = 'F02-04 independent real persistence effects'

def complete(output):
    expected = collections.Counter((*CASES, PARENT))
    observed = collections.Counter(re.findall(r'^\s*ok \d+ - ([^\r\n]+)$', output, re.MULTILINE))
    if observed != expected or 'F02_04_COMPLETO' not in output:
        return False
    count = len(CASES) + 1
    for field, value in [('tests', count), ('pass', count), ('fail', 0), ('cancelled', 0), ('skipped', 0), ('todo', 0)]:
        if re.findall(r'^# ' + field + r' (\d+)\s*$', output, re.MULTILINE) != [str(value)]:
            return False
    return not re.search(r'^\s*not ok ', output, re.MULTILINE)
