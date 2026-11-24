import {createHash} from 'node:crypto';
import {magazineDocument,magazineCors} from '@/server/magazine-document';
import {renderMagazineCover} from '@/server/magazine-cover';
import {notModified} from '@/server/public-cache';
import {failure} from '@/server/http';
export const runtime='nodejs';
const pending=new Map<string,Promise<Buffer>>();
// The cover is rendered once, stored in magazine_covers and reused. Its ETag is read with the metadata,
// so a revalidation (304) does not transfer the image or the PDF from the database.
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params,document=await magazineDocument(request,id,{coverEtag:true}),{dc}=document;
 const base={...magazineCors,'Cache-Control':document.cacheControl,'X-Content-Type-Options':'nosniff'};
 if(document.coverEtag&&notModified(request,'"'+document.coverEtag+'"'))return new Response(null,{status:304,headers:{...base,ETag:'"'+document.coverEtag+'"'}});
 const cached=document.coverEtag?(await dc.executeGraphqlRead<{magazineCovers:{payload:string;etag:string}[]},{id:string}>('query Cover($id: UUID!) @auth(level: NO_ACCESS) {magazineCovers(where: {magazineId: {eq: $id}},limit: 1) {payload etag}}',{variables:{id}})).data.magazineCovers[0]:undefined;
 let bytes:Buffer,etag:string;
 if(cached){bytes=Buffer.from(cached.payload,'base64');etag=cached.etag;}else{
  let work=pending.get(id);if(!work){work=(async()=>{const image=await renderMagazineCover(await document.bytes());try{await dc.executeGraphql('mutation Cover($data: MagazineCover_Data!) @auth(level: NO_ACCESS) {magazineCover_upsert(data: $data)}',{variables:{data:{id,magazineId:id,payload:image.toString('base64'),etag:createHash('sha256').update(image).digest('hex')}}});}finally{pending.delete(id);}return image;})();pending.set(id,work);work.catch(()=>pending.delete(id));}
  bytes=await work;etag=createHash('sha256').update(bytes).digest('hex');
 }
 return new Response(new Uint8Array(bytes),{headers:{...base,'Content-Type':'image/jpeg','Content-Length':String(bytes.length),'ETag':'"'+etag+'"'}});
}catch(e){const response=failure(e);Object.entries(magazineCors).forEach(([k,v])=>response.headers.set(k,v));return response;}}
export function OPTIONS(){return new Response(null,{status:204,headers:magazineCors});}
