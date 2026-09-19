"""Check evidence package integrity and calculation artifacts, not market validity."""
import csv,hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];B=ROOT/'negocio'
errors=[];links=0
for p in [ROOT/'README.md',*B.rglob('*.md')]:
 for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',p.read_text()):
  if '://' in link or link.startswith(('mailto:','#')):continue
  link=link.split('#')[0];links+=1
  if not (p.parent/link).exists():errors.append(f'Broken local link: {p.relative_to(ROOT)} -> {link}')
reg=json.loads((B/'00-Fuentes/registro-fuentes.json').read_text())
for s in reg:
 if not (B/'00-Fuentes'/s['saved_text']).is_file():errors.append('missing source text '+s['id'])
 if s['used_in_analysis'] and s['http_status']!=200:errors.append('failed fetch presented as used '+s['id'])
meta=json.loads((B/'05-Precios-y-Finanzas/universo-census.json').read_text())
sha=hashlib.sha256((B/'00-Fuentes/census-receipts-2022.xlsx').read_bytes()).hexdigest()
if sha!=meta['sha256']:errors.append('Census source hash mismatch')
with (B/'05-Precios-y-Finanzas/forecast-36-meses.csv').open() as f:forecast=list(csv.DictReader(f))
if len(forecast)!=108:errors.append('forecast row count')
for name in ['conservador','base','expansion']:
 rows=[r for r in forecast if r['scenario']==name]
 if [int(r['month']) for r in rows]!=list(range(1,37)):errors.append('missing/duplicate month '+name)
pdf=B/'INFORME-VEXA.pdf'
info=subprocess.check_output(['pdfinfo',str(pdf)],text=True)
text=subprocess.check_output(['pdftotext',str(pdf),'-'],text=True)
for required in ['2,975','53,514,300','589.05','988,700','Corridas financieras de 36 meses','Registro de fuentes']:
 if required not in text:errors.append('missing PDF content '+required)
print('Census SHA256',sha)
print('Sources',len(reg),'used',sum(s['used_in_analysis'] for s in reg),'monthly rows',len(forecast),'local links',links)
print(next(x for x in info.splitlines() if x.startswith('Pages:')))
if errors:raise SystemExit('\n'.join(errors))
print('Business package integrity PASS. Scenario inputs are NOT validated demand or business results.')
