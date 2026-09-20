// Deliberately bounded OOXML grammar. No wildcard elements, attributes or subtrees.
export const sheetNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const relNS='http://schemas.openxmlformats.org/package/2006/relationships';
export const officeNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const typesNS='http://schemas.openxmlformats.org/package/2006/content-types';
const xmlNS='http://www.w3.org/XML/1998/namespace';
const xmlnsNS='http://www.w3.org/2000/xmlns/';
const key=(uri,local)=>`${uri}|${local}`;
const specs=new Map();
function rule(name,attrs='',children=[],text=false,uri=sheetNS){
 specs.set(key(uri,name),{attrs:new Set(attrs.split(' ').filter(Boolean).map(a=>a==='r:id'?key(officeNS,'id'):a==='xml:space'?key(xmlNS,'space'):key('',a))),children:new Map(children.map(([n,min=0,max=1],rank)=>[n,{min,max,rank}])),text});
}
rule('Types','',[['Default',0,Infinity],['Override',0,Infinity]],false,typesNS);
rule('Default','Extension ContentType',[],false,typesNS);rule('Override','PartName ContentType',[],false,typesNS);
rule('Relationships','',[['Relationship',0,Infinity]],false,relNS);
rule('Relationship','Id Type Target TargetMode',[],false,relNS);
rule('workbook','',[['fileVersion'],['workbookPr'],['workbookProtection'],['bookViews'],['sheets',1],['definedNames'],['calcPr']]);
rule('fileVersion','appName lastEdited lowestEdited rupBuild codeName');
rule('workbookPr','date1904 showObjects showBorderUnselectedTables filterPrivacy promptedSolutions showInk backupFile saveExternalLinkValues updateLinks codeName hidePivotFieldList showPivotChartFilter allowRefreshQuery autoCompressPictures refreshAllConnections defaultThemeVersion');
rule('bookViews','',[['workbookView',1,Infinity]]);
rule('workbookView','visibility minimized showHorizontalScroll showVerticalScroll showSheetTabs xWindow yWindow windowWidth windowHeight tabRatio firstSheet activeTab autoFilterDateGrouping');
rule('sheets','',[['sheet',1,Infinity]]);rule('sheet','name sheetId state r:id');
rule('calcPr','calcId calcMode fullCalcOnLoad refMode iterate iterateCount iterateDelta fullPrecision calcCompleted calcOnSave concurrentCalc concurrentManualCount forceFullCalc');
rule('worksheet','',[['sheetPr'],['dimension'],['sheetViews'],['sheetFormatPr'],['cols'],['sheetData',1],['sheetCalcPr'],['sheetProtection'],['autoFilter'],['sortState'],['mergeCells'],['phoneticPr'],['printOptions'],['pageMargins'],['pageSetup'],['headerFooter']]);
rule('sheetPr','syncHorizontal syncVertical syncRef transitionEvaluation transitionEntry published codeName filterMode enableFormatConditionsCalculation',[['tabColor'],['outlinePr'],['pageSetUpPr']]);
rule('tabColor','auto indexed rgb theme tint');
rule('outlinePr','applyStyles summaryBelow summaryRight showOutlineSymbols');rule('pageSetUpPr','autoPageBreaks fitToPage');
rule('dimension','ref');rule('sheetViews','',[['sheetView',1,Infinity]]);
rule('sheetView','windowProtection showFormulas showGridLines showRowColHeaders showZeros rightToLeft tabSelected showRuler showOutlineSymbols defaultGridColor showWhiteSpace view topLeftCell colorId zoomScale zoomScaleNormal zoomScaleSheetLayoutView zoomScalePageLayoutView workbookViewId',[['pane'],['selection',0,4]]);
rule('pane','xSplit ySplit topLeftCell activePane state');rule('selection','pane activeCell activeCellId sqref');
rule('sheetFormatPr','baseColWidth defaultColWidth defaultRowHeight customHeight zeroHeight thickTop thickBottom outlineLevelRow outlineLevelCol');
rule('cols','',[['col',1,Infinity]]);rule('col','min max width style hidden bestFit customWidth phonetic outlineLevel collapsed');
rule('sheetData','',[['row',0,Infinity]]);
rule('row','r spans s customFormat ht hidden customHeight outlineLevel collapsed thickTop thickBot ph',[['c',0,Infinity]]);
rule('c','r s t cm vm ph',[['f'],['v'],['is']]);
rule('f','t aca ref dt2D dtr del1 del2 r1 r2 ca si bx',[],true);rule('v','',[],true);
rule('sst','count uniqueCount',[['si',0,Infinity]]);
for(const name of ['si','is'])rule(name,'',[['t'],['r',0,Infinity],['rPh',0,Infinity],['phoneticPr']]);
rule('t','xml:space',[],true);rule('r','',[['rPr'],['t',1]]);
const properties=['rFont','charset','family','b','i','strike','outline','shadow','condense','extend','color','sz','u','vertAlign','scheme'];
rule('rPr','',properties.map(n=>[n]));
for(const name of properties)rule(name,name==='color'?'auto indexed rgb theme tint':'val');
rule('rPh','sb eb',[['t',1]]);rule('phoneticPr','fontId type alignment');
rule('sheetCalcPr','fullCalcOnLoad');rule('mergeCells','count',[['mergeCell',1,Infinity]]);rule('mergeCell','ref');
rule('printOptions','horizontalCentered verticalCentered headings gridLines gridLinesSet');rule('pageMargins','left right top bottom header footer');
rule('pageSetup','paperSize paperHeight paperWidth scale firstPageNumber fitToWidth fitToHeight pageOrder orientation usePrinterDefaults blackAndWhite draft cellComments useFirstPageNumber errors horizontalDpi verticalDpi copies r:id');
// Common writer metadata remains a closed grammar, including all descendants.
rule('workbookProtection','workbookPassword workbookPasswordCharacterSet revisionsPassword revisionsPasswordCharacterSet lockStructure lockWindows lockRevision revisionsAlgorithmName revisionsHashValue revisionsSaltValue revisionsSpinCount workbookAlgorithmName workbookHashValue workbookSaltValue workbookSpinCount');
rule('sheetProtection','password algorithmName hashValue saltValue spinCount sheet objects scenarios formatCells formatColumns formatRows insertColumns insertRows insertHyperlinks deleteColumns deleteRows selectLockedCells sort autoFilter pivotTables selectUnlockedCells');
rule('definedNames','',[['definedName',0,Infinity]]);
rule('definedName','name comment customMenu description help statusBar localSheetId hidden function vbProcedure xlm functionGroupId shortcutKey publishToServer workbookParameter',[],true);
rule('autoFilter','ref',[['filterColumn',0,Infinity],['sortState']]);
rule('filterColumn','colId hiddenButton showButton',[['filters'],['top10'],['customFilters'],['dynamicFilter'],['colorFilter'],['iconFilter']]);
rule('filters','blank calendarType',[['filter',0,Infinity],['dateGroupItem',0,Infinity]]);
rule('filter','val');
rule('dateGroupItem','year month day hour minute second dateTimeGrouping');
rule('customFilters','and',[['customFilter',1,2]]);rule('customFilter','operator val');
rule('top10','top percent val filterVal');rule('dynamicFilter','type val valIso maxVal maxValIso');
rule('colorFilter','dxfId cellColor');rule('iconFilter','iconSet iconId');
rule('sortState','columnSort caseSensitive sortMethod ref',[['sortCondition',1,64]]);
rule('sortCondition','descending sortBy ref customList dxfId iconSet iconId');
rule('headerFooter','differentOddEven differentFirst scaleWithDoc alignWithMargins',[['oddHeader'],['oddFooter'],['evenHeader'],['evenFooter'],['firstHeader'],['firstFooter']]);
for(const name of ['oddHeader','oddFooter','evenHeader','evenFooter','firstHeader','firstFooter'])rule(name,'',[],true);
// Required attributes in the supported subset (not a complete XSD datatype validator).
const required={
 definedName:['name'],filterColumn:['colId'],filter:['val'],customFilter:['val'],top10:['val'],dynamicFilter:['type'],colorFilter:['dxfId'],iconFilter:['iconSet'],sortState:['ref'],sortCondition:['ref'],dateGroupItem:['year','dateTimeGrouping'],
 sheet:['name','sheetId','r:id'],Relationship:['Id','Type','Target'],
 Default:['Extension','ContentType'],Override:['PartName','ContentType'],
 rFont:['val'],charset:['val'],family:['val'],sz:['val'],vertAlign:['val'],scheme:['val'],
 rPh:['sb','eb'],phoneticPr:['fontId'],sheetView:['workbookViewId'],
 col:['min','max'],dimension:['ref'],mergeCell:['ref'],sheetFormatPr:['defaultRowHeight'],
 pageMargins:['left','right','top','bottom','header','footer'],
};
export function grammar(fail){
 return {
  open(node,parent){
   const spec=specs.get(key(node.uri,node.tag));
   if(!node.uri)fail('XLSX_XML');
   if(!spec)fail('XLSX_UNSUPPORTED');
   if(parent.name){
    const entry=parent.grammar.children.get(node.tag);
    if(parent.uri!==node.uri||!entry)fail('XLSX_UNSUPPORTED');
    const count=(parent.counts.get(node.tag)||0)+1;
    if(count>entry.max)fail('XLSX_XML');
    // rPr is an unordered property set; Types is an unordered choice.
    if(!['rPr','Types'].includes(parent.tag)&&entry.rank<parent.rank)fail('XLSX_XML');
    parent.rank=entry.rank;parent.counts.set(node.tag,count);
   }else if(!['Types','Relationships','workbook','worksheet','sst'].includes(node.tag))fail('XLSX_UNSUPPORTED');
   for(const attr of Object.values(node.attributes)){
    if(attr.uri===xmlnsNS)continue;
    if(!spec.attrs.has(key(attr.uri,attr.local)))fail('XLSX_UNSUPPORTED');
    if(attr.uri===xmlNS&&attr.local==='space'&&!['preserve','default'].includes(attr.value))fail('XLSX_XML');
   }
   for(const name of required[node.tag]||[]){
    const uri=name==='r:id'?officeNS:'',local=name==='r:id'?'id':name;
    if(!Object.values(node.attributes).some(a=>a.uri===uri&&a.local===local&&a.value!==''))fail('XLSX_XML');
   }
   validateMetadata(node,fail);
   node.grammar=spec;node.counts=new Map();node.rank=-1;
  },
  close(node){
   if(!node.grammar.text&&node.text.trim())fail('XLSX_UNSUPPORTED');
   closeMetadata(node,fail);
   for(const [name,{min}]of node.grammar.children)if((node.counts.get(name)||0)<min)fail('XLSX_XML');
  }
 };
}

