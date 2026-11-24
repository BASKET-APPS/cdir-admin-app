// SIMULADOR (mock) de Firebase SQL Connect para pruebas y mediciones locales.
// Evalúa en memoria las consultas y mutaciones GraphQL que genera este proyecto (listas con where/limit/
// offset/orderBy, filtros por relación según dataconnect/schema, upsertMany/insertMany/updateMany con
// @check y @transaction) y cuenta operaciones y bytes. NO reproduce el planificador, la latencia ni los
// límites del servicio real: sus cifras son de volumen, no de rendimiento de Cloud SQL.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import contract from '../../src/generated/sql-connect-contract.json';
import type {State} from '../../src/domain/types';

type Row=Record<string,unknown>;type Value=unknown;
type Field={alias:string;name:string;args:Record<string,Value>;directives:{name:string;args:Record<string,Value>}[];selections:Field[]};
type C=Record<string,{type:string;singular:string;plural:string;fields:Record<string,string>}>;
const entities=contract as C;

// ---------- tiny GraphQL parser (subset used by the app) ----------
function tokenize(src:string){const t:string[]=[];const re=/\s*(?:(#[^\n]*)|("(?:[^"\\]|\\.)*")|(\.\.\.)|([{}()[\]:,!@$=])|(-?\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*))/y;let m;re.lastIndex=0;while(re.lastIndex<src.length){const start=re.lastIndex;m=re.exec(src);if(!m){if(/^\s*$/.test(src.slice(start)))break;throw Error('GraphQL no reconocido: '+src.slice(start,start+40));}if(m[1])continue;t.push(m[2]||m[3]||m[4]||m[5]||m[6]);}return t;}
function parse(src:string,variables:Record<string,Value>){
 const t=tokenize(src);let i=0;const peek=()=>t[i],eat=(x?:string)=>{const v=t[i++];if(x&&v!==x)throw Error(`Se esperaba ${x} y llegó ${v}`);return v;};
 const value=():Value=>{const v=peek();if(v==='$'){eat();return variables[eat()];}if(v==='['){eat();const out=[];while(peek()!==']'){out.push(value());if(peek()===',')eat();}eat(']');return out;}if(v==='{'){eat();const o:Record<string,Value>={};while(peek()!=='}'){const k=eat();eat(':');o[k]=value();if(peek()===',')eat();}eat('}');return o;}eat();if(v.startsWith('"'))return JSON.parse(v);if(/^-?\d/.test(v))return Number(v);if(v==='true')return true;if(v==='false')return false;if(v==='null')return null;return v;};
 const args=()=>{const o:Record<string,Value>={};if(peek()!=='(')return o;eat('(');while(peek()!==')'){const k=eat();eat(':');o[k]=value();if(peek()===',')eat();}eat(')');return o;};
 const directives=()=>{const d=[];while(peek()==='@'){eat();const name=eat();d.push({name,args:args()});}return d;};
 const selections=():Field[]=>{const out:Field[]=[];if(peek()!=='{')return out;eat('{');while(peek()!=='}'){let alias=eat(),name=alias;if(peek()===':'){eat();name=eat();}const a=args(),d=directives();out.push({alias,name,args:a,directives:d,selections:selections()});if(peek()===',')eat();}eat('}');return out;};
 const kind=eat();if(kind!=='query'&&kind!=='mutation')throw Error('Operación no soportada: '+kind);if(peek()!=='{'&&peek()!=='('&&peek()!=='@')eat();
 if(peek()==='('){let depth=0;do{const x=eat();if(x==='(')depth++;if(x===')')depth--;}while(depth>0);}
 const opDirectives=directives();return {kind,directives:opDirectives,selections:selections()};
}

// Enforce SQL Connect's filter syntax, including filters inside relations.
function validateFilter(value:unknown):void{
 if(!value||typeof value!=='object')return;
 if(Array.isArray(value)){value.forEach(validateFilter);return;}
 const entries=Object.entries(value),logical=entries.some(([k])=>['_and','_or','_not'].includes(k));
 if(logical&&entries.some(([k])=>!['_and','_or','_not'].includes(k)))throw Error('cannot mix _and/_or/_not with specific fields');
 entries.forEach(([,v])=>validateFilter(v));
}

// ---------- schema relations ----------
type Ref={type:string;fields:string[];references:string[]};
function relations(){const src=readFileSync(path.resolve(__dirname,'../../dataconnect/schema/schema.gql'),'utf8');const out:Record<string,Record<string,Ref>>={};let current='';for(const line of src.split('\n')){const t=/^type (\w+) @table/.exec(line);if(t){current=t[1];out[current]={};}const inline=[...line.matchAll(/(\w+): (\w+)!? @ref\(fields: \[([^\]]+)\], references: \[([^\]]+)\]\)/g)];for(const m of inline){const typeName=/^type (\w+)/.exec(line)?.[1]||current;(out[typeName]??={})[m[1]]={type:m[2],fields:m[3].split(',').map(x=>x.trim().replace(/"/g,'')),references:m[4].split(',').map(x=>x.trim().replace(/"/g,''))};}}return out;}
const refs=relations();
// @unique(fields: [...]) per type, enforced after every mutation like the database would.
const uniques:Record<string,string[][]>={};for(const line of readFileSync(path.resolve(__dirname,'../../dataconnect/schema/schema.gql'),'utf8').split('\n')){const t=/^type (\w+) @table/.exec(line);if(t)uniques[t[1]]=[...line.matchAll(/@unique\(fields: \[([^\]]+)\]\)/g)].map(m=>m[1].split(',').map(x=>x.trim().replace(/"/g,'')));}

export type Metrics={reads:number;mutations:number;bytesOut:number;bytesIn:number;operations:string[];fakeMs:number};
export class FakeSqlConnect{
 tables:Record<string,Row[]>={};revision=1;metrics:Metrics={reads:0,mutations:0,bytesOut:0,bytesIn:0,operations:[],fakeMs:0};
 /** Called before every operation; tests use it to inject a concurrent change. */
 beforeOperation?:(kind:'read'|'mutation',query:string)=>void|Promise<void>;
 constructor(state:State){for(const [key,c] of Object.entries(entities))this.tables[c.type]=structuredClone((state as unknown as Record<string,Row[]>)[key]||[]);}
 reset(){this.metrics={reads:0,mutations:0,bytesOut:0,bytesIn:0,operations:[],fakeMs:0};}
 state():State{const out:Record<string,Row[]>={};for(const [key,c] of Object.entries(entities))out[key]=structuredClone(this.tables[c.type]);return out as unknown as State;}
 private typeFor(rootName:string):{type:string;key?:string}|null{for(const [key,c] of Object.entries(entities)){if(c.plural===rootName||c.singular===rootName)return {type:c.type,key};}if(rootName==='workspaceRevision')return {type:'WorkspaceRevision'};const known:Record<string,string>={magazineDocuments:'MagazineDocument',magazinePdfParts:'MagazinePdfPart',magazineCovers:'MagazineCover'};return known[rootName]?{type:known[rootName]}:null;}
 private rows(type:string){if(type==='WorkspaceRevision')return [{id:'club',version:this.revision}];return this.tables[type]??=[];}
 private match(type:string,row:Row,where:Record<string,Value>|undefined):boolean{if(!where)return true;return Object.entries(where).every(([k,cond])=>{
  if(k==='_or')return (cond as Record<string,Value>[]).some(w=>this.match(type,row,w));if(k==='_and')return (cond as Record<string,Value>[]).every(w=>this.match(type,row,w));if(k==='_not')return !this.match(type,row,cond as Record<string,Value>);
  const ref=refs[type]?.[k];if(ref){const targets=this.lookup(ref).get(JSON.stringify(ref.fields.map(f=>row[f])))||[];return targets.some(t=>this.match(ref.type,t,cond as Record<string,Value>));}
  const v=row[k],c=cond as Record<string,Value>;return Object.entries(c).every(([op,x])=>{switch(op){case 'eq':return v===x;case 'ne':return v!==x;case 'in':return (x as Value[]).includes(v);case 'nin':return !(x as Value[]).includes(v);case 'isNull':return (v===null||v===undefined)===x;case 'startsWith':return typeof v==='string'&&v.startsWith(String(x));case 'gt':return String(v)>String(x);case 'ge':return String(v)>=String(x);case 'lt':return String(v)<String(x);case 'le':return String(v)<=String(x);case 'includes':return Array.isArray(v)&&v.includes(x);default:throw Error('Filtro no soportado: '+op);}});});}
 private indexes=new Map<string,Map<string,Row[]>>();
 /** Rows of the referenced table grouped by the referenced key (rebuilt for every operation). */
 private lookup(ref:Ref){const id=ref.type+':'+ref.references.join(',');let ix=this.indexes.get(id);if(!ix){ix=new Map();for(const t of this.rows(ref.type)){const k=JSON.stringify(ref.references.map(r=>t[r]));const list=ix.get(k);if(list)list.push(t);else ix.set(k,[t]);}this.indexes.set(id,ix);}return ix;}
 private list(f:Field,type:string){validateFilter(f.args.where);let rows=this.rows(type).filter(r=>this.match(type,r,f.args.where as Record<string,Value>));const order=f.args.orderBy as Record<string,string>|Record<string,string>[]|undefined;const orders=order?(Array.isArray(order)?order:[order]):[];if(orders.length)rows=[...rows].sort((a,b)=>{for(const o of orders)for(const [k,d] of Object.entries(o)){const x=a[k]??'',y=b[k]??'';if(x!==y)return (typeof x==='number'&&typeof y==='number'?x-y:String(x)<String(y)?-1:1)*(d==='DESC'?-1:1);}return 0;});const offset=Number(f.args.offset||0),limit=f.args.limit===undefined?100:Number(f.args.limit);return rows.slice(offset,offset+limit).map(r=>this.project(r,f));}
 private project(r:Row,f:Field){return Object.fromEntries(f.selections.map(s=>[s.alias,r[s.name]??null]));}
 private resolve(f:Field){const target=this.typeFor(f.name);if(!target)throw Error('Raíz no soportada en el simulador: '+f.name);if(f.args.key){const key=f.args.key as Row;const row=this.rows(target.type).find(r=>Object.entries(key).every(([k,v])=>r[k]===v));return row?this.project(row,f):null;}return this.list(f,target.type);}
 async executeGraphqlRead<T=unknown,V=unknown>(query:string,options?:{variables?:V}):Promise<{data:T}>{await this.beforeOperation?.('read',query);const t0=performance.now();this.indexes.clear();try{const op=parse(query,(options?.variables||{}) as Record<string,Value>);if(op.kind!=='query')throw Error('executeGraphqlRead solo admite consultas.');const data:Record<string,Value>={};for(const f of op.selections)data[f.alias]=this.resolve(f);this.metrics.reads++;this.metrics.bytesIn+=query.length+JSON.stringify(options?.variables||{}).length;const out=JSON.stringify({data});this.metrics.bytesOut+=out.length;this.metrics.operations.push('R '+(/query (\w+)/.exec(query)?.[1]||'?'));return JSON.parse(out);}finally{this.metrics.fakeMs+=performance.now()-t0;}}
 async executeGraphql<T=unknown,V=unknown>(query:string,options?:{variables?:V}):Promise<{data:T}>{await this.beforeOperation?.('mutation',query);const t0=performance.now();this.indexes.clear();try{const op=parse(query,(options?.variables||{}) as Record<string,Value>);if(op.kind==='query')return this.executeGraphqlRead(query,options);
  const backup=structuredClone(this.tables),revision=this.revision,data:Record<string,Value>={};
  try{for(const f of op.selections)data[f.alias]=this.mutate(f);}catch(e){this.tables=backup;this.revision=revision;throw e;}
  this.metrics.mutations++;this.metrics.bytesIn+=query.length+JSON.stringify(options?.variables||{}).length;const out=JSON.stringify({data});this.metrics.bytesOut+=out.length;this.metrics.operations.push('M '+(/mutation (\w+)/.exec(query)?.[1]||'?'));return {data:data as T};}finally{this.metrics.fakeMs+=performance.now()-t0;}}
 private check(f:Field,result:Value){for(const d of f.directives)if(d.name==='check'){const expr=String(d.args.expr);const ok=expr==='this == 1'?result===1:expr==='this != null'?result!==null:expr==='this == false'?result===false:true;if(!ok)throw Error(String(d.args.message||'check failed'));}}
 private mutate(f:Field):Value{
  const m=/^(\w+)_(upsertMany|insertMany|updateMany|upsert|insert|deleteMany)$/.exec(f.name);if(!m)throw Error('Mutación no soportada: '+f.name);
  const [,singular,kind]=m;const type=singular==='workspaceRevision'?'WorkspaceRevision':Object.values(entities).find(c=>c.singular===singular)?.type||({magazineCover:'MagazineCover',magazine:'Magazine',magazineDocument:'MagazineDocument',magazinePdfPart:'MagazinePdfPart',audit:'Audit'} as Record<string,string>)[singular];if(!type)throw Error('Tipo desconocido: '+singular);
  let result:Value;
  if(type==='WorkspaceRevision'){if(kind!=='updateMany')throw Error('Revisión: solo updateMany');const ok=this.match(type,{id:'club',version:this.revision},f.args.where as Record<string,Value>);if(ok)this.revision=Number((f.args.data as Row).version);result=ok?1:0;}
  else if(kind==='updateMany'){const rows=this.rows(type).filter(r=>this.match(type,r,f.args.where as Record<string,Value>));for(const r of rows)Object.assign(r,f.args.data as Row);result=rows.length;}
  else if(kind==='deleteMany'){const all=this.rows(type),keep=all.filter(r=>!this.match(type,r,f.args.where as Record<string,Value>));result=all.length-keep.length;this.tables[type]=keep;}
  else{const data=(Array.isArray(f.args.data)?f.args.data:[f.args.data]) as Row[];const table=this.rows(type);for(const row of data){const i=table.findIndex(r=>r.id===row.id);if(i>=0){if(kind.startsWith('insert'))throw Error('Clave duplicada en '+type);table[i]={...table[i],...row};}else table.push({...row});}result=data.length;}
  for(const fields of uniques[type]||[]){const seen=new Set<string>();for(const r of this.rows(type)){const k=JSON.stringify(fields.map(x=>r[x]));if(seen.has(k))throw Error('duplicate key value violates unique constraint ('+type+': '+fields.join(',')+')');seen.add(k);}}
  this.check(f,result);return result;
 }
}
