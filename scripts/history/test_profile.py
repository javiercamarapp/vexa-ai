import csv,json,tempfile,unittest
from pathlib import Path
import test_prepare_history as fixtures
row=fixtures.row
from prepare_history import prepare,classify,digest
from validate_provenance import validate
class ProfileTests(unittest.TestCase):
    setUp=fixtures.PackageTests.setUp
    fixture=fixtures.PackageTests.fixture
    def test_profile_materially_unlocks_long_and_micro_preserving_original(self):
        original=row(body_text='SYNTHETIC '+'x'*3000,message_created_at='2026-09-01T00:00:00.123456Z')
        manifest,sources=self.fixture([original]);before=prepare(manifest,self.root/'before');after=prepare(manifest,self.root/'after',profile='history-message-v1')
        self.assertEqual(before['summary']['candidate'],0);self.assertEqual(after['summary']['candidate'],1);self.assertEqual((self.root/'after/originals/01.csv').read_bytes(),Path(sources[0]['source']).read_bytes());self.assertEqual(validate(self.root/'after',after)['summary'],after['summary'])
    def test_over_python_default_field_limit_retained_not_truncated(self):
        original=row(body_text='SYNTHETIC '+'x'*150000);manifest,_=self.fixture([original]);previous=csv.field_size_limit();out=self.root/'out';result=prepare(manifest,out,profile='history-message-v1')
        self.assertEqual(csv.field_size_limit(),previous);self.assertEqual(result['summary']['reasons']['BODY_ANALYSIS_LIMIT'],1);self.assertEqual(result['summary']['review'],1);self.assertEqual(validate(out,result)['summary'],result['summary']);self.assertEqual(csv.field_size_limit(),previous)
    def test_profile_range_utf16_nfc_and_controls(self):
        for text in ['😀'*50001,'\u0344'*50001]:self.assertIn('BODY_ANALYSIS_LIMIT',classify(row(body_text=text),profile='history-message-v1')[0])
        for date in ['1000-01-01T00:00:00.123456+01:00','9999-12-31T23:59:59.123456-01:00','2026-01-01T00:00:00+00:99']:self.assertIn('TIMESTAMP_INVALID',classify(row(message_created_at=date),profile='history-message-v1')[0])
        self.assertIn('BODY_CONTROL_REQUIRES_REVIEW',classify(row(body_text='SYN\rline'),profile='history-message-v1')[0])
if __name__=='__main__':unittest.main()
