"""Synthetic credentials only: live gate isolation in disposable Git repositories."""
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import test_runner as fixtures

r = fixtures.r
KEYS = {
    'VEXA_HUBSPOT_S01_CONFIG': '/SYNTHETIC/config.json',
    'VEXA_HUBSPOT_TOKEN': 'SYNTHETIC_NOT_A_SECRET',
    'VEXA_HUBSPOT_RECONCILIATION_KEY': 'SYNTHETIC_HMAC_NOT_A_SECRET',
}
NOTE = 'Synthetic account-holder authorization reference'

class LiveEnvironmentTests(unittest.TestCase):
    def test_worker_and_other_tasks_do_not_inherit_provider_credentials(self):
        with patch.dict(os.environ, {**KEYS, 'VEXA_HUBSPOT_APPROVAL_REFERENCE': 'untrusted', 'OPENAI_API_KEY': 'synthetic'}):
            for env in [r.clean_environment(), r.acceptance_environment({'id': 'F03-02', 'requires_approval': True}, {'approval_note': NOTE}), r.acceptance_environment({'id': 'F03-01'}, {'approval_note': NOTE}), r.acceptance_environment({'id': 'F03-01', 'requires_approval': True}, {})]:
                self.assertFalse(set(KEYS) & env.keys())
                self.assertNotIn('VEXA_HUBSPOT_APPROVAL_REFERENCE', env)
                self.assertNotIn('OPENAI_API_KEY', env)

    def test_exact_gate_allowlist_and_saved_approval_override_untrusted_environment(self):
        with patch.dict(os.environ, {**KEYS, 'VEXA_HUBSPOT_APPROVAL_REFERENCE': 'untrusted', 'SUPABASE_SERVICE_ROLE_KEY': 'synthetic'}):
            env = r.acceptance_environment({'id': 'F03-01', 'requires_approval': True}, {'approval_note': NOTE})
            for key, value in KEYS.items(): self.assertEqual(env[key], value)
            self.assertEqual(env['VEXA_HUBSPOT_APPROVAL_REFERENCE'], NOTE)
            self.assertNotIn('SUPABASE_SERVICE_ROLE_KEY', env)

    def test_real_hubspot_task_requires_explicit_operator_decision(self):
        graph = r.load_graph(fixtures.ROOT / 'orchestration/graph.json')
        self.assertIs(next(t for t in graph['tasks'] if t['id'] == 'F03-01')['requires_approval'], True)

class LiveEnvironmentIntegrationTests(unittest.TestCase):
    setUp = fixtures.ControllerIntegrationTests.setUp
    worker = fixtures.ControllerIntegrationTests.worker
    invoke = fixtures.ControllerIntegrationTests.invoke

    def setup_live(self):
        graph_path = self.root / 'orchestration/graph.json'
        graph = json.loads(graph_path.read_text())
        graph['tasks'][0].update(id='F03-01', requires_approval=True)
        graph_path.write_text(json.dumps(graph))
        assertions = ''.join(f'assert.equal(process.env[{json.dumps(k)}],{json.dumps(v)});' for k,v in {**KEYS,'VEXA_HUBSPOT_APPROVAL_REFERENCE':NOTE}.items())
        assertions += 'assert.equal(process.env.OPENAI_API_KEY,undefined);'
        (self.root / 'tests/gate.mjs').write_text(self.gate + assertions)
        r.git(self.root, 'add', '.');r.git(self.root, 'commit', '-qm', 'synthetic live control')
        self.baseline = r.git(self.root, 'rev-parse', 'HEAD')
        self.env.update(KEYS);self.env['OPENAI_API_KEY'] = 'synthetic-excluded'

    def test_verify_and_clean_accept_receive_authorized_gate_environment_only(self):
        self.setup_live()
        self.invoke('prepare','--task','F03-01')
        state_path = self.root / '.runtime/state.json'
        candidate = Path(json.loads(state_path.read_text())['F03-01']['worktree'])
        (candidate / 'packages/demo/value.txt').write_text('good')
        with patch.object(r, 'run_bounded', wraps=r.run_bounded) as calls:
            with self.assertRaisesRegex(SystemExit,'explicit operator decision'):
                self.invoke('verify','--task','F03-01')
            calls.assert_not_called()
        self.invoke('verify','--task','F03-01','--approval-note',NOTE)
        self.invoke('accept','--task','F03-01')
        self.assertEqual(json.loads(state_path.read_text())['F03-01']['status'],'accepted')
        for file in (self.root / '.runtime').glob('*.log'):
            self.assertNotIn(KEYS['VEXA_HUBSPOT_TOKEN'],file.read_text())
        self.assertNotIn(KEYS['VEXA_HUBSPOT_TOKEN'],state_path.read_text())

    def test_automatic_loop_cannot_run_live_even_with_credentials_present(self):
        self.setup_live()
        with patch.object(r,'run_bounded',wraps=r.run_bounded) as calls:
            self.invoke('run','--max-rounds','1','--max-minutes','1')
        calls.assert_not_called()
        self.assertEqual(r.git(self.root,'rev-parse','HEAD'),self.baseline)