const bools={
 workbookProtection:'lockStructure lockWindows lockRevision',
 sheetProtection:'sheet objects scenarios formatCells formatColumns formatRows insertColumns insertRows insertHyperlinks deleteColumns deleteRows selectLockedCells sort autoFilter pivotTables selectUnlockedCells',
 definedName:'hidden function vbProcedure xlm publishToServer workbookParameter',
 filterColumn:'hiddenButton showButton',filters:'blank',customFilters:'and',top10:'top percent',
 colorFilter:'cellColor',sortState:'columnSort caseSensitive',sortCondition:'descending',
 headerFooter:'differentOddEven differentFirst scaleWithDoc alignWithMargins',
};
const enums={
 customFilter:{operator:'equal lessThan lessThanOrEqual notEqual greaterThanOrEqual greaterThan'},
 dateGroupItem:{dateTimeGrouping:'year month day hour minute second'},
 sortState:{sortMethod:'stroke pinYin'},sortCondition:{sortBy:'value cellColor fontColor icon'},
 dynamicFilter:{type:'null aboveAverage belowAverage tomorrow today yesterday nextWeek thisWeek lastWeek nextMonth thisMonth lastMonth nextQuarter thisQuarter lastQuarter nextYear thisYear lastYear yearToDate Q1 Q2 Q3 Q4 M1 M2 M3 M4 M5 M6 M7 M8 M9 M10 M11 M12'},
 filters:{calendarType:'none gregorian gregorianUs japan taiwan korea hijri thai hebrew gregorianMeFrench gregorianArabic gregorianXlitEnglish gregorianXlitFrench'},
};
function uint(value,max=4294967295){return /^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)<=max;}
function column(s){let n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n;}
export function cellRange(value){
 const m=/^\$?([A-Z]{1,3})\$?([1-9]\d*)(?::\$?([A-Z]{1,3})\$?([1-9]\d*))?$/.exec(value||'');
 if(!m)return null;
 const r=[column(m[1]),Number(m[2]),column(m[3]||m[1]),Number(m[4]||m[2])];
 return r[0]<=r[2]&&r[1]<=r[3]&&r[2]<=16384&&r[3]<=1048576?r:null;
}
function validateMetadata(n,fail){
 const a=n.attrs,bad=()=>fail('XLSX_XML');
 for(const name of (bools[n.tag]||'').split(' '))if(a[name]!==undefined&&!['0','1','true','false'].includes(a[name]))bad();
 for(const [name,values]of Object.entries(enums[n.tag]||{}))if(a[name]!==undefined&&!values.split(' ').includes(a[name]))bad();
 if(['autoFilter','sortState','sortCondition'].includes(n.tag)&&a.ref!==undefined&&!cellRange(a.ref))bad();
 if(n.tag==='filterColumn'&&!uint(a.colId,16383))bad();
 if(n.tag==='definedName'){
  if(!/^[\p{L}_\\][\p{L}\p{N}_.\\]*$/u.test(a.name)||a.name.length>255||/^(?:[A-Za-z]{1,3}[1-9]\d*|[Rr][Cc]|[Rr]|[Cc])$/.test(a.name))bad();
  for(const k of ['localSheetId','functionGroupId'])if(a[k]!==undefined&&!uint(a[k]))bad();
  // XLM/VB/function names can encode executable macro behavior.
  for(const k of ['function','vbProcedure','xlm'])if(['1','true'].includes(a[k]))fail('XLSX_MACROS');
 }
 if(['workbookProtection','sheetProtection'].includes(n.tag)){
  // Both protections describe editing metadata, never encrypted file contents.
  // Normalize their hash-group spellings for the same structural validation.
  const protection=n.tag==='sheetProtection'
   ?Object.fromEntries(Object.entries(a).filter(([k])=>['password','algorithmName','hashValue','saltValue','spinCount'].includes(k)).map(([k,v])=>['workbook'+k[0].toUpperCase()+k.slice(1),v])):a;
  for(const prefix of ['workbook','revisions']){
   const group=['AlgorithmName','HashValue','SaltValue','SpinCount'].map(k=>prefix+k);
   const present=group.filter(k=>protection[k]!==undefined).length;
   if(present&&present!==group.length)bad();
   if(present&&!['SHA-1','SHA-256','SHA-384','SHA-512'].includes(protection[prefix+'AlgorithmName']))fail('XLSX_UNSUPPORTED');
  }
  for(const [k,v]of Object.entries(protection)){
   if(k.endsWith('Password')&&!/^[0-9a-fA-F]{1,4}$/.test(v))bad();
   if(k.endsWith('SpinCount')&&!uint(v,10000000))bad();
   if(k.endsWith('HashValue')||k.endsWith('SaltValue'))if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v)||!v.length)bad();
  }
 }
 if(['top10','dynamicFilter'].includes(n.tag))for(const k of ['val','filterVal','maxVal'])if(a[k]!==undefined&&(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(a[k])||!Number.isFinite(Number(a[k]))))bad();
 if(n.tag==='top10'&&(Number(a.val)<0||(['1','true'].includes(a.percent)&&Number(a.val)>100)))bad();
 if(['colorFilter','iconFilter','sortCondition'].includes(n.tag))for(const k of ['dxfId','iconId'])if(a[k]!==undefined&&!uint(a[k]))bad();
 if(n.tag==='dateGroupItem'){
  const bounds={year:[1,9999],month:[1,12],day:[1,31],hour:[0,23],minute:[0,59],second:[0,59]};
  const fields=Object.keys(bounds),last=fields.indexOf(a.dateTimeGrouping);
  for(const [i,k]of fields.entries()){if(i<=last&&a[k]===undefined)bad();if(a[k]!==undefined&&(!uint(a[k],bounds[k][1])||Number(a[k])<bounds[k][0]))bad();}
 }
}
function containsRange(outer,inner){return inner[0]>=outer[0]&&inner[1]>=outer[1]&&inner[2]<=outer[2]&&inner[3]<=outer[3];}
function closeMetadata(n,fail){
 const bad=()=>fail('XLSX_XML');
 if(n.tag==='sortState'){
  const outer=cellRange(n.attrs.ref);
  for(const c of n.children)if(!containsRange(outer,cellRange(c.attrs.ref)))bad();
 }
 if(n.tag==='filterColumn'&&n.children.length>1)bad();
 if(n.tag==='autoFilter'){
  const range=cellRange(n.attrs.ref),seen=new Set();
  if(n.children.length&&!range)bad();
  for(const c of n.children)if(c.tag==='sortState'&&!containsRange(range,cellRange(c.attrs.ref)))bad();
  for(const c of n.children)if(c.tag==='filterColumn'){const id=Number(c.attrs.colId);if(seen.has(id)||id>=range[2]-range[0]+1)bad();seen.add(id);}
 }
 if(n.tag==='definedName'){
  if(!n.text.trim())bad();
  // Text is inert metadata, never evaluated or returned as a cell/money value.
  if(/[\[\]]/.test(n.text))fail('XLSX_EXTERNAL_LINK');
 }
}

