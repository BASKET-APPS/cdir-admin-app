import {execute} from '@/domain/commands';
import {visibleState} from '@/domain/permissions';
import {coachIdentity} from '@/domain/people';
import {requestCandidates} from '@/domain/request-candidates';
import {physicalCalendarStatus} from '@/domain/calendar-status';
import {publicFeed,PUBLIC_SECTIONS} from '@/domain/public-feed';
import type {State} from '@/domain/types';
const base='/cdir-admin-app',key='cdir-pages-state-v1';
let state:State|null=null,loading:Promise<State>|null=null;
async function data(){if(state)return state;if(!loading)loading=(async()=>{try{const saved=localStorage.getItem(key);if(saved)return state=JSON.parse(saved) as State;}catch{}return state=await (await globalThis.fetch(base+'/demo/club.json')).json() as State;})();return loading;}
function user(s:State){const role=localStorage.getItem('cdir-pages-role')||'ADMIN';return coachIdentity(s,s.members.find(m=>m.role===role)??s.members[0]);}
function save(s:State){try{localStorage.setItem(key,JSON.stringify(s));localStorage.setItem('cdir-demo-public-feed-v1',JSON.stringify(publicFeed(s,[...PUBLIC_SECTIONS],false)));}catch{throw Error('La demo ha llenado el almacenamiento de este navegador. Restablécela para continuar.');}}
const json=(value:unknown,status=200)=>Response.json(value,{status});
export async function demoFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);
 if(!url.pathname.startsWith('/api/'))return globalThis.fetch(input,init);
 try{const s=await data(),u=user(s),path=url.pathname,body=typeof init?.body==='string'?JSON.parse(init.body):{},method=init?.method||'GET';
 if(path==='/api/session')return json({mode:'demo',user:method==='DELETE'?null:u});
 if(path==='/api/workspace'){
  if(method==='POST'){const draft=structuredClone(s);execute(draft,u,body.action,body.payload);save(draft);state=draft;}
  const current=state!,seasonId=body.seasonId||url.searchParams.get('seasonId')||current.seasons.find(x=>x.current)?.id;
  return json({mode:'demo',user:user(current),state:visibleState(current,user(current)),seasonId,revision:Date.now(),auditHasMore:false});
 }
 if(path==='/api/requests/candidates')return json({players:requestCandidates(s,u,Object.fromEntries(url.searchParams) as Parameters<typeof requestCandidates>[2])});
 if(path==='/api/calendar-status')return json(physicalCalendarStatus(s.supportSessions,url.searchParams.get('seasonId')||''));
 if(path==='/api/audit')return json({rows:[],hasMore:false});
 if(path==='/api/profile')return json({user:u});
 const magazine=path.match(/^\/api\/public\/magazines\/([^/]+)\/(pdf|cover)$/);
 if(magazine){const m=s.magazines.find(x=>x.id===magazine[1]);if(!m)return json({message:'Revista no encontrada'},404);return globalThis.fetch(magazine[2]==='cover'?base+'/logo.png':m.pdfPath);}
 if(path==='/api/magazines'&&method==='DELETE'){s.magazines=s.magazines.filter(x=>x.id!==body.id);save(s);return json({ok:true});}
 if(path==='/api/public/club')return json(publicFeed(s,[...PUBLIC_SECTIONS],false));
 if(path==='/api/magazines'&&method==='POST'&&init?.body instanceof FormData){const form=init.body;const file=form.get('file');if(!(file instanceof File))throw Error('Selecciona un PDF.');if(file.size>2*1024*1024)throw Error('En esta demo el PDF debe ocupar como máximo 2 MB.');const pdf=await new Promise<string>((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=fail;r.readAsDataURL(file)});s.magazines.push({id:crypto.randomUUID(),title:String(form.get('title')),description:String(form.get('description')||''),pdfPath:pdf,published:false,publishedAt:null,isExample:true});save(s);return json({ok:true});}
 return json({message:'Esta operación necesita el servidor de producción. La demo no envía datos reales ni modifica Firebase.'},400);
 }catch(e){return json({message:e instanceof Error?e.message:'No se ha podido completar la demostración.'},400);}
}
