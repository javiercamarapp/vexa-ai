#!/usr/bin/env python3
"""Read-only construction guide/audit. render writes generated docs, never DAG/state.
Spec completeness is separate from gate availability and product verification.
"""
import argparse,html,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from construction_catalog import catalog

def safe(p):return isinstance(p,str) and bool(p) and not Path(p).is_absolute() and '..' not in Path(p).parts

def audit(root,graph,cards):
 errors=[];missing=[]
 ids=[t['id'] for t in graph['tasks']];by={c['id']:c for c in cards}
 if len(by)!=len(cards) or set(by)!=set(ids):errors.append('Catalog IDs duplicated/missing/orphan')
 tasks={t['id']:t for t in graph['tasks']};visiting=set();done=set()
 def visit(id):
  if id in visiting:raise ValueError('cycle')
  if id not in tasks:raise ValueError('unknown dependency '+id)
  if id in done:return
  visiting.add(id)
  for d in tasks[id]['depends_on']:visit(d)
  visiting.remove(id);done.add(id)
 try:
  for id in ids:visit(id)
 except ValueError as e:errors.append(str(e))
 for t in graph['tasks']:
  id=t['id'];c=by.get(id)
  if c is None:continue
  for key in ['reads','deliverables','steps','oracles']:
   if not c.get(key) or not all(isinstance(x,str) and x.strip() for x in c[key]):errors.append(id+' missing '+key)
  if not c.get('recovery'):errors.append(id+' missing recovery')
  for p in c.get('reads',[]):
   if not safe(p) or not (root/p).is_file():errors.append(id+' unavailable input '+p)
  for p in c.get('deliverables',[]):
   if not safe(p):errors.append(id+' unsafe output '+p);continue
   if not any(safe(a) and (p==a or p.startswith(a.rstrip('/')+'/')) for a in t['allowed_paths']):errors.append(id+' output outside allowlist '+p)
   if c['mode']=='worker' and any(p==a or p.startswith(a+'/') for a in ['orchestration','tests/acceptance','private','.git','.github']):errors.append(id+' worker control write '+p)
  gate=t['acceptance']
  if not safe(gate):errors.append(id+' unsafe gate')
  elif not (root/gate).is_file() or (root/gate).stat().st_size<20:missing.append(id)
 return {'tasks':len(ids),'cards':len(cards),'errors':errors,'missing_gates':missing,'gates_available':len(ids)-len(missing),'ready':not errors and not missing,'product_verified':False,'meaning':'ready = gates available structurally, NOT passing tests, environment readiness or product completion'}

