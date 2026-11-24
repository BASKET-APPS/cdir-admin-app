import {randomUUID} from 'node:crypto';
import type {DataConnect} from 'firebase-admin/data-connect';
import type {Identity} from '@/domain/types';
export async function deleteMagazineDraft(dc:DataConnect,user:Pick<Identity,'uid'|'name'|'role'>,id:string){
 if(user.role!=='ADMIN')throw Error('Sin permiso para borrar revistas.');
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Revista no válida.');
 const data=(await dc.executeGraphqlRead<{magazine:{published:boolean;title:string}|null;magazineDocuments:{payload:string}[];workspaceRevision:{version:number}},{id:string}>('query Draft($id: UUID!) @auth(level: NO_ACCESS) {magazine(key: {id: $id}) {published title} magazineDocuments(where: {magazineId: {eq: $id}},limit: 1) {payload} workspaceRevision(key: {id: "club"}) {version}}',{variables:{id}})).data;
 if(!data.magazine)throw Error('Revista no encontrada.');if(data.magazine.published)throw Error('Retira primero la revista de la web pública para poder borrarla.');
 let uploadId:string|null=null;const payload=data.magazineDocuments[0]?.payload;if(payload?.startsWith('{')){const manifest=JSON.parse(payload);if(manifest.format==='cdir-pdf-parts-v1'&&/^[0-9a-f-]{36}$/.test(manifest.uploadId))uploadId=manifest.uploadId;}
 const partDefinition=uploadId?', $uploadId: UUID!':'',partDelete=uploadId?'magazinePdfPart_deleteMany(where: {uploadId: {eq: $uploadId}})':'';
 await dc.executeGraphql(`mutation DeleteDraft($id: UUID!, $v: Int!, $next: Int!, $audit: Audit_Data!${partDefinition}) @auth(level: NO_ACCESS) @transaction {
  lock: workspaceRevision_updateMany(where: {id: {eq: "club"}, version: {eq: $v}},data: {version: $next}) @check(expr: "this == 1",message: "Otra persona ha modificado el club. Recarga antes de borrar.")
  query { draft: magazine(key: {id: $id}) @check(expr: "this != null",message: "Revista no encontrada.") { published @check(expr: "this == false",message: "Solo se pueden borrar borradores.") } }
  magazineCover_deleteMany(where: {magazineId: {eq: $id}})
  magazineDocument_deleteMany(where: {magazineId: {eq: $id}})
  ${partDelete}
  magazine_deleteMany(where: {id: {eq: $id}, published: {eq: false}}) @check(expr: "this == 1",message: "Solo se pueden borrar borradores.")
  audit_insert(data: $audit)
 }`,{variables:{id,v:data.workspaceRevision.version,next:data.workspaceRevision.version+1,...(uploadId?{uploadId}:{}),audit:{id:randomUUID(),at:new Date().toISOString(),actor:user.name,actorUid:user.uid,action:'magazine.delete',detail:'Borrador y PDF eliminados: '+data.magazine.title}}});
}
