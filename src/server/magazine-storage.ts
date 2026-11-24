import {randomUUID,createHash} from 'node:crypto';
import type {DataConnect} from 'firebase-admin/data-connect';
import type {Identity} from '@/domain/types';
import {MAGAZINE_MAX_BYTES,MAGAZINE_PART_BYTES} from '@/domain/magazine-limits';
export type PdfManifest={format:'cdir-pdf-parts-v1';uploadId:string;parts:number;sha256:string};
export async function saveMagazinePdf(dc:DataConnect,user:Pick<Identity,'uid'|'name'|'role'>,bytes:Buffer,title:string,description:string,chunked=true){
 if(user.role!=='ADMIN')throw Error('Sin permiso para subir revistas.');
 if(!bytes.length||bytes.length>MAGAZINE_MAX_BYTES)throw Error('El PDF debe ocupar como máximo 50 MB.');
 if(title.length<2||title.length>200||description.length>3000)throw Error('Revisa el título y la descripción.');
 if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('El archivo no es un PDF válido.');
 const id=randomUUID(),uploadId=randomUUID();let payload:string;
 if(!chunked&&bytes.length>2*1024*1024)throw Error('La ampliación de tamaño está pendiente de activar en Firebase.');
 if(chunked&&bytes.length>MAGAZINE_PART_BYTES){
  const parts=Math.ceil(bytes.length/MAGAZINE_PART_BYTES);
  for(let offset=0;offset<parts;offset+=2){const data=[];for(let ordinal=offset;ordinal<Math.min(offset+2,parts);ordinal++)data.push({id:randomUUID(),uploadId,ordinal,payload:bytes.subarray(ordinal*MAGAZINE_PART_BYTES,(ordinal+1)*MAGAZINE_PART_BYTES).toString('base64')});await dc.executeGraphql('mutation PdfParts($p: [MagazinePdfPart_Data!]!) @auth(level: NO_ACCESS) @transaction { magazinePdfPart_insertMany(data: $p) }',{variables:{p:data}});}
  payload=JSON.stringify({format:'cdir-pdf-parts-v1',uploadId,parts,sha256:createHash('sha256').update(bytes).digest('hex')} satisfies PdfManifest);
 }else payload=bytes.toString('base64');
 // Only expose a complete document. Retry revision conflicts without re-uploading parts.
 for(let attempt=0;attempt<3;attempt++){
  const revision=(await dc.executeGraphqlRead<{workspaceRevision:{version:number}},undefined>('query R @auth(level: NO_ACCESS) {workspaceRevision(key: {id: "club"}) {version}}')).data.workspaceRevision.version;
  try{await dc.executeGraphql('mutation Upload($m: Magazine_Data!, $d: MagazineDocument_Data!, $a: Audit_Data!, $v: Int!, $n: Int!) @auth(level: NO_ACCESS) @transaction { lock: workspaceRevision_updateMany(where: {id: {eq: "club"}, version: {eq: $v}},data: {version: $n}) @check(expr: "this == 1",message: "CDIR_CONCURRENT_CHANGE") magazine_insert(data: $m) magazineDocument_insert(data: $d) audit_insert(data: $a) }',{variables:{v:revision,n:revision+1,m:{id,title,description,pdfPath:'/api/public/magazines/'+id+'/pdf',publishedAt:null,published:false,isExample:false},d:{id:randomUUID(),magazineId:id,payload,size:bytes.length},a:{id:randomUUID(),at:new Date().toISOString(),actor:user.name,actorUid:user.uid,action:'magazine.upload',detail:'Revista PDF guardada como borrador'}}});return id;}catch(e){if(attempt===2||!String(e).includes('CDIR_CONCURRENT_CHANGE'))throw e;}
 }
 throw Error('No se pudo guardar la revista. Vuelve a intentarlo.');
}
export async function readMagazinePdf(dc:DataConnect,payload:string,size:number){
 if(size<1||size>MAGAZINE_MAX_BYTES)throw Error('El documento no está disponible.');
 if(!payload.startsWith('{')){const bytes=Buffer.from(payload,'base64');if(bytes.length!==size)throw Error('El documento está incompleto.');return bytes;}
 const manifest=JSON.parse(payload) as PdfManifest;
 if(manifest.format!=='cdir-pdf-parts-v1'||!/^[0-9a-f-]{36}$/.test(manifest.uploadId)||manifest.parts!==Math.ceil(size/MAGAZINE_PART_BYTES)||!/^[0-9a-f]{64}$/.test(manifest.sha256))throw Error('El documento no está disponible.');
 const buffers:Buffer[]=[];
 for(let offset=0;offset<manifest.parts;offset+=2){const rows=(await dc.executeGraphqlRead<{magazinePdfParts:{ordinal:number;payload:string}[]},{id:string;offset:number}>('query PdfParts($id: UUID!, $offset: Int!) @auth(level: NO_ACCESS) { magazinePdfParts(where: {uploadId: {eq: $id}},orderBy: {ordinal: ASC},offset: $offset,limit: 2) {ordinal payload} }',{variables:{id:manifest.uploadId,offset}})).data.magazinePdfParts;for(let i=0;i<Math.min(2,manifest.parts-offset);i++){const row=rows[i];if(!row||row.ordinal!==offset+i)throw Error('El documento está incompleto.');const bytes=Buffer.from(row.payload,'base64'),expected=Math.min(MAGAZINE_PART_BYTES,size-(offset+i)*MAGAZINE_PART_BYTES);if(bytes.length!==expected)throw Error('El documento está incompleto.');buffers.push(bytes);}}
 const bytes=Buffer.concat(buffers);if(createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('No se ha podido verificar el documento.');return bytes;
}
