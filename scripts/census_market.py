"""Extract published Census rows, preserving missing bands instead of filling zero."""
import csv,hashlib,json,shutil
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[1]
CODES=['--','31-33','42','44-45','454110','333112','333991','335210','335220','334310','337','339920','423710','444130','442','443','446120','451110','453910']
BANDS={f'{i:02d}' for i in range(9,18)}
def extract(path):
 rows=[];groups={}
 with path.open('rb') as f:
  ws=openpyxl.load_workbook(f,read_only=True,data_only=True).active
  for excel_row,r in enumerate(ws.iter_rows(values_only=True),1):
   code=str(r[0])
   if code not in CODES or not isinstance(r[2],str) or r[2][:2] not in BANDS:continue
   if not isinstance(r[3],int):raise ValueError('Non-numeric firm count; requires explicit handling')
   item={'naics':code,'description':r[1],'receipt_band_thousands_usd':r[2],'firms':r[3],'establishments':r[4],'excel_row':excel_row,'source':'CENSUS-SUSB-2022','source_sheet':'US 6-digit NAICS'}
   rows.append(item);groups.setdefault(code,[]).append(item)
 result=[]
 for code in CODES:
  values=groups.get(code,[]);missing=sorted(BANDS-{v['receipt_band_thousands_usd'][:2] for v in values})
  result.append({'naics':code,'description':values[0]['description'] if values else None,'published_firm_sum':sum(v['firms'] for v in values),'published_establishment_sum':sum(v['establishments'] for v in values),'present_bands':len(values),'missing_bands':missing,'complete_target_bands':not missing,'interpretation':'published sector count' if not missing else 'lower bound from published bands; missing does not mean zero','rows':[v['excel_row'] for v in values]})
 return rows,result
if __name__=='__main__':
 raw=ROOT/'.firecrawl/mercado/raw/census-receipts-2022.bin'
 out=ROOT/'negocio/05-Precios-y-Finanzas';out.mkdir(parents=True,exist_ok=True)
 source=ROOT/'negocio/00-Fuentes/census-receipts-2022.xlsx'
 if not source.exists():shutil.copyfile(raw,source)
 rows,result=extract(source)
 with (out/'census-filas.csv').open('w') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 metadata={'data_year':2022,'release_date':'2025-04-10','source_url':'https://www2.census.gov/programs-surveys/susb/tables/2022/us_6digitnaics_rcptsize_2022.xlsx','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'receipt_min_usd':10000000,'receipt_max_exclusive_usd':100000000,'naics_version':2017,'unit_warning':'Firm counts are industry-specific, NOT additive across NAICS; this is not a brand census. Missing bands are not zero.','sectors':result}
 (out/'universo-census.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False)+'\n')
 for s in result:print(s['naics'],s['published_firm_sum'],'complete='+str(s['complete_target_bands']))
