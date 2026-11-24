// SIMULACIÓN de limpieza: solo LISTA candidatos. No borra, mueve ni modifica nada (ni local ni remoto).
//   npm run cleanup:dry-run              -> artefactos locales de cdir-admin-app y ../front-cdir
//   npm run cleanup:dry-run -- --remote  -> además consultas de SOLO LECTURA a SQL Connect (requiere credenciales)
// Revisa cada candidato a mano antes de eliminar nada. Los datos reales nunca se borran desde aquí.
import {readdir,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
const admin=process.cwd(),front=path.resolve(admin,'../front-cdir'),remote=process.argv.includes('--remote');
type Candidate={where:string;item:string;bytes?:number;reason:string};
const out:Candidate[]=[];
async function size(p:string):Promise<number>{try{const s=await stat(p);if(!s.isDirectory())return s.size;let t=0;for(const e of await readdir(p))t+=await size(path.join(p,e));return t;}catch{return 0;}}
async function exists(p:string){try{await stat(p);return true;}catch{return false;}}
async function walk(dir:string,filter:(f:string)=>boolean,acc:string[]=[]){for(const e of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=path.join(dir,e.name);if(e.isDirectory()){if(!['node_modules','.git','.next','out','_v','96'].includes(e.name))await walk(p,filter,acc);}else if(filter(p))acc.push(p);}return acc;}
async function local(){
 for(const [root,items] of [[admin,['.next','.next-club-test','tsconfig.tsbuildinfo','test-results','playwright-report']],[front,['.next','out','tsconfig.tsbuildinfo','test-results']]] as const)
  for(const item of items){const p=path.join(root,item);if(await exists(p))out.push({where:path.basename(root),item,bytes:await size(p),reason:'Artefacto de compilación/pruebas; se regenera.'});}
 for(const f of await walk(path.join(admin,'.local'),f=>/\.(tmp|log|png)$/.test(f)))out.push({where:'cdir-admin-app',item:path.relative(admin,f),bytes:await size(f),reason:'Temporal, registro o captura local.'});
 for(const f of await walk(path.join(front,'data'),f=>/\.(png|jpg)$/.test(f)))out.push({where:'front-cdir',item:path.relative(front,f),bytes:await size(f),reason:'Captura o material de trabajo en data/ (no se publica).'});
 // Images in public/ that no source file references (the site may still link them from content: review).
 let source='';for(const f of await walk(front,f=>/\.(tsx?|json|css)$/.test(f)&&!f.includes(`${path.sep}public${path.sep}`)))source+=await readFile(f,'utf8');
 for(const f of await walk(path.join(front,'public'),f=>/\.(png|jpe?g|webp|gif)$/i.test(f)&&!f.includes(`${path.sep}pdfjs${path.sep}`)))if(!source.includes(path.basename(f)))out.push({where:'front-cdir',item:path.relative(front,f),bytes:await size(f),reason:'Imagen sin referencias en el código.'});
}
async function sqlConnect(){
 const {initializeApp,getApps,applicationDefault}=await import('firebase-admin/app'),{getDataConnect}=await import('firebase-admin/data-connect');
 if(process.env.FIREBASE_PROJECT_ID!=='cdir-apps')throw Error('FIREBASE_PROJECT_ID debe ser cdir-apps.');
 const app=getApps()[0]||initializeApp({credential:applicationDefault(),projectId:'cdir-apps'});
 const dc=getDataConnect({serviceId:process.env.SQL_CONNECT_SERVICE_ID||'cdir-apps-2-service',location:process.env.SQL_CONNECT_LOCATION||'europe-southwest1'},app);
 const read=async<T,>(q:string)=>(await dc.executeGraphqlRead<T,undefined>(q)).data;
 // Manifests only (startsWith "{"): never downloads the PDF payload of small documents.
 const manifests=(await read<{magazineDocuments:{id:string;magazineId:string;payload:string}[]}>('query D @auth(level: NO_ACCESS) {magazineDocuments(where: {payload: {startsWith: "{"}}, limit: 1000) {id magazineId payload}}')).magazineDocuments;
 const used=new Set(manifests.map(d=>{try{return JSON.parse(d.payload).uploadId as string;}catch{return '';}}));
 const parts=new Map<string,number>();for(let offset=0;;offset+=1000){const page=(await read<{magazinePdfParts:{uploadId:string}[]}>(`query P @auth(level: NO_ACCESS) {magazinePdfParts(limit: 1000, offset: ${offset}, orderBy: {id: ASC}) {uploadId}}`)).magazinePdfParts;for(const p of page)parts.set(p.uploadId,(parts.get(p.uploadId)||0)+1);if(page.length<1000)break;}
 for(const [uploadId,count] of parts)if(!used.has(uploadId))out.push({where:'SQL Connect',item:'magazine_pdf_parts uploadId='+uploadId,bytes:count*1024*1024,reason:`${count} fragmento(s) de una subida no terminada (sin revista). Tamaño aproximado.`});
 const magazines=new Set((await read<{magazines:{id:string}[]}>('query M @auth(level: NO_ACCESS) {magazines(limit: 1000) {id}}')).magazines.map(m=>m.id));
 const docs=(await read<{magazineDocuments:{magazineId:string}[]}>('query A @auth(level: NO_ACCESS) {magazineDocuments(limit: 1000) {magazineId}}')).magazineDocuments;
 if(!docs.length&&!magazines.size)return;
 for(const id of magazines)if(!docs.some(d=>d.magazineId===id))out.push({where:'SQL Connect',item:'magazines id='+id,reason:'Revista sin documento almacenado (puede ser un enlace externo legítimo: revisar).'});
}
await local();
if(remote)await sqlConnect();
const fmt=(n?:number)=>n===undefined?'':n>1e6?(n/1e6).toFixed(1)+' MB':(n/1e3).toFixed(0)+' kB';
console.log('MODO SIMULACIÓN: no se ha borrado ni modificado nada.\n');
for(const c of out)console.log(`[${c.where}] ${c.item}  ${fmt(c.bytes)}\n    ${c.reason}`);
console.log(`\n${out.length} candidato(s); ${fmt(out.reduce((s,c)=>s+(c.bytes||0),0))} en total.${remote?'':' Ejecuta con --remote para revisar también SQL Connect (solo lectura).'}`);
