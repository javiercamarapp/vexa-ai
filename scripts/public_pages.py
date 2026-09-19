"""Read public vendor pages without API credentials; retain provenance and raw HTML."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
 'thematic':'https://getthematic.com/',
 'chattermill':'https://chattermill.com/',
 'unitq':'https://www.unitq.com/',
 'sentisum':'https://www.sentisum.com/',
 'enterpret':'https://www.enterpret.com/',
 'gorgias':'https://www.gorgias.com/',
 'dovetail':'https://dovetail.com/',
 'senix':'https://senixtools.com/pages/about-us',
 'vercel-pricing':'https://vercel.com/pricing',
 'supabase-pricing':'https://supabase.com/pricing',
}
class Text(HTMLParser):
 def __init__(self):
  super().__init__(); self.hidden=0; self.parts=[]
 def handle_starttag(self, tag, attrs):
  if tag in ('script','style','svg','noscript'): self.hidden+=1
 def handle_endtag(self, tag):
  if tag in ('script','style','svg','noscript'): self.hidden=max(0,self.hidden-1)
 def handle_data(self, value):
  if not self.hidden and value.strip(): self.parts.append(value.strip())

def fetch(item):
 name,url=item; out=ROOT/'docs/investigacion/fuentes/web'; out.mkdir(parents=True,exist_ok=True)
 rawdir=ROOT/'private/public-html'; rawdir.mkdir(parents=True,exist_ok=True)
 try:
  response=requests.get(url,timeout=35,headers={'User-Agent':'VEXA-Research/0.1 public-documentation-review'})
  meta={'url':url,'final_url':response.url,'status':response.status_code,'retrieved_at':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(response.content).hexdigest()}
  (rawdir/(name+'.html')).write_bytes(response.content)
  parser=Text(); parser.feed(response.text)
  (out/(name+'.txt')).write_text(json.dumps(meta,ensure_ascii=False)+'\n\n'+'\n'.join(parser.parts))
  return name,response.status_code,len(parser.parts)
 except Exception as e: return name,'FAILED',str(e)
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=3) as pool:
  for result in pool.map(fetch,PAGES.items()): print(*result,flush=True)
