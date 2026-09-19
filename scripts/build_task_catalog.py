"""Render the initial task-level DAG to stdout; never run on an active graph.
This generator is preparation-only. Operators review the resulting graph and gates.
"""
import json
from create_build_graph import PHASES

tasks=[{'id':'E00','depends_on':[],'allowed_paths':['packages/economics'],
        'acceptance':'tests/acceptance/economics.test.mjs','prompt':'orchestration/prompts/E00.md',
        'objective':'Verificar kernel financiero existente contra contrato externo, corregir sólo fallos reproducibles.',
        'auto_accept':False,'requires_approval':False}]
last={phase[0]:f'{phase[0]}-{len(phase[6]):02d}' for phase in PHASES}
for pid,title,days,deps,paths,objective,steps,gates in PHASES:
 for i,step in enumerate(steps,1):
  tid=f'{pid}-{i:02d}'
  dependencies=[f'{pid}-{i-1:02d}'] if i>1 else ([last[d] for d in deps] or ['E00'])
  tasks.append({'id':tid,'phase':pid,'objective':step,'depends_on':dependencies,
                'allowed_paths':paths,'acceptance':f'tests/acceptance/{tid}.test.mjs',
                'prompt':f'orchestration/prompts/{pid}.md','auto_accept':False,
                'requires_approval':pid in ['F00','F08']})
print(json.dumps({'version':2,'provider':'codex-chatgpt','model':'gpt-6-astra',
                  'max_attempts_per_task':2,'turn_timeout_seconds':900,'concurrency':1,
                  'tasks':tasks},indent=2,ensure_ascii=False))
