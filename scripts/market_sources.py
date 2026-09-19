"""Collect public sources with provenance. No inference API; cached by source id."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from html.parser import HTMLParser
import hashlib,json,sys
from pathlib import Path
from urllib.parse import urljoin
import requests
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'negocio/00-Fuentes/web'; RAW=ROOT/'.firecrawl/mercado/raw'
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.hidden=0;self.text=[];self.links=[];self.anchor=None
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag in ('script','style','svg','noscript'):self.hidden+=1
  if tag=='a' and 'href' in attrs:self.anchor={'href':attrs['href'],'text':''}
 def handle_endtag(self,tag):
  if tag in ('script','style','svg','noscript'):self.hidden=max(0,self.hidden-1)
  if tag=='a' and self.anchor:self.links.append(self.anchor);self.anchor=None
 def handle_data(self,s):
  if not self.hidden and s.strip():
   self.text.append(s.strip())
   if self.anchor:self.anchor['text']+=s.strip()+' '
def fetch(item):
 name,url=item.split('=',1); OUT.mkdir(parents=True,exist_ok=True);RAW.mkdir(parents=True,exist_ok=True)
 dest=OUT/(name+'.txt')
 if dest.exists():return name,'CACHED'
 try:
  r=requests.get(url,timeout=(12,50),headers={'User-Agent':'Mozilla/5.0 (compatible; VEXAResearch/1.0; public-source-review)'})
  meta={'source_id':name,'url':url,'final_url':r.url,'http_status':r.status_code,'retrieved_at':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(r.content).hexdigest(),'content_type':r.headers.get('content-type','')}
  (RAW/(name+'.bin')).write_bytes(r.content)
  p=Parser()
  if 'html' in meta['content_type']:p.feed(r.text);text='\n'.join(p.text)
  else:text=r.text if not any(x in meta['content_type'] for x in ['spreadsheet','pdf','octet-stream']) else 'Binary file saved in raw; needs local parser.'
  for a in p.links:a['href']=urljoin(r.url,a['href'])
  (OUT/(name+'.links.json')).write_text(json.dumps(p.links,ensure_ascii=False,indent=2))
  dest.write_text(json.dumps(meta,ensure_ascii=False)+'\n\n'+text)
  return name,r.status_code,len(r.content),len(text)
 except Exception as e:return name,'FAILED',str(e)
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=4) as pool:
  for row in pool.map(fetch,sys.argv[1:]):print(*row,flush=True)
