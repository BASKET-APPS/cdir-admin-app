import {magazineDocument,magazineCors} from '@/server/magazine-document';
import {notModified} from '@/server/public-cache';
import {failure} from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params,document=await magazineDocument(request,id),validators:Record<string,string>=document.etag?{ETag:document.etag}:{};
 const common:Record<string,string>={...magazineCors,...validators,'Cache-Control':document.cacheControl,'X-Content-Type-Options':'nosniff'};
 // The access check already ran in magazineDocument(): a 304 never bypasses draft protection.
 if(document.etag&&notModified(request,document.etag))return new Response(null,{status:304,headers:common});
 const bytes=await document.bytes();
 return new Response(new Uint8Array(bytes),{headers:{...common,'Content-Type':'application/pdf','Content-Length':String(bytes.length),'Content-Disposition':"inline; filename=revista-cdir.pdf; filename*=UTF-8''"+encodeURIComponent(document.magazine.title.replace(/\.pdf$/i,'')+'.pdf'),'Content-Security-Policy':'sandbox'}});
}catch(e){const response=failure(e);Object.entries(magazineCors).forEach(([k,v])=>response.headers.set(k,v));return response;}}
export function OPTIONS(){return new Response(null,{status:204,headers:magazineCors});}