def packet(root,c):
 exists=(root/c['acceptance']).is_file()
 text=f"# {c['id']} — {c['objective']}\n\n"
 text+=f"**Modalidad:** {c['mode']}. **Dependencias:** {', '.join(c['depends_on']) or 'ninguna'}.\n"
 text+=f"**Gate:** {'PRESENT (no significa PASS)' if exists else 'MISSING — escribir/revisar primero en control-plane'}.\n\n"
 text+='## Entrada (leer, no inventar contexto)\n'+''.join('- `'+p+'`\n' for p in c['reads'])
 text+='\n## Salida prevista — no afirma que ya existe\n'+''.join('- `'+p+'`\n' for p in c['deliverables'])
 text+='\n## Pasos específicos\n'+''.join(f'{i}. {s}\n' for i,s in enumerate(c['steps'],1))
 text+='\n## Oráculos obligatorios para el gate\n'+''.join(f'- {s}\n' for s in c['oracles'])
 text+='\n## Preparar la prueba ANTES del worker\n'
 text+='1. Controlador escribe el gate siguiente a partir de los oráculos de arriba. Si requiere DB/browser, seguir 04-PRUEBAS-Y-LOOP.md; no sustituirlo por un JSON que diga passed.\n'
 text+='2. Ejecutar contra implementación ausente y contra el defecto específico (nulo→cero, duplicado, fuga, según tarea). Registrar fallo por la aserción correcta; un error de setup NO mata un mutante.\n'
 text+='3. Revisar gate fuera del candidato y hacer commit. Refrescar registro de gates y guía al agregar pruebas, antes de prepare, nunca durante una verificación.\n'
 text+='\n## Comandos del ciclo\n```bash\ncd ~/vexa\npython3 scripts/guide.py audit\n'
 text+=f"python3 scripts/guide.py packet --task {c['id']}\n"
 text+=f"python3 orchestration/runner.py prepare --task {c['id']} --max-minutes 1\n"
 text+='# Editar sólo el worktree impreso, sin commit; guardar su ruta en CANDIDATE.\n'
 text+=c.get('gate_command',f"VEXA_CANDIDATE=\"$CANDIDATE\" node --test {c['acceptance']}")+'\n'
 text+=f"python3 orchestration/runner.py verify --task {c['id']} --max-minutes 5"
 if c.get('requires_approval'):text+=' --approval-note "REFERENCIA A LA DECISIÓN REAL DEL OPERADOR"'
 text+='\n# Revisión independiente de diff, controles y log; NO aceptar por autoafirmación.\n'
 text+=f'# Si se rechaza: STOP + reject --task {c["id"]} --approval-note "referencia real"; ver capítulo 01.\n'
 text+=f"python3 orchestration/runner.py accept --task {c['id']} --max-minutes 5\n```\n"
 text+='Estos comandos fallan cerrados si faltan gate/dependencias/permiso; no son evidencia de ejecución. No pegar la nota de ejemplo como aprobación. La modalidad external requiere actos fuera del loop; prepare sólo abre un candidato local.\n'
 if c['mode']=='worker':text+='Alternativa offline una vez listo gate/entorno: `python3 orchestration/runner.py run --max-rounds 1 --max-minutes 20`. Selecciona la próxima tarea elegible del grafo; no garantiza que sea esta. Verificar estado antes.\n'
 text+='\n## Recuperación específica\n'+c['recovery']+'\n'
 text+='\n## Cierre obligatorio\n`task_id, baseline_sha, candidate_sha, fixture_hash, command, exit_code, expected, observed, artifacts, reviewer, pending`. Las pruebas/grafo no las edita el candidato. Dos fallos agotan intento; guardar reproducción y pasar a recuperación supervisada, no editar status=accepted. Build/instalación de dependencias se hacen en copia temporal para no mutar el candidato durante el gate.\n'
 return text

