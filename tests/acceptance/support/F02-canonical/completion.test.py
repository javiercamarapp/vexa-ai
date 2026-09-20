import unittest
from completion import CASES, PARENT, complete

# Synthetic TAP tests only the completion checker, never business behavior.
def fixture():
    return '\n'.join(['TAP version 13', *('    ok %d - %s' % (i, name) for i, name in enumerate(CASES, 1)),
        'ok 1 - ' + PARENT, '# F02_04_COMPLETO', '# tests 23', '# pass 23', '# fail 0', '# cancelled 0', '# skipped 0', '# todo 0'])

class CompletionTests(unittest.TestCase):
    def test_full_inventory(self):
        self.assertEqual(len(CASES), 22)
        self.assertTrue(complete(fixture()))

    def test_original_marker_only_false_green(self):
        self.assertFalse(complete('ok 1 - exam.mjs\n# F02_04_COMPLETO\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0'))

    def test_each_missing_renamed_or_duplicate_case(self):
        for i, name in enumerate(CASES, 1):
            line='    ok %d - %s' % (i, name)
            for changed in ['', line.replace(name, 'unrelated'), line+'\n'+line]:
                with self.subTest(case=name, replacement=changed):
                    self.assertFalse(complete(fixture().replace(line, changed)))

    def test_diagnostics_are_not_tests(self):
        self.assertFalse(complete('\n'.join('# '+line if line.lstrip().startswith('ok ') else line for line in fixture().splitlines())))

    def test_failure_skip_todo_marker_and_summary(self):
        for old, new in [('# fail 0', '# fail 1'), ('# skipped 0', '# skipped 1'), ('# todo 0', '# todo 1'),
                         ('# cancelled 0', '# cancelled 1'), ('# tests 23', '# tests 1'), ('# pass 23', '# pass 1'),
                         ('# F02_04_COMPLETO', ''), ('ok 1 - '+PARENT, 'not ok 1 - '+PARENT)]:
            with self.subTest(field=old):self.assertFalse(complete(fixture().replace(old,new)))
        self.assertFalse(complete(fixture()+'\n# tests 23'))

if __name__ == '__main__':unittest.main()
