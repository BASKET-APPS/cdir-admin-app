import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {demoState} from '@/domain/seed';
import {workspacePageQuery,markOmittedAvatars,changedRows,OMITTED_AVATAR} from '@/domain/sql-connect';
// Synthetic data only. The fake SQL Connect client records every GraphQL operation.
const db=vi.hoisted(()=>({queries:[] as string[],role:'ADMIN',published:true,cover:'abc' as string|null,payload:Buffer.from('%PDF-1.7 sintético').toString('base64')}));
vi.mock('@/server/firebase',()=>({adminApp:()=>({}),serverAuth:()=>({}),storageBucket:()=>({})}));
vi.mock('@/server/auth',()=>({identity:async()=>{if(db.role==='NONE')throw Error('Inicia sesión para continuar.');return {uid:'u',name:'Prueba',role:db.role};}}));
vi.mock('firebase-admin/data-connect',()=>({getDataConnect:()=>({
 executeGraphqlRead:async(query:string)=>{db.queries.push(query);const name=/query (\w+)/.exec(query)?.[1];
  if(name==='PdfMeta')return {data:{magazine:{id:'00000000-0000-4000-8000-000000000009',published:db.published,title:'Revista',pdfPath:'/api/public/magazines/x/pdf'},magazineDocuments:[{id:'00000000-0000-4000-8000-00000000000a',size:Buffer.from(db.payload,'base64').length}],magazineCovers:db.cover?[{etag:db.cover}]:[]}};
  if(name==='PdfPayload')return {data:{magazineDocuments:[{payload:db.payload,size:Buffer.from(db.payload,'base64').length}]}};
  if(name==='Cover')return {data:{magazineCovers:[{payload:Buffer.from('jpeg').toString('base64'),etag:db.cover}]}};
  if(name==='PublicSlice'&&query.includes('events: events'))return {data:{events:[{id:'00000000-0000-4000-8000-0000000000e1',seasonId:'00000000-0000-4000-8000-0000000000e2',title:'Campus sintético',slug:'campus',kind:'Campus',description:'x',location:'x',startsAt:'2030-01-01T10:00:00.000Z',endsAt:'2030-01-01T12:00:00.000Z',capacity:10,price:0,status:'PUBLISHED',registrationOpen:true,formId:'00000000-0000-4000-8000-0000000000f1',imageUrl:''}]}};
  return {data:{}};},
 executeGraphql:async(query:string)=>{db.queries.push(query);return {data:{}};},
})}));
import {readPublicSlice} from '@/server/public-data';
import {GET as pdfGet} from '@/app/api/public/magazines/[id]/pdf/route';
import {GET as coverGet} from '@/app/api/public/magazines/[id]/cover/route';
const id='00000000-0000-4000-8000-000000000009',params={params:Promise.resolve({id})};
const req=(path:string,headers:Record<string,string>={})=>new Request('http://127.0.0.1:3002/api/public/magazines/'+id+path,{headers});
beforeEach(()=>{db.queries=[];db.role='ADMIN';db.published=true;db.cover='abc';vi.stubEnv('CDIR_DATABASE','sql-connect');vi.stubEnv('FIREBASE_PROJECT_ID','cdir-apps');});
afterEach(()=>vi.unstubAllEnvs());

it('las lecturas de solo consulta no transfieren la imagen de perfil y no pueden guardarse',()=>{
 expect(workspacePageQuery(0)).toMatch(/profiles: profiles\([^)]*\) \{[^}]*avatarPath/);
 expect(workspacePageQuery(0,500,{omitAvatarPayload:true})).not.toMatch(/profiles: profiles\([^)]*\) \{[^}]*avatarPath/);
 const s=demoState();s.profiles=[{id:'p',uid:s.members[0].uid,googlePhotoUrl:null,avatarPath:null,avatarVersion:'v1',avatarSource:'UPLOAD',googleSyncedAt:null,updatedAt:'2026-01-01T00:00:00.000Z'}];
 const before=structuredClone(s);markOmittedAvatars(s);expect(s.profiles[0].avatarPath).toBe(OMITTED_AVATAR);
 s.profiles[0].updatedAt='2026-02-01T00:00:00.000Z';expect(()=>changedRows(before,s)).toThrow();
});
it('el feed público solo consulta tablas y campos públicos',async()=>{
 await readPublicSlice(['events','matches','magazines','activities'],{registration:false});
 expect(db.queries).toHaveLength(1);const q=db.queries[0];
 for(const hidden of ['players','guardians','bankAccounts','members','audit','applications','invoices','profiles','files','forms'])expect(q).not.toContain(hidden+':');
 expect(q).toContain('published: {eq: true}');expect(q).toContain('status: {eq: "PUBLISHED"}');
});
it('con inscripción activa solo cuenta solicitudes confirmadas, sin datos personales',async()=>{
 await readPublicSlice(['events'],{registration:true});
 expect(db.queries).toHaveLength(2);expect(db.queries[1]).toContain('applications: applications(where: {eventId: {in: $events}, status: {eq: "CONFIRMED"}}');
 expect(db.queries.join('\n')).not.toMatch(/email|phone|birthDate|answers/);
});
it('PDF publicado: caché pública revalidable y 304 sin leer el contenido',async()=>{
 const first=await pdfGet(req('/pdf'),params);expect(first.status).toBe(200);expect(first.headers.get('cache-control')).toBe('public, no-cache');
 const etag=first.headers.get('etag')!;expect(etag).toMatch(/^"pdf-/);expect(db.queries.some(q=>q.includes('PdfPayload'))).toBe(true);
 db.queries=[];const second=await pdfGet(req('/pdf',{'if-none-match':etag}),params);expect(second.status).toBe(304);
 expect(db.queries).toHaveLength(1);expect(db.queries[0]).not.toContain('payload');
});
it('borrador: privado, sin caché y sin 304 para quien no es administrador',async()=>{
 db.published=false;const r=await pdfGet(req('/pdf'),params);expect(r.headers.get('cache-control')).toBe('private, no-store');const etag=r.headers.get('etag')!;
 db.role='COACH';expect((await pdfGet(req('/pdf',{'if-none-match':etag}),params)).status).toBe(403);
 db.role='NONE';expect((await pdfGet(req('/pdf',{'if-none-match':etag}),params)).status).toBe(401);
});
it('retirar una revista invalida la copia guardada en la siguiente revalidación',async()=>{
 const etag=(await pdfGet(req('/pdf'),params)).headers.get('etag')!;db.published=false;db.role='NONE';
 expect((await pdfGet(req('/pdf',{'if-none-match':etag}),params)).status).toBe(401);
});
it('portada guardada: 304 sin descargar imagen ni PDF',async()=>{
 const r=await coverGet(req('/cover',{'if-none-match':'"abc"'}),params);expect(r.status).toBe(304);
 expect(db.queries.join('\n')).not.toMatch(/payload/);
 db.queries=[];const full=await coverGet(req('/cover'),params);expect(full.status).toBe(200);expect(full.headers.get('etag')).toBe('"abc"');
 expect(db.queries.some(q=>q.includes('PdfPayload'))).toBe(false);
});
it('dos peticiones simultáneas del mismo PDF lo reconstruyen una sola vez',async()=>{
 await Promise.all([pdfGet(req('/pdf'),params),pdfGet(req('/pdf'),params)]);
 expect(db.queries.filter(q=>q.includes('PdfPayload'))).toHaveLength(1);
});