def render(root,cards):
 folder=root/'construccion';(folder/'tareas').mkdir(parents=True,exist_ok=True)
 def put(path,text):
  if path.exists() and not path.read_bytes():raise ValueError('Empty/placeholder destination '+str(path))
  path.write_text(text)
 put(folder/'catalogo.json',json.dumps(cards,indent=2,ensure_ascii=False)+'\n')
 for c in cards:put(folder/'tareas'/f"{c['id']}.md",packet(root,c))
 index='# Índice de las 55 fichas de construcción\n\nGenerado desde scripts/construction_catalog.py y el grafo vigente. No es una lista de trabajo ya ejecutado.\n\n'
 index+='| ID | Modalidad | Encargo |\n|---|---|---|\n'
 for c in cards:index+=f"| [{c['id']}](tareas/{c['id']}.md) | {c['mode']} | {c['objective']} |\n"
 put(folder/'05-TAREAS.md',index)
 import markdown
 docs=['README.md','00-COMPARACION-LIKIDA.md','01-ARRANQUE-Y-REANUDACION.md','02-ENTORNO.md','03-CONTRATOS.md','04-PRUEBAS-Y-LOOP.md','06-OPERACION-Y-RELEASE.md','07-RUBRICA.md','05-TAREAS.md']
 body='<h1>VEXA · Construcción de punta a punta</h1><p>Guía de implementación. No certifica SaaS desplegado. Las fichas indican gates pendientes.</p>'
 for name in docs:
  p=folder/name
  if not p.is_file():raise ValueError('Missing chapter '+name)
  body+=f'<section id="{html.escape(name)}">'+markdown.markdown(p.read_text(),extensions=['tables','fenced_code'])+'</section>'
 for c in cards:body+=f'<section id="{c["id"]}">'+markdown.markdown(packet(root,c),extensions=['tables','fenced_code'])+'</section>'
 page='<!doctype html><html lang="es"><meta charset="utf-8"><title>VEXA — guía de construcción</title><style>body{font:17px/1.6 system-ui;max-width:1100px;margin:40px auto;padding:24px;color:#19202a}h1,h2{line-height:1.15}h1{font-size:40px}h2{margin-top:2em}section{border-top:2px solid #ccd;padding-top:20px;margin-top:50px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #ddd;padding:9px;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f5;padding:16px;font-size:13px}code{overflow-wrap:anywhere}a{color:#1854a0}@media print{section{break-before:page;border:0;padding:0;margin:0}body{font-size:12px;line-height:1.45;margin:0;padding:0}h1{font-size:24px}h2{font-size:16px;margin-top:1em}pre{font-size:10px;padding:8px}table{font-size:10px}th,td{padding:5px}}@page{size:A4;margin:16mm}</style>'+body+'</html>'
 put(folder/'GUIA-COMPLETA.html',page)
 count=sum((root/c['acceptance']).is_file() for c in cards)
 home=f'''<!doctype html><html lang="es"><meta charset="utf-8"><title>VEXA · Construir</title><style>body{{font:20px/1.6 system-ui;max-width:820px;margin:8vh auto;padding:30px;color:#152235}}a{{display:block;margin:18px 0;color:#164a9d}}small{{color:#555}}</style><h1>Construir VEXA, paso a paso</h1><p>55 fichas · contratos · pruebas · recuperación · release</p><a href="construccion/GUIA-COMPLETA.html">Abrir la guía completa</a><a href="construccion/GUIA-COMPLETA.pdf">Descargar guía PDF</a><a href="construccion/README.md">Índice editable y comandos</a><a href="construccion/00-COMPARACION-LIKIDA.md">Comparación con Likida</a><a href="00-ABRE-ESTUDIO-DE-MERCADO.html">Mercado y finanzas</a><p><b>{count} gates presentes; {len(cards)-count} pendientes.</b> Presente no significa aprobado. La guía no certifica el SaaS ni autonomía sin supervisión.</p><small>Para ejecutar: cd ~/vexa · python3 scripts/guide.py next. Esta carpeta del Escritorio es una copia de entrega.</small></html>'''
 put(root/'00-ABRE-CONSTRUCCION.html',home)
 print('Rendered',len(cards),'task cards and offline guide; no state/DAG changes.')

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['audit','readiness','next','packet','render']);p.add_argument('--task');args=p.parse_args()
 graph=json.loads((ROOT/'orchestration/graph.json').read_text());cards=catalog(ROOT)
 if args.action in ['audit','readiness']:
  out=audit(ROOT,graph,cards);print(json.dumps(out,indent=2,ensure_ascii=False))
  raise SystemExit(1 if out['errors'] else (2 if args.action=='readiness' and not out['ready'] else 0))
 if args.action=='packet':
  c=next((x for x in cards if x['id']==args.task),None)
  if not c:p.error('--task must identify a graph task')
  print(packet(ROOT,c));return
 if args.action=='render':render(ROOT,cards);return
 if not (ROOT/'.git').exists():raise SystemExit('Delivery copy without Git/runtime. Open the canonical ~/vexa workspace; do not infer execution state from this copy.')
 statefile=ROOT/'.runtime/state.json';state=json.loads(statefile.read_text()) if statefile.exists() else {}
 # Surface prepared/verified/running blockers before suggesting any new attempt.
 for c in cards:
  status=state.get(c['id'],{}).get('status')
  if status in ['prepared','running','verified','blocked']:
   print(c['id'],status,'— review first: accept or supervised reject if verified; recover only failed/blocked. No new worker launched.');return
 for c in cards:
  row=state.get(c['id'],{})
  if row.get('status')=='accepted':continue
  if row.get('attempts',0)>=graph['max_attempts_per_task']:
   print(c['id'],'attempts exhausted — supervised recovery; never reset silently.');return
  if all(state.get(d,{}).get('status')=='accepted' for d in c['depends_on']):print(packet(ROOT,c));return
 print('No eligible task. Accepted graph tasks do not automatically prove real pilot/production.')
if __name__=='__main__':main()
