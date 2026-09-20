"""Closed JSON (YAML 1.2 subset) workflow contract, owned by control checkout."""
import json
JOBS = ('control-kernel', 'web-quality', 'sql-integration', 'auth-e2e')
GATES = ('E00', 'F00-01', 'F00-02', 'F00-03', 'F00-04', 'F00-05', 'F01-01', 'F01-02', 'F01-03', 'F01-04')
CHECKOUT = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
NODE = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020'
PYTHON = 'actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97'
def workflow():
    jobs = {}
    for job in JOBS:
        jobs[job] = {
            'runs-on': 'ubuntu-24.04-arm', 'timeout-minutes': 15,
            'if': "${{ github.ref == 'refs/heads/main' }}",
            'permissions': {'contents': 'read'},
            'steps': [
                {'uses': CHECKOUT, 'with': {'ref': '${{ github.sha }}', 'path': p, 'persist-credentials': False}}
                for p in ('control', 'candidate')
            ] + [
                {'uses': NODE, 'with': {'node-version': '26.7.0'}},
                {'uses': PYTHON, 'with': {'python-version': '3.12'}},
                {'name': 'Trusted disposable bootstrap', 'shell': 'bash --noprofile --norc -euo pipefail {0}',
                 'run': 'python3 control/tests/acceptance/support/ci/bootstrap.py --candidate "$GITHUB_WORKSPACE/candidate" --authorized-disposable-runner'},
                {'name': 'Required job', 'shell': 'bash --noprofile --norc -euo pipefail {0}',
                 'run': 'python3 control/tests/acceptance/support/ci/run.py --job '+job+' --candidate "$GITHUB_WORKSPACE/candidate" --event-sha "$GITHUB_SHA"'}
            ]}
    return {'name': 'F01-05 reviewed main only', 'on': {'push': {'branches': ['main']}, 'workflow_dispatch': {}},
            'permissions': {'contents': 'read'}, 'jobs': jobs}
def unique(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj: raise ValueError('CI_DUPLICATE_KEY: '+key)
        obj[key] = value
    return obj
def validate(file):
    try:
        with open(file) as f: actual = json.load(f, object_pairs_hook=unique)
    except FileNotFoundError as e: raise ValueError('CI_CONTRACT_MISSING') from e
    # Equality against a constructed, trusted schema rejects unknown keys at every depth,
    # arbitrary commands, conditions, services, env, credentials, skip and error swallowing.
    if json.dumps(actual, sort_keys=True) != json.dumps(workflow(), sort_keys=True): raise ValueError('CI_CONTRACT_MISMATCH')
    return actual
