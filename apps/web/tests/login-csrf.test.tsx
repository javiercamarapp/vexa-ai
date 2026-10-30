// R2-07: el enlace mágico no instala la sesión sin confirmación explícita (login CSRF). Se prueba la lógica pura y que los dos componentes NO llamen al servidor al montarse con tokens en el fragmento.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/login-csrf.test.tsx
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {correoDeToken,tokensDeFragmento} from '../src/lib/auth-confirmacion';
const b64=(o:unknown)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=(p:object)=>`${b64({alg:'ES256'})}.${b64(p)}.firma`;
test('correoDeToken: lee el correo del payload solo para mostrarlo; descarta basura, HTML y tokens mal formados',()=>{
  assert.equal(correoDeToken(jwt({email:'persona@example.invalid'})),'persona@example.invalid');
  assert.equal(correoDeToken(jwt({email:'<script>@x.co'})),null);assert.equal(correoDeToken(jwt({email:42})),null);assert.equal(correoDeToken('a.b'),null);assert.equal(correoDeToken('x.%%%.z'),null);assert.equal(correoDeToken(null),null);
  assert.equal(correoDeToken(jwt({email:'a'.repeat(300)+'@x.co'})),null);
});
test('tokensDeFragmento: devuelve los tokens y el correo sin instalar nada; sin tokens devuelve null; con error lo marca',()=>{
  const t=tokensDeFragmento('#access_token='+jwt({email:'persona@example.invalid'})+'&refresh_token=abcdef&type=magiclink');
  assert.ok(t&&t.correo==='persona@example.invalid'&&t.refreshToken==='abcdef'&&!t.conError);
  assert.equal(tokensDeFragmento(''),null);assert.equal(tokensDeFragmento('#foo=bar'),null);
  assert.equal(tokensDeFragmento('#error=access_denied')?.conError,true);
});
const leer=(r:string)=>fs.readFileSync(new URL('../'+r,import.meta.url),'utf8');
test('los dos componentes piden confirmación antes de llamar a /session con los tokens del fragmento',()=>{
  const login=leer('src/components/email-login-complete.tsx'),inv=leer('src/components/team-invitation.tsx');
  for(const [nombre,src] of [['email-login-complete',login],['team-invitation',inv]] as const){
    assert.match(src,/tokensDeFragmento/,nombre+' usa el lector de fragmento');
    assert.match(src,/tr\.login\.confirmaEntrar/,nombre+' muestra «Entrar como <correo>»');
  }
  // El efecto de montaje ya no envía los tokens: el POST con refreshToken vive dentro de la función de confirmación.
  assert.doesNotMatch(login.slice(login.indexOf('useEffect('),login.indexOf('function establecer')),/body:JSON\.stringify\(\{accessToken,refreshToken\}\)/,'login: el efecto de montaje no instala la sesión');
  assert.match(login,/async function confirmar/);assert.match(inv,/async function confirmar/);
  assert.doesNotMatch(inv.slice(inv.indexOf('useEffect('),inv.indexOf('async function confirmar')),/operation:'session',accessToken,refreshToken/,'invitación: el efecto no envía tokens');
});
