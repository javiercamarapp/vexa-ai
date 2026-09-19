"""Render authored market dossiers to one offline HTML; never embed fetched HTML."""
from pathlib import Path
import html,json,re
import markdown
ROOT=Path(__file__).resolve().parents[1];B=ROOT/'negocio'
CHAPTERS=[
 'MAPA-DE-COBERTURA.md','05-Precios-y-Finanzas/00-CIFRAS-CANONICAS.md',
 '02-Mercado/estudio-de-mercado.md','02-Mercado/icp-y-segmentacion.md',
 '05-Precios-y-Finanzas/tam-sam-som.md','03-Competencia/mapa-competitivo.md',
 '03-Competencia/capital-y-consolidacion.md','05-Precios-y-Finanzas/precio-y-unit-economics.md',
 '05-Precios-y-Finanzas/corridas-financieras.md','04-GTM/plan-comercial-90-dias.md',
 '06-Validacion/protocolo-entrevistas-y-wtp.md','01-Inversionistas/one-pager.md',
 '01-Inversionistas/memo-y-preguntas-dificiles.md','07-Riesgos-y-Compliance/premortem-y-condiciones.md',
 '08-Prospectos/lista-semilla.md','00-Fuentes/INDICE.md']
css='''
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;color:#202124;background:#efefed;font:16px/1.6 Arial,Helvetica,sans-serif}main{max-width:1120px;margin:35px auto;background:white;padding:64px 72px}.eyebrow{font-size:12px;letter-spacing:2px;font-weight:700}.cover{min-height:760px;display:flex;flex-direction:column;justify-content:center;border-bottom:3px solid #111;margin-bottom:42px}.cover h1{font-size:76px;line-height:1;margin:24px 0}.cover h2{font-size:31px;font-weight:400;max-width:730px}.cover .note{border-left:4px solid #222;padding:14px 20px;background:#f4f4f1;font-size:15px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:28px 0}.stat{border-top:1px solid #bbb;padding:14px 0}.stat strong{font-size:29px;display:block}.stat span{font-size:13px}.meta{font-size:12px;color:#555}.toc{padding-bottom:30px;border-bottom:1px solid #ddd}.toc a{color:#222}article{margin-top:62px}h1{font-size:31px;line-height:1.2;margin:28px 0 24px}h2{font-size:22px;line-height:1.25;margin-top:36px}h3{font-size:17px;margin-top:28px}table{border-collapse:collapse;width:100%;font-size:12px;line-height:1.45;margin:22px 0;table-layout:auto}th{background:#222;color:white;text-align:left}th,td{padding:9px 8px;border-bottom:1px solid #ccc;vertical-align:top;overflow-wrap:anywhere}tr:nth-child(even){background:#f7f7f5}blockquote{padding:12px 22px;background:#f4f4f1;border-left:3px solid #333;margin:22px 0}a{color:#2b5363;overflow-wrap:anywhere}code{font-size:12px;background:#f2f2f0;padding:2px 3px;overflow-wrap:anywhere}pre{white-space:pre-wrap;padding:14px;background:#f3f3f1;font-size:12px;overflow-wrap:anywhere}.chapter-label{font:11px monospace;color:#777;letter-spacing:1px}.footer{font-size:12px;border-top:1px solid #999;margin-top:45px;padding-top:20px}
@page{size:A4;margin:17mm 15mm 18mm}@media print{body{background:white;font-size:10.2px;line-height:1.45}main{padding:0;margin:0;max-width:none}.cover{min-height:240mm;margin:0;border:0;break-after:page}.cover h1{font-size:66px}.cover h2{font-size:28px}.cover .note{font-size:12px}.toc{break-after:page}article{break-before:page;margin-top:0}h1{font-size:25px}h2{font-size:17px;margin-top:22px}h3{font-size:13px}h1,h2,h3{break-after:avoid}table{font-size:8.3px;line-height:1.35}th,td{padding:6px 5px}thead{display:table-header-group}tr{break-inside:avoid}p,li{orphans:3;widows:3}pre,code{font-size:9px}a{color:#222;text-decoration:none}.stats .stat strong{font-size:26px}.stats .stat span{font-size:10px}}@media(max-width:800px){main{padding:25px;margin:0}.cover h1{font-size:55px}.stats{grid-template-columns:1fr}table{font-size:10px}}
'''
def render():
 toc=[];parts=[]
 for i,relative in enumerate(CHAPTERS,1):
  p=B/relative;text=p.read_text();title=text.splitlines()[0].lstrip('# ')
  anchor='chapter-'+str(i);toc.append(f'<li><a href="#{anchor}">{html.escape(title)}</a></li>')
  body=markdown.markdown(text,extensions=['tables','fenced_code','sane_lists'])
  def relink(match):
   link=match.group(1)
   if '://' in link or link.startswith(('#','mailto:')):return match.group(0)
   # All authored local links become relative to the book, not their source chapter.
   import os
   return 'href="'+html.escape(os.path.relpath(p.parent/link,B),quote=True)+'"'
  body=re.sub(r'href="([^"]+)"',relink,body)
  parts.append(f'<article id="{anchor}"><div class="chapter-label">CAPÍTULO {i:02d} · {html.escape(relative)}</div>{body}</article>')
 doc='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>VEXA — mercado, TAM/SAM/SOM y negocio</title><style>'+css+'</style></head><body><main>'
 doc+='''<section class="cover"><div class="eyebrow">VEXA / INVESTIGACIÓN DE NEGOCIO</div><h1>Del feedback<br>a una decisión<br>económica.</h1><h2>Mercado, TAM / SAM / SOM, competencia, estrategia comercial y escenarios financieros.</h2><div class="stats"><div class="stat"><strong>2,975</strong><span>Firmas núcleo USA · Census 2022<br>No clientes calificados</span></div><div class="stat"><strong>US$53.5M</strong><span>TAM núcleo anual a precio supuesto<br>No TAM global ni gasto observado</span></div><div class="stat"><strong>36 meses</strong><span>Modelo reproducible · 3 escenarios<br>No forecast validado</span></div></div><div class="note"><strong>Qué está probado y qué no.</strong> Los conteos proceden de datos oficiales; precios, filtros SAM y desempeño comercial son hipótesis visibles. No hay aquí entrevistas inventadas, clientes simulados ni ahorro atribuido sin evidencia.</div><p class="meta">19 de septiembre de 2026 UTC · USA cuantificado; México contextual<br>Fuentes primarias y comerciales, fórmulas, CSV/XLSX y límites de uso.<br>El software completo y su despliegue siguen pendientes.</p></section>'''
 doc+='<nav class="toc"><h1>Contenido</h1><ol>'+''.join(toc)+'</ol></nav>'+''.join(parts)
 doc+='<p class="footer">VEXA · Estudio de investigación secundaria y escenarios. Ver datos canónicos y supuestos antes de citar. El modelo no sustituye validación comercial, revisión legal ni comprobación de producto.</p></main></body></html>'
 (B/'INFORME-VEXA.html').write_text(doc)
 print('HTML offline generado:',len(CHAPTERS),'capítulos;',len(doc),'caracteres')
if __name__=='__main__':render()
