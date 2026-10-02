import csv,json,tempfile,unittest
from pathlib import Path
from prepare_history import prepare,digest,classify,rows,HEAD

def row(**updates):
    r=dict(source='hubspot',gorgias_ticket_id='',hubspot_ticket_id='SYN-T1',message_id='SYN-M1',message_created_at='2026-09-01T00:00:00.123Z',body_text='SYNTHETIC café\nsecond line',direction='customer',author_role='customer',is_automation='false',sku='',order_id='')
    r.update(updates);return r

class PackageTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
    def fixture(self,items,second=None):
        sources=[]
        for n,data in enumerate([items]+([second] if second else [])):
            p=self.root/f'syn-{n}.csv'
            with p.open('w',encoding='utf-8-sig',newline='') as f:
                w=csv.DictWriter(f,fieldnames=list(row()));w.writeheader();w.writerows(data)
            sources.append(dict(category='conversations',source=str(p),sha256=digest(p),bytes=p.stat().st_size,rows=len(data)))
        manifest=self.root/'input.json';manifest.write_text(json.dumps({'sources':sources}));return manifest,sources
    def test_compatible_lossless_and_no_finance(self):
        original=row(body_text='SYNTHETIC e\u0301,"quoted"\nline');m,s=self.fixture([original]);out=self.root/'out';result=prepare(m,out)
        self.assertEqual(result['summary']['candidate'],1);self.assertEqual((out/'originals/01.csv').read_bytes(),Path(s[0]['source']).read_bytes())
        with (out/result['batches'][0]['path']).open(newline='') as f:projected=list(csv.DictReader(f))[0]
        self.assertEqual(projected['external_id'],'SYN-M1');self.assertEqual(projected['text'],original['body_text']);self.assertNotIn('amount',projected);self.assertNotIn('currency',projected)
    def test_precision_not_silently_truncated(self):
        for fraction in ['123001','123000']:
            reasons,_,_=classify(row(message_created_at=f'2026-09-01T00:00:00.{fraction}Z'));self.assertIn('TIMESTAMP_PRECISION_CONTRACT',reasons)
    def test_empty_long_and_missing_identity_retained(self):
        m,_=self.fixture([row(message_id='',body_text=''),row(message_id='SYN-M2',body_text='x'*2001)]);out=self.root/'out';r=prepare(m,out)
        self.assertEqual(r['summary']['review'],2);self.assertEqual(r['summary']['candidate'],0);self.assertEqual(list(rows(out/'originals/01.csv'))[1][1]['body_text'],'x'*2001)
    def test_multiticket_and_exact_duplicates_all_review(self):
        m,_=self.fixture([row(),row()],second=[row(hubspot_ticket_id='SYN-T2')]);r=prepare(m,self.root/'out');self.assertEqual(r['summary']['reasons']['REPEATED_SOURCE_MESSAGE_ID'],3);self.assertEqual(r['summary']['candidate'],0)
    def test_direction_and_automation_not_human_public(self):
        self.assertEqual(classify(row(direction='internal_note',author_role='agent'))[1],'internal')
        self.assertIn('AUTOMATION_REQUIRES_METADATA_CONTRACT',classify(row(is_automation='true'))[0]);self.assertIn('DIRECTION_AUTHOR_REQUIRES_REVIEW',classify(row(direction='note'))[0])
    def test_hash_tamper_rejected_without_manifest(self):
        m,s=self.fixture([row()]);Path(s[0]['source']).write_text('altered');out=self.root/'out'
        with self.assertRaisesRegex(ValueError,'SOURCE_HASH_MISMATCH'):prepare(m,out)
        self.assertFalse((out/'manifest.json').exists())
    def test_batch_rows_and_multiline_refs(self):
        m,_=self.fixture([row(message_id=f'SYN-M{i}') for i in range(3)]);out=self.root/'out';r=prepare(m,out,max_rows=2)
        self.assertEqual([b['rows'] for b in r['batches']],[2,1]);refs=[json.loads(x) for x in (out/'rows.jsonl').read_text().splitlines()];self.assertEqual(refs[1]['candidate']['physical_line'],4);self.assertEqual(refs[1]['record_number'],3)
    def test_provider_collision_separate_batches(self):
        m,_=self.fixture([row(),row(source='gorgias',gorgias_ticket_id='SYN-T1')]);r=prepare(m,self.root/'out');self.assertEqual(r['summary']['candidate'],2);self.assertEqual(len(r['batches']),2)
    def test_reuse_output_rejected(self):
        m,_=self.fixture([row()]);out=self.root/'out';prepare(m,out)
        with self.assertRaises(FileExistsError):prepare(m,out)
    def test_invalid_dates_and_unknown_source(self):
        self.assertIn('TIMESTAMP_INVALID',classify(row(message_created_at='2026-02-30T00:00:00Z'))[0]);self.assertIn('SOURCE_UNKNOWN',classify(row(source='unknown'))[0])



class Review468RegressionTests(unittest.TestCase):
    setUp=PackageTests.setUp
    fixture=PackageTests.fixture
    def test_r468_01_digest_describes_consumed_manifest_bytes(self):
        from unittest.mock import patch
        import hashlib
        from prepare_history import Batches
        manifest,_=self.fixture([row()]);consumed=manifest.read_bytes();finish=Batches.finish
        def change_manifest_after_batching(batches):
            result=finish(batches);manifest.write_text(json.dumps({'sources':[]}));return result
        with patch.object(Batches,'finish',change_manifest_after_batching):
            result=prepare(manifest,self.root/'out')
        self.assertEqual(result['input_manifest_sha256'],hashlib.sha256(consumed).hexdigest())
        self.assertNotEqual(result['input_manifest_sha256'],digest(manifest))
        self.assertEqual(result['summary']['total'],1)
    def test_r468_02_console_never_echoes_unknown_source(self):
        import subprocess,sys
        marker='SYNTHETIC_PRIVATE_SOURCE_DO_NOT_LOG'
        manifest,_=self.fixture([row(source=marker)]);out=self.root/'out'
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('prepare_history.py')),'--manifest',str(manifest),'--output',str(out)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0);self.assertNotIn(marker,result.stdout+result.stderr)
        summary=json.loads(result.stdout)['summary'];self.assertEqual(set(summary['by_source']),{'unknown'})
        self.assertEqual(json.loads((out/'rows.jsonl').read_text())['source'],marker)

if __name__=='__main__':unittest.main()
