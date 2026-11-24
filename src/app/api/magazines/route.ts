import {deleteMagazineDraft} from '@/server/magazine-delete';
import {identity} from '@/server/auth';
import {sameOrigin} from '@/server/mode';
import {failure,boundedJson} from '@/server/http';
import {sqlConnect} from '@/server/sql-connect-store';
import {saveMagazinePdf} from '@/server/magazine-storage';
import {MAGAZINE_MAX_BYTES,MAGAZINE_BODY_BYTES} from '@/domain/magazine-limits';
export const runtime='nodejs';
export async function POST(request:Request){try{
 sameOrigin(request);const user=await identity(request);if(user.role!=='ADMIN')throw Error('Sin permiso para subir revistas.');
 if(Number(request.headers.get('content-length')||0)>MAGAZINE_BODY_BYTES)throw Error('El PDF debe ocupar como máximo 50 MB.');
 const reader=request.body?.getReader();if(!reader)throw Error('Adjunta un PDF.');const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAGAZINE_BODY_BYTES){await reader.cancel();throw Error('El PDF debe ocupar como máximo 50 MB.');}chunks.push(value);}
 const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData(),file=form.get('file'),title=String(form.get('title')||'').trim(),description=String(form.get('description')||'').trim();
 if(title.length<2||title.length>200||description.length>3000||!(file instanceof File)||file.size>MAGAZINE_MAX_BYTES||!file.size)throw Error('Revisa el título y el PDF (máximo 50 MB).');
 const bytes=Buffer.from(await file.arrayBuffer());if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('El archivo no es un PDF válido.');
 const id=await saveMagazinePdf(sqlConnect(),user,bytes,title,description);
 return Response.json({id},{status:201});
 }catch(e){return failure(e);}}

export async function DELETE(request:Request){try{sameOrigin(request);const user=await identity(request),body=await boundedJson(request);await deleteMagazineDraft(sqlConnect(),user,String(body.id||''));return Response.json({deleted:true},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