// Validate workbook-scoped metadata only after the full sheet declaration list exists.
export function validateDefinedNames(workbook,sheets,fail){
 const names=workbook.children.find(n=>n.tag==='definedNames'),seen=new Set();
 for(const n of names?.children||[]){
  const scope=n.attrs.localSheetId===undefined?null:Number(n.attrs.localSheetId);
  if(scope!==null&&scope>=sheets.length)fail('XLSX_XML');
  const id=JSON.stringify([scope,n.attrs.name.toLowerCase()]);if(seen.has(id))fail('XLSX_XML');seen.add(id);
  if(!['_xlnm.Print_Area','_xlnm.Print_Titles','_xlnm._FilterDatabase'].includes(n.attrs.name))continue;
  // Built-in print/filter names must be sheet-qualified references, not formulas.
  // A quoted sheet may contain commas and escaped apostrophes.
  const text=n.text.trim(),re=/(?:'((?:[^']|'')+)'|([^'!,:\s]+))!([^!,]+)(?:,|$)/gy;
  let end=0,match;
  while((match=re.exec(text))){
   const sheet=(match[1]?.replaceAll("''", "'")??match[2]);
   const index=sheets.findIndex(s=>s.attrs.name===sheet);
   if(index<0||(scope!==null&&index!==scope))fail('XLSX_XML');
   const ref=match[3];let valid=cellRange(ref)!==null;
   if(n.attrs.name==='_xlnm.Print_Titles'){
    const rows=/^\$?([1-9]\d*):\$?([1-9]\d*)$/.exec(ref);
    const cols=/^\$?([A-Z]{1,3}):\$?([A-Z]{1,3})$/.exec(ref);
    valid=!!(rows&&Number(rows[1])<=Number(rows[2])&&Number(rows[2])<=1048576||cols&&column(cols[1])<=column(cols[2])&&column(cols[2])<=16384);
   }
   if(!valid)fail('XLSX_XML');end=re.lastIndex;
  }
  if(!end||end!==text.length||text.endsWith(','))fail('XLSX_XML');
 }
}
