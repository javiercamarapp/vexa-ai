import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToString} from 'react-dom/server';
import {useHydrated,useLocationHash,useReducedMotion,useStoredString} from '../src/components/ui/browser-state';
import {Tip} from '../src/components/ui/tip';

function Preferences(){
 const hydrated=useHydrated(),reduced=useReducedMotion(),hash=useLocationHash();
 const [mode]=useStoredString('fixture:mode','tarjetas');
 return <output>{JSON.stringify({hydrated,reduced,hash,mode})}</output>;
}
test('SSR keeps deterministic preferences without reading window or storage',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,get(){throw new Error('SSR accessed browser');}});
 try{
  const html=renderToString(<Preferences/>);
  assert.match(html,/hydrated&quot;:false/);
  assert.match(html,/reduced&quot;:false/);
  assert.match(html,/hash&quot;:&quot;&quot;/);
  assert.match(html,/tarjetas/);
 }finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
test('tooltip keeps an accessible inline target during SSR before its browser portal mounts',()=>{
 const html=renderToString(<Tip label="Cifra observada"><span>Importe</span></Tip>);
 const described=html.match(/aria-describedby="([^"]+)"/)?.[1];
 assert.ok(described);
 assert.ok(html.includes(`id="${described}"`));
 assert.match(html,/role="tooltip"/);
 assert.match(html,/Cifra observada/);
 assert.doesNotMatch(html,/data-abierto/);
});
