"""Print offline HTML and verify PDF completion; bound and clean up Chrome.
On this Mac Chrome may keep running after printing. Completion is the validated
artifact, not an assumption that the browser exits. Uses a new disposable profile.
"""
import os,signal,subprocess,tempfile,time,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
B=ROOT/'negocio'
def stop_group(proc):
 try:os.killpg(proc.pid,signal.SIGTERM)
 except ProcessLookupError:pass
 try:proc.wait(timeout=3)
 except subprocess.TimeoutExpired:pass
 try:os.killpg(proc.pid,signal.SIGKILL)
 except ProcessLookupError:pass
 proc.wait(timeout=3)
def render():
 chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
 if not Path(chrome).is_file():raise SystemExit('Chrome not installed at expected path; use another reviewed local renderer.')
 logdir=ROOT/'private/logs';logdir.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='vexa-pdf-') as temp:
  temp=Path(temp);pdf=temp/'report.pdf'
  argv=[chrome,'--headless','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--no-pdf-header-footer','--user-data-dir='+str(temp/'profile'),'--print-to-pdf='+str(pdf),(B/'INFORME-VEXA.html').as_uri()]
  verified=False;info=''
  with (logdir/'market-pdf-bounded.log').open('wb') as log:
   proc=subprocess.Popen(argv,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   try:
    end=time.monotonic()+60;last_size=None
    while time.monotonic()<end:
     time.sleep(.5)
     if pdf.is_file() and pdf.stat().st_size>1000:
      size=pdf.stat().st_size
      if size==last_size:
       check=subprocess.run(['pdfinfo',str(pdf)],text=True,capture_output=True,timeout=5)
       extracted=subprocess.run(['pdftotext',str(pdf),'-'],text=True,capture_output=True,timeout=5)
       if check.returncode==0 and extracted.returncode==0 and all(f'CAPÍTULO {i:02d}' in extracted.stdout for i in range(1,17)) and '53,514,300' in extracted.stdout:
        info=check.stdout;verified=True;break
      last_size=size
     if proc.poll() is not None and not pdf.is_file():break
   finally:stop_group(proc)
  if not verified:raise SystemExit('PDF completion not verified; existing delivery was not overwritten.')
  staging=B/'INFORME-VEXA.pdf.new';shutil.copyfile(pdf,staging);os.replace(staging,B/'INFORME-VEXA.pdf')
  print('PDF verified; 16 chapter markers and key amount present. Browser process group cleaned up.')
  print(next(x for x in info.splitlines() if x.startswith('Pages:')))
if __name__=='__main__':render()
