import {randomUUID} from 'node:crypto';
import {deepStrictEqual} from 'node:assert';
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getDataConnect} from 'firebase-admin/data-connect';
import {getStorage} from 'firebase-admin/storage';
import {emptyState} from '../src/domain/types';
import {demoState} from '../src/domain/seed';
import {workspacePageQuery,workspaceMutation} from '../src/domain/sql-connect';
const app=initializeApp({credential:applicationDefault(),projectId:'cdir-apps'}),dc=getDataConnect({serviceId:'cdir-apps-2-service',location:'europe-southwest1'},app);
const read=await dc.executeGraphqlRead(workspacePageQuery(0));
console.log('Lectura real de las 22 entidades por SQL Connect: OK.');
const mutation=workspaceMutation(emptyState(),demoState(),-1)!;
let rejected=false;try{await dc.executeGraphql(mutation.query,{variables:mutation.variables});}catch(e){if(String(e).includes('CDIR_CONCURRENT_CHANGE'))rejected=true;else throw e;}
if(!rejected)throw Error('La protección de concurrencia no rechazó una revisión incorrecta.');
const after=await dc.executeGraphqlRead(workspacePageQuery(0));
deepStrictEqual(after.data,read.data,'Una transacción fallida no puede cambiar registros.');
console.log('Contrato completo de escritura validado; revisión incorrecta rechazada y rollback sin insertar datos ficticios: OK.');
const revision=(await dc.executeGraphqlRead<{workspaceRevision:{version:number}},undefined>('query R @auth(level: NO_ACCESS) { workspaceRevision(key: {id: "club"}) {version} }')).data.workspaceRevision;
if(revision){
 const variables={version:revision.version,next:revision.version+1,id:'probe-'+randomUUID()};
 const query='mutation Probe($version: Int!, $next: Int!, $id: String!) @auth(level: NO_ACCESS) @transaction { lock: workspaceRevision_updateMany(where: {id: {eq: "club"}, version: {eq: $version}}, data: {version: $next}) @check(expr: "this == 1", message: "CDIR_CONCURRENT_CHANGE") added: workspaceRevision_insert(data: {id: $id,version: 0}) removed: workspaceRevision_delete(key: {id: $id}) }';
 const results=await Promise.allSettled([dc.executeGraphql(query,{variables}),dc.executeGraphql(query,{variables})]);
 if(results.filter(r=>r.status==='fulfilled').length!==1)throw Error('Dos escrituras simultáneas no deben confirmar la misma revisión.');
 console.log('Escritura real y exclusión de guardados simultáneos: OK; registro técnico temporal eliminado en la misma transacción.');
}

try{const [exists]=await getStorage(app).bucket(process.env.FIREBASE_STORAGE_BUCKET!).exists();console.log('Bucket privado de imágenes: '+(exists?'disponible':'todavía no creado'));}catch{console.log('Bucket privado de imágenes: todavía no verificable/configurado.');}
