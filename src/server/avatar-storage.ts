import 'server-only';
import sharp from 'sharp';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {storageBucket} from './firebase';
import {demoMode} from './mode';

const root=path.join(process.cwd(),'.local','avatars');
function localPath(reference:string){
 if(!/^private\/profiles\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(reference))throw new Error('Referencia de imagen no válida.');
 return path.join(root,reference.split('/').slice(-2).join('_'));
}
export async function normalizeAvatar(bytes:Buffer){
 if(!bytes.length||bytes.length>3*1024*1024)throw new Error('La foto debe ocupar menos de 3 MB.');
 const image=sharp(bytes,{limitInputPixels:16_000_000,animated:false,failOn:'error'});
 let meta;
 try{meta=await image.metadata();}catch{throw new Error('El archivo no es una imagen válida.');}
 if(!meta.format||!['jpeg','png','webp'].includes(meta.format)||!meta.width||!meta.height||(meta.pages||1)>1)throw new Error('Utiliza una imagen JPG, PNG o WebP sin animación.');
 try{return await image.rotate().resize(320,320,{fit:'cover',position:'attention'}).webp({quality:85}).toBuffer();}catch{throw new Error('No se pudo procesar la imagen. Prueba con otra foto.');}
}
export async function writeAvatar(reference:string,bytes:Buffer){
 const file=localPath(reference);
 if(demoMode()){await mkdir(root,{recursive:true});await writeFile(file,bytes,{flag:'wx'});}
 else await storageBucket().file(reference).save(bytes,{resumable:false,metadata:{contentType:'image/webp',cacheControl:'private, no-store'}});
}
export function inlineAvatar(reference:string){return /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(reference)&&reference.length<750_000;}
export async function readAvatar(reference:string){if(inlineAvatar(reference))return Buffer.from(reference.split(',')[1],'base64');const file=localPath(reference);return demoMode()?readFile(file):(await storageBucket().file(reference).download())[0];}
export async function removeAvatar(reference:string){if(inlineAvatar(reference))return;const file=localPath(reference);if(demoMode())await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});else await storageBucket().file(reference).delete({ignoreNotFound:true});}

export async function avatarFile(request:Request){
 if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))throw new Error('Selecciona una foto para subir.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Falta la imagen.');
 const chunks:Uint8Array[]=[];let total=0;
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>4*1024*1024){await reader.cancel();throw new Error('La foto debe ocupar menos de 3 MB.');}chunks.push(value);}
 const data=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();
 if([...data.keys()].some(k=>k!=='file')||data.getAll('file').length!==1)throw new Error('Solo puedes modificar la foto de tu propia cuenta.');
 const file=data.get('file');if(!(file instanceof File))throw new Error('Selecciona una imagen.');
 return normalizeAvatar(Buffer.from(await file.arrayBuffer()));
}
