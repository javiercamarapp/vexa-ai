"""Interactive controller regressions, using disposable real Git repositories."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import test_runner as fixtures

r = fixtures.r


class InteractiveTests(unittest.TestCase):
    setUp = fixtures.ControllerIntegrationTests.setUp
    worker = fixtures.ControllerIntegrationTests.worker
    invoke = fixtures.ControllerIntegrationTests.invoke
    state = fixtures.ControllerIntegrationTests.state

    def test_prepare_edit_verify_accept_without_codex(self):
        (self.bin / 'codex').unlink()
        self.invoke('prepare', '--task', 'A')
        row = self.state()
        self.assertEqual(row['status'], 'prepared')
        self.assertEqual(row['attempts'], 1)
        candidate = Path(row['worktree'])
        self.assertEqual(r.git(candidate, 'rev-parse', 'HEAD'), self.baseline)
        (candidate / 'packages/demo/value.txt').write_text('good')
        self.invoke('verify', '--task', 'A', '--max-minutes', '1')
        self.assertEqual(self.state()['status'], 'verified')
        self.assertEqual(r.git(self.root, 'rev-parse', 'HEAD'), self.baseline)
        self.invoke('accept', '--task', 'A')
        self.assertEqual(self.state()['status'], 'accepted')
        self.assertEqual((self.root / 'packages/demo/value.txt').read_text(), 'good')
        self.assertEqual(r.interactive_signature(self.root), self.state()['verified_signature'])

    def configure(self, **changes):
        path = self.root / 'orchestration/graph.json'
        graph = json.loads(path.read_text())
        graph['tasks'][0].update(changes)
        path.write_text(json.dumps(graph))
        self.commit_controller()

    def commit_controller(self):
        r.git(self.root, 'add', '.')
        r.git(self.root, 'commit', '-qm', 'fixture update')
        self.baseline = r.git(self.root, 'rev-parse', 'HEAD')

    def prepare_good(self):
        self.invoke('prepare', '--task', 'A')
        candidate = Path(self.state()['worktree'])
        (candidate / 'packages/demo/value.txt').write_text('good')
        return candidate

    def assert_baseline(self):
        self.assertEqual(r.git(self.root, 'rev-parse', 'HEAD'), self.baseline)

    def test_prepare_missing_gate(self):
        (self.root / 'tests/gate.mjs').unlink()
        self.commit_controller()
        with self.assertRaisesRegex(FileNotFoundError, 'not authored'):
            self.invoke('prepare', '--task', 'A')
        self.assertFalse((self.root / '.runtime/state.json').exists())
        self.assert_baseline()

    def test_prepare_requires_accepted_dependencies(self):
        path = self.root / 'orchestration/graph.json'
        graph = json.loads(path.read_text())
        task = dict(graph['tasks'][0], id='B', depends_on=['A'])
        graph['tasks'].append(task)
        path.write_text(json.dumps(graph)); self.commit_controller()
        with self.assertRaisesRegex(SystemExit, 'Dependencies'):
            self.invoke('prepare', '--task', 'B')
        self.assert_baseline()

    def test_prepare_requires_clean_controller(self):
        (self.root / 'packages/demo/value.txt').write_text('dirty')
        with self.assertRaisesRegex(SystemExit, 'clean'):
            self.invoke('prepare', '--task', 'A')
        self.assert_baseline()

    def test_prepare_twice_preserves_candidate_and_attempt(self):
        candidate = self.prepare_good(); before = self.state()
        with self.assertRaisesRegex(SystemExit, 'not overwritten'):
            self.invoke('prepare', '--task', 'A')
        self.assertEqual(self.state(), before)
        self.assertEqual((candidate / 'packages/demo/value.txt').read_text(), 'good')
        self.assert_baseline()

    def test_prepare_respects_lock(self):
        import fcntl
        runtime = self.root / '.runtime'; runtime.mkdir()
        with (runtime / 'lock').open('a+') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(SystemExit, 'Another controller'):
                self.invoke('prepare', '--task', 'A')
        self.assertFalse((runtime / 'state.json').exists())

    def test_approval_attestation_required_and_saved(self):
        self.configure(requires_approval=True)
        self.prepare_good()
        for note in [None, '   ']:
            args = ['verify', '--task', 'A'] + (['--approval-note', note] if note else [])
            with self.assertRaisesRegex(SystemExit, 'explicit operator decision'):
                self.invoke(*args)
            self.assertEqual(self.state()['status'], 'prepared')
        note = 'Operator decision: local fixture scope approved in session 42'
        self.invoke('verify', '--task', 'A', '--approval-note', note)
        self.assertEqual(self.state()['approval_note'], note)
        self.assertEqual(self.state()['status'], 'verified'); self.assert_baseline()

    def test_verify_only_prepared(self):
        with self.assertRaisesRegex(SystemExit, 'not prepared'):
            self.invoke('verify', '--task', 'A')
        self.prepare_good(); self.invoke('verify', '--task', 'A')
        with self.assertRaisesRegex(SystemExit, 'not prepared'):
            self.invoke('verify', '--task', 'A')

    def test_control_gate_graph_and_prompt_changes_block(self):
        for path in ['tests/gate.mjs', 'orchestration/prompt.md', 'orchestration/graph.json']:
            with self.subTest(path=path):
                # Each subcase uses its own independent repository and worktree.
                case = InteractiveTests(); case.setUp()
                try:
                    case.prepare_good()
                    f = case.root / path
                    if path.endswith('graph.json'):
                        graph = json.loads(f.read_text()); graph['tasks'][0]['objective'] = 'different task'
                        f.write_text(json.dumps(graph))
                    else: f.write_text(f.read_text() + '\n')
                    case.commit_controller()
                    with case.assertRaisesRegex(SystemExit, 'changed since prepare'):
                        case.invoke('verify', '--task', 'A')
                    case.assertEqual(case.state()['status'], 'blocked')
                    case.assert_baseline()
                finally:
                    case.doCleanups()

    def test_dependency_receipt_changes_block(self):
        path = self.root / 'orchestration/graph.json'
        graph = json.loads(path.read_text())
        graph['tasks'].append(dict(graph['tasks'][0], id='D'))
        graph['tasks'][0]['depends_on'] = ['D']
        path.write_text(json.dumps(graph)); self.commit_controller()
        sp = self.root / '.runtime/state.json'
        r.atomic_json(sp, {'D': {'status': 'accepted', 'commit': 'receipt-1'}})
        self.prepare_good()
        state = json.loads(sp.read_text()); state['D']['commit'] = 'receipt-2'
        r.atomic_json(sp, state)
        with self.assertRaisesRegex(SystemExit, 'changed since prepare'):
            self.invoke('verify', '--task', 'A')
        self.assert_baseline()

    def test_forbidden_diff_and_symlink_block(self):
        for kind in ['forbidden', 'symlink', 'mode']:
            with self.subTest(kind=kind):
                case = InteractiveTests(); case.setUp()
                try:
                    candidate = case.prepare_good()
                    if kind == 'forbidden': (candidate / 'tests/gate.mjs').write_text('')
                    elif kind == 'mode': (candidate / 'tests/gate.mjs').chmod(0o755)
                    else:
                        f = candidate / 'packages/demo/value.txt'; f.unlink()
                        f.symlink_to(case.root / 'packages/demo/value.txt')
                    with case.assertRaisesRegex(SystemExit, 'guard'):
                        case.invoke('verify', '--task', 'A')
                    case.assertEqual(case.state()['status'], 'blocked'); case.assert_baseline()
                finally:
                    case.doCleanups()

    def test_operator_commit_blocks(self):
        candidate = self.prepare_good()
        r.git(candidate, 'add', '.'); r.git(candidate, 'commit', '-qm', 'operator')
        with self.assertRaisesRegex(SystemExit, 'Candidate HEAD changed'):
            self.invoke('verify', '--task', 'A')
        self.assertEqual(self.state()['status'], 'blocked'); self.assert_baseline()

    def test_gate_failure_preserves_attempts_and_ceiling(self):
        for attempt in [1, 2]:
            self.invoke('prepare', '--task', 'A')
            candidate = Path(self.state()['worktree'])
            with self.assertRaisesRegex(SystemExit, 'Acceptance failed'):
                self.invoke('verify', '--task', 'A')
            self.assertEqual(self.state()['status'], 'failed')
            self.assertEqual(self.state()['attempts'], attempt)
            self.assertTrue(candidate.exists()); self.assert_baseline()
            self.assertTrue((self.root / '.runtime' / self.state()['logs'][-1]['file']).is_file())
        self.assertEqual(len(self.state()['history']), 1)
        with self.assertRaisesRegex(SystemExit, 'Attempt ceiling'):
            self.invoke('prepare', '--task', 'A')

    def test_no_patch_verified_without_commit(self):
        (self.root / 'packages/demo/value.txt').write_text('good'); self.commit_controller()
        self.invoke('prepare', '--task', 'A'); self.invoke('verify', '--task', 'A')
        self.assertEqual(self.state()['commit'], self.baseline)
        self.assertEqual(self.state()['status'], 'verified')
        self.invoke('accept', '--task', 'A'); self.assert_baseline()

    def test_gate_timeout_budget_and_environment(self):
        self.prepare_good()
        with patch.object(r, 'run_bounded', return_value=124) as run:
            with self.assertRaisesRegex(SystemExit, 'Acceptance failed'):
                self.invoke('verify', '--task', 'A', '--max-minutes', '1')
        call = run.call_args
        self.assertGreater(call.args[3], 0); self.assertLessEqual(call.args[3], 60)
        self.assertEqual(call.args[4]['VEXA_CANDIDATE'], self.state()['worktree'])
        self.assertNotIn('OPENAI_API_KEY', call.args[4]); self.assert_baseline()

    def test_gate_mutation_and_commit_hook_mutation_block(self):
        for kind in ['candidate', 'controller', 'hook']:
            with self.subTest(kind=kind):
                case = InteractiveTests(); case.setUp()
                try:
                    if kind != 'hook':
                        target = ("f" if kind == 'candidate' else
                                  "path.join(process.cwd(),'orchestration/prompt.md')")
                        (case.root / 'tests/gate.mjs').write_text(case.gate + f"fs.writeFileSync({target},'mutation');")
                        case.commit_controller()
                    candidate = case.prepare_good()
                    if kind == 'hook':
                        hook = case.root / '.git/hooks/pre-commit'
                        hook.write_text("#!/bin/sh\nprintf mutated > packages/demo/value.txt\ngit add packages/demo/value.txt\n")
                        hook.chmod(0o755)
                    with case.assertRaisesRegex(SystemExit, 'changed|mutated'):
                        case.invoke('verify', '--task', 'A')
                    case.assertEqual(case.state()['status'], 'blocked'); case.assert_baseline()
                finally:
                    case.doCleanups()

    def test_accept_rejects_ignored_file_added_after_verify(self):
        (self.root / '.gitignore').write_text('.runtime/\n*.scratch\n'); self.commit_controller()
        candidate = self.prepare_good(); self.invoke('verify', '--task', 'A')
        (candidate / 'packages/demo/late.scratch').write_text('mutation')
        with self.assertRaisesRegex(SystemExit, 'changed after verification'):
            self.invoke('accept', '--task', 'A')
        self.assert_baseline()

    def test_accept_recheck_mutation_blocks(self):
        gate = self.root / 'tests/gate.mjs'
        gate.write_text(self.gate + "const marker=path.join(process.cwd(),'.runtime/recheck'); if(fs.existsSync(marker)) fs.writeFileSync(f,'mutation');")
        self.commit_controller()
        self.prepare_good(); self.invoke('verify', '--task', 'A')
        (self.root / '.runtime/recheck').write_text('yes')
        with self.assertRaisesRegex(SystemExit, 'Files changed'):
            self.invoke('accept', '--task', 'A')
        self.assertEqual(self.state()['status'], 'verified'); self.assert_baseline()

    def test_scheduler_skips_live_candidates(self):
        graph = json.loads((self.root / 'orchestration/graph.json').read_text())
        for status in ['prepared', 'running']:
            self.assertIsNone(r.next_task(graph, {'A': {'status': status, 'attempts': 1}}))

    def test_private_and_environment_not_copied(self):
        (self.root / '.gitignore').write_text('.runtime/\nprivate/\n.env\n'); self.commit_controller()
        (self.root / 'private').mkdir(); (self.root / 'private/fixture.txt').write_text('private fixture')
        (self.root / '.env').write_text('FAKE_FIXTURE=local')
        candidate = self.prepare_good()
        self.assertFalse((candidate / 'private').exists()); self.assertFalse((candidate / '.env').exists())

    def test_ignored_input_cannot_pass_without_being_committed(self):
        (self.root / '.gitignore').write_text('.runtime/\n*.scratch\n'); self.commit_controller()
        candidate = self.prepare_good()
        (candidate / 'packages/demo/input.scratch').write_text('unversioned gate dependency')
        with self.assertRaisesRegex(SystemExit, 'guard'):
            self.invoke('verify', '--task', 'A')
        self.assert_baseline()

    def test_accept_does_not_execute_post_merge_hook(self):
        self.prepare_good(); self.invoke('verify', '--task', 'A')
        hook = self.root / '.git/hooks/post-merge'
        hook.write_text('#!/bin/sh\nprintf mutation > packages/demo/value.txt\n')
        hook.chmod(0o755)
        self.invoke('accept', '--task', 'A')
        self.assertEqual((self.root / 'packages/demo/value.txt').read_text(), 'good')
        self.assertEqual(r.interactive_signature(self.root), self.state()['verified_signature'])

    def test_verify_budget_expired_does_not_commit(self):
        candidate = self.prepare_good()
        with patch.object(r.time, 'monotonic', side_effect=[0, 61]):
            with self.assertRaisesRegex(SystemExit, 'Time budget'):
                self.invoke('verify', '--task', 'A', '--max-minutes', '1')
        self.assertEqual(r.git(candidate, 'rev-parse', 'HEAD'), self.baseline)
        self.assertEqual(self.state()['status'], 'blocked'); self.assert_baseline()

    def test_prepare_budget_expired_does_not_create_candidate(self):
        with patch.object(r.time, 'monotonic', side_effect=[0, 61]):
            with self.assertRaisesRegex(SystemExit, 'Time budget'):
                self.invoke('prepare', '--task', 'A', '--max-minutes', '1')
        self.assertFalse((self.root / '.runtime/state.json').exists()); self.assert_baseline()

    def test_run_cannot_use_approval_note_as_automatic_permission(self):
        self.configure(requires_approval=True)
        self.invoke('run', '--auto-accept', '--approval-note', 'operator fixture decision')
        self.assertFalse((self.root / '.runtime/state.json').exists()); self.assert_baseline()

    def test_accept_rechecks_frozen_control_even_with_clean_tree(self):
        self.prepare_good(); self.invoke('verify', '--task', 'A')
        (self.root / 'tests/gate.mjs').write_text('')
        self.commit_controller()
        with self.assertRaisesRegex(SystemExit, 'changed since prepare'):
            self.invoke('accept', '--task', 'A')
        self.assert_baseline()


if __name__ == '__main__':
    unittest.main()
