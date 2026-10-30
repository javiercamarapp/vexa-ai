// El dueño pidió: «que no haya botón de actualizar en ninguna página, que se actualice solo conforme entra la información».
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
const RAIZ=new URL('../src/',import.meta.url).pathname;
const archivos=(d)=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?archivos(p):[p];});
const fuentes=archivos(RAIZ).filter(p=>/\.(tsx|ts)$/.test(p)&&!p.includes('/app/api/')&&!/\.test\./.test(p));
const MANUAL=/^(actualizar|recargar|refrescar)\b/i;
test('ningún botón, enlace, aria-label o title manual de Actualizar/Recargar/Refrescar',()=>{
  const mal=[];
  for(const p of fuentes){
    const s=readFileSync(p,'utf8');
    for(const m of s.matchAll(/(?:aria-label|title)=["'](Actualizar|Recargar|Refrescar)[^"']*["']/gi))mal.push(relative(RAIZ,p)+' → '+m[0]);
    // Texto JSX de un control: >Actualizar …</Button|button|a|LinkButton>
    for(const m of s.matchAll(/<(Button|button|a|LinkButton)\b[^>]*>\s*([^<{]*)</g)){
      const t=m[2].trim();
      if(MANUAL.test(t)&&!/^recargar la página$/i.test(t))mal.push(relative(RAIZ,p)+' → '+m[0].slice(-60));
    }
  }
  assert.deepEqual(mal,[],'quedan controles manuales de actualizar');
});
test('LineaCache es solo informativa (sin onActualizar ni botón)',()=>{
  const s=readFileSync(join(RAIZ,'components/ui/linea-cache.tsx'),'utf8');
  assert.ok(!/onActualizar/.test(s)&&!/<button/.test(s));
  for(const p of fuentes)assert.ok(!/onActualizar/.test(readFileSync(p,'utf8')),'onActualizar en '+relative(RAIZ,p));
});
test('cada componente que lee datos se actualiza solo (useAutoRefresh, useJson/hook suscrito a vexa:refresh o sondeo propio marcado)',()=>{
  const sinSuscribir=[];
  for(const p of fuentes){
    const rel=relative(RAIZ,p);
    if(!rel.startsWith('components/')||rel.startsWith('components/ui/use-')||/hook|use-[a-z-]+\.ts$/.test(rel))continue;
    const s=readFileSync(p,'utf8');
    if(!/'use client'/.test(s))continue;
    const lee=/\bfetch\(|pedirSwr\(|leerConCache\(|fetchCupo\(/.test(s);
    if(!lee)continue;
    // Solo lecturas GET de datos de la vista; los componentes de acción pura (formularios, chat, descargas) no listan datos.
    const suscrito=/useAutoRefresh\(|useJson[<(]|vexa:refresh|auto-refresh:|use(Gaps|Fuga|Vista)\(/.test(s);
    if(!suscrito)sinSuscribir.push(rel);
  }
  assert.deepEqual(sinSuscribir,PERMITIDOS_SIN_LECTURA_VIVA,'componentes con lectura propia sin auto-refresco: añade useAutoRefresh');
});
// Componentes que hacen fetch solo por una acción del usuario (no muestran una lectura que envejezca).
const PERMITIDOS_SIN_LECTURA_VIVA=[
 // Superadmin: selector/paleta (lista bajo demanda al abrir), banner de soporte, MFA y /sin-acceso son acciones, no listas que envejezcan.
 // Cargas bajo demanda o acciones: se leen al abrir un detalle/enviar un formulario, no son una lista que envejezca en pantalla.
 'components/acciones/accion-fila.tsx','components/agente/agente.tsx','components/agente/answer-view.tsx','components/email-login-complete.tsx','components/email-login.tsx',
 'components/evidence-panel.tsx','components/history-items.tsx','components/notifications/navigation-link.tsx','components/platform/admin-tools.tsx','components/platform/copilot-panel.tsx','components/platform/mfa-panel.tsx','components/platform/owner-mfa-panel.tsx','components/platform/support-banner.tsx',
 'components/recommendations/flujo-borradores.tsx','components/sin-acceso.tsx','components/team-invitation.tsx','components/ui/citation.tsx','components/workspace/action-form.tsx',
];
