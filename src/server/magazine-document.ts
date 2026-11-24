import {sqlConnect} from './sql-connect-store';
import {identity} from './auth';
import {readMagazinePdf} from './magazine-storage';
import {MAGAZINE_MAX_BYTES} from '@/domain/magazine-limits';
export const magazineCors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization'};
// Published editions are public: any cache may keep them but must revalidate (ETag) so a withdrawal is
// honoured on the next request. Drafts are private and never stored.
export const PUBLISHED_CACHE='public, no-cache',DRAFT_CACHE='private, no-store';
const g=globalThis as unknown as {cdirPdfInFlight?:Map<string,Promise<Buffer>>};
const inFlight=()=>g.cdirPdfInFlight??=new Map();
type Meta={magazine:{id:string;published:boolean;title:string;pdfPath:string}|null;magazineDocuments:{id:string;size:number}[];magazineCovers?:{etag:string}[]};
/**
 * Loads metadata only (no PDF payload). Access to drafts is checked here, before any 304 or byte read.
 * `bytes()` rebuilds the PDF once even when several requests ask for it at the same time.
 */
export async function magazineDocument(request:Request,id:string,options:{coverEtag?:boolean}={}){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Revista no encontrada.');
 const dc=sqlConnect(),data=(await dc.executeGraphqlRead<Meta,{id:string}>(`query PdfMeta($id: UUID!) @auth(level: NO_ACCESS) {magazine(key: {id: $id}) {id published title pdfPath} magazineDocuments(where: {magazineId: {eq: $id}},limit: 1) {id size}${options.coverEtag?' magazineCovers(where: {magazineId: {eq: $id}},limit: 1) {etag}':''}}`,{variables:{id}})).data;
 if(!data.magazine)throw Error('Revista no encontrada.');
 if(!data.magazine.published){const user=await identity(request);if(user.role!=='ADMIN')throw Error('Sin permiso.');}
 const stored=data.magazineDocuments[0],magazine=data.magazine;
 // Stored documents are immutable (insert-only, deleted with the draft): id + size identify the bytes.
 const etag=stored?'"pdf-'+stored.id+'-'+stored.size+'"':null;
 const bytes=()=>{const key=stored?.id||'ext:'+magazine.pdfPath;let work=inFlight().get(key);if(!work){work=(async()=>{
  if(!stored)return externalMagazinePdf(magazine.pdfPath);
  const row=(await dc.executeGraphqlRead<{magazineDocuments:{payload:string;size:number}[]},{id:string}>('query PdfPayload($id: UUID!) @auth(level: NO_ACCESS) {magazineDocuments(where: {id: {eq: $id}},limit: 1) {payload size}}',{variables:{id:stored.id}})).data.magazineDocuments[0];
  if(!row)throw Error('El documento no está disponible.');return readMagazinePdf(dc,row.payload,row.size);
 })().finally(()=>inFlight().delete(key));inFlight().set(key,work);}return work;};
 return {dc,magazine,etag,coverEtag:data.magazineCovers?.[0]?.etag||null,cacheControl:magazine.published?PUBLISHED_CACHE:DRAFT_CACHE,bytes};
}
export async function externalMagazinePdf(raw:string){
 let url=new URL(raw);
 for(let redirect=0;redirect<5;redirect++){
  if(url.protocol!=='https:'||!['cdir.es','www.cdir.es'].includes(url.hostname)||url.username||url.password||url.port)throw Error('El enlace de la revista no está permitido.');
  const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(60000)});
  if(r.status>=300&&r.status<400&&r.headers.get('location')){url=new URL(r.headers.get('location')!,url);continue;}
  if(!r.ok||!r.body)throw Error('No se pudo recuperar el PDF del archivo del club.');
  if(Number(r.headers.get('content-length')||0)>MAGAZINE_MAX_BYTES)throw Error('El PDF supera el tamaño permitido.');
  const reader=r.body.getReader(),parts:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAGAZINE_MAX_BYTES){await reader.cancel();throw Error('El PDF supera el tamaño permitido.');}parts.push(value);}
  const bytes=Buffer.concat(parts);if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('El archivo no es un PDF válido.');return bytes;
 }
 throw Error('No se pudo recuperar el PDF.');
}
