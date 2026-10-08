import { createHash } from 'node:crypto';
export const PROFILE = 's01-ui-source-content-actions-v2';
const sha = s => createHash('sha256').update(s).digest('hex');
export const contextDigest = document => sha(JSON.stringify(document));
const die = code => { throw Object.assign(new Error(code), { code }); };
const inline = new Set(['span','b','strong','i','em','u','a','code','font']);
const blocks = new Set(['div','p','section','article','pre','center','figure','figcaption','h1','h2','h3','h4','h5','h6']);
const table = new Set(['table','thead','tbody','tfoot','tr','td','th']);
const permitted = new Set(['root','br','hr','img','meta','blockquote','ul','ol','li',...inline,...blocks,...table]);
const metadata = new Set(['id','class','title','data-test-id','data-cv-message-history-id','data-unsubscribe','data-hs-linktype','data-hs-unsubscribe-locale']);
const hash = /^[a-f0-9]{64}$/;
const normalWS = /[\t\n\f\r ]+/g;
function destination(href, base, exportContextSpaces=false) {
  if(typeof href!=='string'||!href||/[\u0000-\u001f\u007f]/u.test(href))die('UNSUPPORTED_HREF');
  if(href.includes(' ')&&!(exportContextSpaces&&typeof base==='string'&&!/^[A-Za-z][A-Za-z0-9+.-]*:|^\/\//u.test(href)&&!href.includes('\\')&&!href.startsWith(' ')&&!href.endsWith(' ')))die('UNSUPPORTED_HREF');
  let u; try { u = new URL(href, base); } catch { die('UNSUPPORTED_HREF'); }
  if (!['http:','https:','mailto:','tel:'].includes(u.protocol) || u.username || u.password) die('UNSUPPORTED_HREF');
  if (u.protocol === 'mailto:' && !/^mailto:[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(u.href)) die('UNSUPPORTED_MAILTO');
  if (u.protocol === 'tel:' && !/^tel:\+?[0-9]+$/.test(u.href)) die('UNSUPPORTED_TEL');
  return u.href;
}
// No partial token matching. Punctuation outside the conservative grammar stays literal.
const host = '(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}';
const patterns = [
  { kind:'url', re:/https?:\/\/[^\s<>"']+/gu, target:s=>destination(s) },
  { kind:'email', re:new RegExp("[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"+host,'gu'), target:s=>destination('mailto:'+s) },
  { kind:'host', re:new RegExp(host,'gu'), target:s=>destination('http://'+s) },
  { kind:'tel', re:/(?:\+[1-9][0-9]{0,2}(?:[ .-][0-9]{2,4}){2,5}|\([0-9]{3}\) [0-9]{3}-[0-9]{4}|[0-9]{3}\.[0-9]{3}\.[0-9]{4}|[0-9]-[0-9]{3}-[0-9]{3}-[0-9]{4}|[0-9]{3}-[0-9]{3}-[0-9]{4})/gu,
    target:s=>{ const digits=s.replace(/[ ().-]/g,''); if (!/^\+?[0-9]{10,15}$/.test(digits)) return null; return 'tel:'+digits; } },
];
const before = c => c === undefined || /[\t\n\f\r \u00a0([{\u003c\u0022\u0027\u003d]/u.test(c);
const after = c => c === undefined || /[\t\n\f\r \u00a0)\]},;!?\u003e\u0022\u0027]/u.test(c);
export function lexicalLinks(text) {
  const out=[];
  for (const {kind,re,target} of patterns) {
    re.lastIndex=0;
    for (const m of text.matchAll(re)) {
      let start=m.index,end=start+m[0].length,literal=m[0];
      // Explicit single-quote convention, not an RFC-intent inference.
      if(kind==='email'&&literal.startsWith("'")){
        if(literal.startsWith("''")||text[end]!=="'"||!before(text[start-1])||!after(text[end+1])||text[end+1]==="'"||text[start-1]==="'")continue;
        start++;literal=literal.slice(1);if(!literal||literal.startsWith('@'))continue;
      }
      if(kind==='email'&&!m[0].startsWith("'")&&text[end]==="'")continue;
      const terminalDot=['host','email'].includes(kind)&&text[end]==='.'&&after(text[end+1]);
      if (!before(text[start-1]) || !(after(text[end])||terminalDot)) continue;
      const overlap=out.find(x=>start<x.end&&end>x.start);
      if (overlap) { if (start>=overlap.start&&end<=overlap.end) continue; die('UNSUPPORTED_LEXICAL_OVERLAP'); }
      // Explicit extension syntax is not a simple phone; never annotate its prefix.
      if (kind==='tel' && /^ *(?:x[0-9]|ext\b|extension\b)/i.test(text.slice(end))) continue;
      const href=target(literal); if (href) out.push({start,end,href,kind});
    }
  }
  return out.sort((a,b)=>a.start-b.start);
}
export function project(input) {
  const {tree,base=null,sourceSha256,treeSha256,mimeBindings={},exportContextRelativeSpaces=false}=input;
  if(typeof exportContextRelativeSpaces!=='boolean')die('UNSUPPORTED_CONTEXT_OPTION');
  if(!hash.test(sourceSha256??'')||!hash.test(treeSha256??'')||sha(JSON.stringify(tree))!==treeSha256)die('UNSUPPORTED_SOURCE_PIN');
  let baseResolved;
  if(base!==null){try{const u=new URL(base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw 0;baseResolved=u.href;}catch{die('UNSUPPORTED_BASE');}}
  if(!mimeBindings||typeof mimeBindings!=='object'||Array.isArray(mimeBindings))die('UNSUPPORTED_MIME');
  const attributeTrace=[];
  function sourceImage(src){
    if(typeof src!=='string'||!src)die('UNSUPPORTED_IMAGE_SRC');
    if(/^(?:cid:|blob:|file:)/i.test(src)){
      const binding=mimeBindings[src];
      if(!binding||!hash.test(binding.partSha256??'')||!hash.test(binding.archiveSha256??'')||typeof binding.mimeType!=='string'||!binding.mimeType.startsWith('image/')||typeof binding.originalUri!=='string')die('UNSUPPORTED_IMAGE_MIME');
      src=binding.originalUri;
    }
    const url=destination(src,baseResolved);if(!/^https?:/.test(url))die('UNSUPPORTED_IMAGE_SRC');return url;
  }
  const tokens=[],links=[],trace=[],structuralTrace=[],ids=new Set(); let units=[],flowMode=null,flowStartsAtBoundary=true,nodes=0,totalChars=0;
  function flush(trimEnd=false) {
    if (!units.length) {flowMode=null;return;}
    const groups=[];
    for (const u of units) {
      const last=groups.at(-1);
      if (last && (last.link?.href??null)===(u.link?.href??null) && last.context===u.context) {last.text+=u.text;last.nodes.push(u.node);}
      else groups.push({...u,nodes:[u.node]});
    }
    let text='',explicit=[];
    for (const g of groups) {
      let value=g.text.normalize('NFC');
      if (flowMode==='normal') {
        value=value.replace(normalWS,' ');
        value=value.replace(/[ \u00a0]+/gu,(run,offset)=> {
          // Multiple NBSP runs must not be reduced, including an ASCII gap between them.
          if ([...run].filter(c=>c==='\u00a0').length!==1) return run;
          if (run!=='\u00a0') trace.push({rule:'flow-nbsp-adjacent-ascii-v1',nodes:g.nodes,offset,original:run});
          return '\u00a0';
        });
        if (text.endsWith(' ')&&value.startsWith(' ')) value=value.slice(1);
      }
      const start=text.length;text+=value;
      if (g.link!==null) { if (value) explicit.push({start,end:text.length,href:g.link.href}); }
    }
    if (flowMode==='normal') {
      const left=flowStartsAtBoundary&&text.startsWith(' ')?1:0;const right=trimEnd&&text.endsWith(' ')?1:0;
      text=text.slice(left,right?text.length-right:undefined);
      explicit=explicit.map(x=>({...x,start:Math.max(0,x.start-left),end:Math.min(text.length,x.end-left)}));
      explicit=explicit.filter(x=>x.start<x.end);
    }
    const effective=[...explicit];
    for (const d of lexicalLinks(text)) {
      const overlap=explicit.filter(x=>d.start<x.end&&d.end>x.start);
      if (overlap.length) { if (overlap.length!==1 || d.start<overlap[0].start || d.end>overlap[0].end) die('UNSUPPORTED_LINK_OVERLAP'); continue; }
      effective.push({start:d.start,end:d.end,href:d.href});
    }
    if (text) {
      const token=tokens.length;tokens.push({kind:flowMode==='normal'?'TEXT':'EXACT',value:text});
      const merged=[];for(const x of effective.sort((a,b)=>a.start-b.start)){const prior=merged.at(-1);if(prior&&prior.end===x.start&&prior.href===x.href)prior.end=x.end;else merged.push({...x});}
      for (const x of merged) links.push({token,...x,label:text.slice(x.start,x.end)});
    }
    units=[];flowMode=null;flowStartsAtBoundary=false;
  }
  const softBoundary=kind=>/^(?:BLOCK|QUOTE|FIGURE|FIGCAPTION|HEADING_[1-6])_(?:OPEN|CLOSE)$/.test(kind)||kind==='HARD_BREAK'||kind==='SEPARATOR';
  const emit=(kind,details={},boundary=true,regime='normal')=>{
    structuralTrace.push({kind,...details,regime});
    // Attributes and visual direction remain in trace, not in the content tape.
    if(kind==='ATTRIBUTES_OPEN'||kind==='ATTRIBUTES_CLOSE')return;
    if(softBoundary(kind)&&regime==='normal'){
      if(flowMode!==null&&flowMode!=='normal')flush(false);
      flowMode='normal';units.push({text:' ',link:null,context:'normal',node:'structural-boundary'});return;
    }
    flush(boundary);tokens.push({kind,...details});flowStartsAtBoundary=boundary;
  };
  function walk(n,inheritedLink=null,parentTag=null,parentMode=null,parentMarker=null) {
    if (!n||typeof n!=='object'||Array.isArray(n)||!permitted.has(n.tag)||!Array.isArray(n.children)||typeof n.id!=='string'||ids.has(n.id)) die('UNSUPPORTED_DOM');
    ids.add(n.id); if (++nodes>10000) die('LIMIT_NODES');
    const tag=n.tag,a=n.attrs??{};if(!a||typeof a!=='object'||Array.isArray(a))die('UNSUPPORTED_ATTRIBUTES');
    attributeTrace.push({node:n.id,tag,attributes:a});
    if(tag==='meta'){
      const keys=Object.keys(a).sort().join(',');
      const charset=keys==='charset'&&/^utf-8$/i.test(a.charset);
      const contentType=keys==='content,http-equiv'&&/^content-type$/i.test(a['http-equiv'])&&/^text\/html;[ \t]*charset=utf-8$/i.test(a.content);
      if(n.children.length||!(charset||contentType))die('UNSUPPORTED_META');return;
    }
    const presentation=new Set(['style','class','id','hidden','aria-hidden','align','valign','bgcolor','width','height','cellpadding','cellspacing','color','size','face','border']);
    const transport=new Set(['data-test-id','data-cv-message-history-id','data-unsubscribe','data-hs-linktype','data-hs-unsubscribe-locale','data-hs-signature','data-file-id','data-outlook-trace','data-top-level','data-use-proxy','data-hs-unsubscribe-language','data-hs-link-text','data-hs-link-url-text']);
    const semantic={};
    for(const[key,value]of Object.entries(a)){
      if(typeof value!=='string')die('UNSUPPORTED_ATTRIBUTES');
      if(key.startsWith('on')||key==='contenteditable')die('UNSUPPORTED_ATTRIBUTES');
      if(['title','dir','lang'].includes(key)){semantic[key]=value;continue;}
      if(presentation.has(key)||transport.has(key))continue;
      if(tag==='a'&&['href','rel','target','metric'].includes(key))continue;
      if(tag==='blockquote'&&key==='type'){if(value!=='cite')die('UNSUPPORTED_QUOTE_TYPE');continue;}
      if(tag==='img'&&['src','alt','data-original-src'].includes(key))continue;
      if(tag==='a'&&['data-hs-link-text','data-hs-link-url-text'].includes(key))continue;
      if(tag==='ol'&&['start','reversed','type'].includes(key))continue;
      if(tag==='li'&&key==='value')continue;
      if(['td','th'].includes(tag)&&['rowspan','colspan'].includes(key))continue;
      die('UNSUPPORTED_ATTRIBUTES');
    }
    if(a.dir!==undefined&&!['ltr','rtl','auto'].includes(a.dir))die('UNSUPPORTED_DIRECTION');
    // SOURCE_DOM follows syntactic HTML regimes; this is not CSS/render attestation.
    const c={whiteSpace:['pre','code'].includes(tag)?'pre':(parentMode??'normal'),structural:tag==='root'?'transparent':'native'};
    const centerElements=n.children.filter(x=>typeof x!=='string');
    if(tag==='center'&&c.whiteSpace==='normal'&&Object.keys(semantic).length===0&&centerElements.length===1&&(blocks.has(centerElements[0].tag)||['blockquote','ul','ol','table'].includes(centerElements[0].tag))&&n.children.every(x=>typeof x!=='string'||/^[\t\n\f\r ]*$/.test(x)))c.structural='transparent';
    if(tag==='li'&&!['ul','ol'].includes(parentTag))die('UNSUPPORTED_STRUCTURE');
    if(tag==='tr'&&!['table','thead','tbody','tfoot'].includes(parentTag))die('UNSUPPORTED_STRUCTURE');
    if(['td','th'].includes(tag)&&parentTag!=='tr')die('UNSUPPORTED_STRUCTURE');
    if(['thead','tbody','tfoot'].includes(tag)&&parentTag!=='table')die('UNSUPPORTED_STRUCTURE');
    const cellSpans={};
    if(['td','th'].includes(tag))for(const name of ['rowspan','colspan']){const raw=a[name]??'1';if(!/^[1-9][0-9]{0,3}$/.test(raw))die('UNSUPPORTED_TABLE_SPAN');cellSpans[name]=Number(raw);}
    if(Object.keys(semantic).length)emit('ATTRIBUTES_OPEN',{attributes:Object.fromEntries(Object.entries(semantic).sort())},!inline.has(tag)&&tag!=='img');
    if(tag==='img'){
      if(n.children.length)die('UNSUPPORTED_STRUCTURE');
      emit('IMAGE',{src:sourceImage(a.src),alt:Object.hasOwn(a,'alt')?a.alt.normalize('NFC'):null,link:inheritedLink?.href??null},false);
      if(Object.keys(semantic).length)emit('ATTRIBUTES_CLOSE',{},false);return;
    }
    if(tag==='hr'){if(n.children.length)die('UNSUPPORTED_STRUCTURE');emit('SEPARATOR',{},true,c.whiteSpace);if(Object.keys(semantic).length)emit('ATTRIBUTES_CLOSE');return;}
    if(inheritedLink!==null&&!inline.has(tag)&&tag!=='img')die('UNSUPPORTED_LINK_STRUCTURE');
    let link=inheritedLink;
    if(tag==='a'&&(a.rel!==undefined||a.target!==undefined)){
      // Only non-content navigation hints known not to add an action. Preserve in trace.
      if(a.target!==undefined&&!['_blank','_self'].includes(a.target))die('UNSUPPORTED_LINK_ACTION');
      if(a.rel!==undefined&&a.rel.split(/[ \t\r\n]+/).filter(Boolean).some(x=>!['noopener','noreferrer','nofollow'].includes(x)))die('UNSUPPORTED_LINK_ACTION');
    }
    if (tag==='a'&&a.href!==undefined) {if (link!==null) die('UNSUPPORTED_NESTED_LINK');link={href:destination(a.href,baseResolved,exportContextRelativeSpaces),id:n.id};}
    if(tag==='a'&&a.href!==undefined){
      const textOf=x=>typeof x==='string'?x:x.children.map(textOf).join('');
      const hasAtomic=x=>typeof x!=='string'&&(x.tag==='img'||x.children.some(hasAtomic));
      const text=textOf(n);const noContent=/^[\t\n\f\r ]*$/.test(text)&&!hasAtomic(n);
      if(noContent)emit('EMPTY_LINK',{href:link.href,text:text.normalize('NFC')},false);
    }
    let boundary=null,details={};
    if (c.structural!=='transparent') {
      if(blocks.has(tag)) boundary=/^h[1-6]$/.test(tag)?'HEADING_'+tag.slice(1):['figure','figcaption'].includes(tag)?tag.toUpperCase():'BLOCK';
      else if (tag==='blockquote') boundary='QUOTE';
      else if (['ul','ol'].includes(tag)) {
        boundary='LIST';details={ordered:tag==='ol'};
        if (tag==='ol') {
          if (a.start!==undefined&&!/^-?[0-9]{1,6}$/.test(a.start)) die('UNSUPPORTED_LIST');
          if (a.reversed!==undefined&&!['','reversed'].includes(a.reversed)) die('UNSUPPORTED_LIST');
          if (a.type!==undefined&&!['1','a','A','i','I'].includes(a.type)) die('UNSUPPORTED_LIST');
          details={...details,start:a.start===undefined?null:Number(a.start),reversed:a.reversed!==undefined,type:a.type??'1'};
          // HTML list type is represented, independently of CSS-generated markers.
        }
      } else if(tag==='li') {boundary='ITEM';if(a.value!==undefined&&!/^-?[0-9]{1,6}$/.test(a.value))die('UNSUPPORTED_LIST');details={value:a.value===undefined?null:Number(a.value)};}
      else if(table.has(tag)) {boundary=tag.toUpperCase();if(['td','th'].includes(tag))details=cellSpans;}
    }
    if (tag==='br') {if(n.children.length)die('UNSUPPORTED_STRUCTURE');emit('HARD_BREAK',{},true,c.whiteSpace);if(Object.keys(semantic).length)emit('ATTRIBUTES_CLOSE');return;}
    const anchorStart={tokens:tokens.length,units:units.length};
    if(boundary)emit(boundary+'_OPEN',details,true,c.whiteSpace);
    const exactScope=c.whiteSpace==='pre'&&parentMode!=='pre';if(exactScope)emit('EXACT_SCOPE_OPEN',{},false);
    if(parentMode!==null&&parentMode!==c.whiteSpace)flush();
    for(const child of n.children) {
      if(typeof child==='string') {
        totalChars+=child.length;if(totalChars>8*1024*1024)die('LIMIT_TEXT');
        if(/\u0000/u.test(child))die('UNSUPPORTED_TEXT');
        if(['ul','ol','table','thead','tbody','tfoot','tr'].includes(tag)){if(/[^\t\n\f\r ]/.test(child))die('UNSUPPORTED_STRUCTURE');continue;}
        if(flowMode!==null&&flowMode!==c.whiteSpace)flush();flowMode=c.whiteSpace;
        // Context identity is the regime, not node ID: transparent inline splits cannot break NFC/whitespace runs.
        units.push({text:child,link,context:c.whiteSpace,node:n.id});
      } else {
        if(tag==='ul'||tag==='ol'){if(child.tag!=='li')die('UNSUPPORTED_STRUCTURE');}
        if(tag==='tr'&&!['td','th'].includes(child.tag))die('UNSUPPORTED_STRUCTURE');
        walk(child,link,tag,c.whiteSpace,['ol','ul'].includes(tag)?c.marker:null);
      }
    }
    
    if(exactScope)emit('EXACT_SCOPE_CLOSE',{},false);
    if(boundary)emit(boundary+'_CLOSE',{},true,c.whiteSpace);
    if(Object.keys(semantic).length)emit('ATTRIBUTES_CLOSE',{},!inline.has(tag));
    if(parentMode!==null&&parentMode!==c.whiteSpace)flush();
  }
  walk(tree);flush(true);
  const value={profile:PROFILE,tokens,links};
  return {status:'SUPPORTED',value,digest:sha(JSON.stringify(value)),trace,attributeTrace,structuralTrace,provenance:{sourceSha256,treeSha256,kind:'UI_SOURCE_CONTENT_ACTIONS',renderedVisibilityVerified:false},formalAcceptance:false};
}
export function compare(expected,actual) {
  for(const result of [expected,actual]) {
    if(result?.status!=='SUPPORTED'||!hash.test(result.digest??'')||result.value?.profile!==PROFILE||!Array.isArray(result.value?.tokens)||!Array.isArray(result.value?.links)||sha(JSON.stringify(result.value))!==result.digest) die('UNSUPPORTED_COMPARISON');
  }
  const matches=expected.digest===actual.digest;
  return {status:matches?'MATCH':'MISMATCH',uiSourceContentActionsReconciled:matches,quoteAttributionVerified:false,visualStructureVerified:false,uiPlaintextVerified:false,richBytesEqual:false,formalAcceptance:false};
}
