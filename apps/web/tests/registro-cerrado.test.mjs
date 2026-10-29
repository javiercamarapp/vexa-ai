// Cerrar el registro público (disable_signup) no debe romper la creación de usuarios invitados ni los enlaces de acceso:
// estos caminos no usan signUp y los usuarios nuevos nacen de la API de administración. Si alguien añade un signUp, esta prueba falla.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../..');
const files=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.next','tests','.git'].includes(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|tsx|mjs|js)$/.test(e.name)&&!/\.test\./.test(e.name))files.push(f);}})(path.join(root,'apps/web/src'));
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','tests'].includes(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|mjs)$/.test(e.name)&&!/\.test\./.test(e.name))files.push(f);}})(path.join(root,'packages'));
test('ningún código del producto llama a auth.signUp (los usuarios nuevos solo nacen por invitación de administración)',()=>{
  const bad=files.filter(f=>/auth\.signUp\s*\(|\.signUp\(\{/.test(fs.readFileSync(f,'utf8')));
  assert.deepEqual(bad.map(f=>path.relative(root,f)),[]);
});
test('la invitación crea el usuario con la API de administración y el enlace de acceso nunca crea usuarios',()=>{
  const team=fs.readFileSync(path.join(root,'apps/web/src/lib/team/server.ts'),'utf8');
  assert.match(team,/auth\.admin\.inviteUserByEmail\(/);assert.match(team,/shouldCreateUser:false/);
  const mail=fs.readFileSync(path.join(root,'apps/web/src/lib/email-auth/server.ts'),'utf8');
  assert.match(mail,/shouldCreateUser:false/);assert.doesNotMatch(mail,/shouldCreateUser:true/);
  for(const f of files){const t=fs.readFileSync(f,'utf8');assert.doesNotMatch(t,/shouldCreateUser:\s*true/,path.relative(root,f));}
});
test('config.toml deja el registro cerrado y la confirmación de correo encendida, como producción',()=>{
  const t=fs.readFileSync(path.join(root,'supabase/config.toml'),'utf8');
  assert.match(t,/^enable_signup = false$/m);assert.doesNotMatch(t,/^enable_signup = true$/m);assert.match(t,/^enable_confirmations = true$/m);
});
test('el script de cierre solo cambia disable_signup, pide confirmación y no imprime el token',()=>{
  const s=fs.readFileSync(path.join(root,'ops/security/cerrar-registro.sh'),'utf8');
  assert.match(s,/disable_signup/);assert.match(s,/escribe SI/);assert.doesNotMatch(s,/echo[^\n]*SUPABASE_ACCESS_TOKEN/);assert.match(s,/hidden answer/);
});
