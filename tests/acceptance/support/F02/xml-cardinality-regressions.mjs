// Independent review fixtures, preserved byte-for-byte. Synthetic ZIP/XML only;
// no claim of full Office/LibreOffice compatibility or universal XML safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory = new URL('./fixtures/independent-review/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
function fixture(name) {
  const file = `${name}.xlsx`;
  const bytes = readFileSync(new URL(file, directory));
  assert.equal(bytes.length, manifest[file].bytes, `FIXTURE_SIZE:${name}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest[file].sha256, `FIXTURE_HASH:${name}`);
  return bytes;
}
export function xmlCardinalityRegressions(parseXLSX) {
  test('F02-01 independent XML paired positive retains numeric text', () => {
    const result = parseXLSX(fixture('valid'));
    assert.equal(result.sheets.length, 1);
    assert.deepEqual(result.sheets[0].rows, [{values: ['12.34'], line: 1}]);
    assert.deepEqual(result.sheets[0].errors, []);
  });
  for (const name of ['duplicate-sheetdata', 'duplicate-value', 'alternate-content', 'foreign-richtext']) {
    test(`F02-01 independent XML rejects ${name} instead of silently losing/interpreting data`, () => {
      assert.throws(() => parseXLSX(fixture(name)), error => {
        assert.equal(typeof error.code, 'string', `XML_TYPED_REJECTION:${name}`);
        assert.match(error.code, /^XLSX_/, `XML_TYPED_REJECTION:${name}`);
        return true;
      }, `OOXML_REJECTION_REQUIRED:${name}`);
    });
  }
}
