import {parseFragment} from 'parse5';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function fragmentTree(html){
 if(typeof html!=='string'||Buffer.byteLength(html,'utf8')>8*1024*1024)fail('FRAGMENT_INPUT_LIMIT');
 // Parsing only. No DOM/window, execution, resource loader or network facilities.
 const fragment=parseFragment(html,{scriptingEnabled:false});let count=0;
 function node(n,depth){
  if(depth>256||++count>100000)fail('FRAGMENT_TREE_LIMIT');
  if(n.nodeName==='#text')return n.value;
  if(!n.tagName)return null;
  if(n.namespaceURI!=='http://www.w3.org/1999/xhtml')fail('FRAGMENT_NAMESPACE');
  const attrs=Object.create(null);
  for(const a of n.attrs){if(a.namespace||a.prefix||Object.hasOwn(attrs,a.name))fail('FRAGMENT_ATTRIBUTE');attrs[a.name]=a.value;}
  // Same document-fragment root and depth-first element IDs as the browser collector.
  const result={tag:n.tagName,id:String(++elementId),attrs,children:[]};
  for(const child of n.childNodes??[]){const v=node(child,depth+1);if(v!==null)result.children.push(v);}
  return result;
 }
 let elementId=0;
 return {tag:'root',id:'source-dom-fragment-root',attrs:{},children:fragment.childNodes.map(n=>node(n,1)).filter(n=>n!==null)};
}
