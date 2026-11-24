// Small, explicit READ-ONLY check against the configured SQL Connect service.
// Usage: node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/measure-public-readonly.mts
// Reads published sports data only. No writes, identity data, resource creation or load tests.
// Fetches the published archive once and the recent view once; consumes operation/transfer quota.
import {performance} from 'node:perf_hooks';
import {readPublicSlice} from '../src/server/public-data';
import {publicFeed} from '../src/domain/public-feed';

if(process.env.FIREBASE_PROJECT_ID!=='cdir-apps'||process.env.CDIR_DATABASE!=='sql-connect')throw Error('Esta comprobación requiere cdir-apps y sql-connect.');
const deadline=setTimeout(()=>{console.error(JSON.stringify({ok:false,reason:'timeout',note:'No se obtuvo una medición completa en 45 segundos.'}));process.exit(2);},45000);
try{
 const readings=[];
 for(const matchView of ['archive','recent'] as const){
  const start=performance.now();
  const state=await readPublicSlice(['matches'],{registration:false,matchView});
  const milliseconds=Math.round(performance.now()-start);
  const feed=publicFeed(state,['matches'],false);
  readings.push({view:matchView,publishedMatches:state.matches.length,publicBodyBytes:Buffer.byteLength(JSON.stringify(feed)),millisecondsFromThisComputer:milliseconds});
 }
 const [archive,recent]=readings;
 console.log(JSON.stringify({ok:true,checkedAt:new Date().toISOString(),project:'cdir-apps',readOnly:true,readings,
  publicBodyReductionPercent:archive.publicBodyBytes?Math.round((1-recent.publicBodyBytes/archive.publicBodyBytes)*10000)/100:null,
  limitations:['Bytes del JSON público sin compresión; no son bytes facturados ni tamaño físico de PostgreSQL.','Latencia desde este ordenador, no CPU de Cloud Run ni prueba de carga.','La publicación puede cambiar entre lecturas; esta comparación no sustituye al validador de revisión estable.','No se ha desplegado el código ni medido visitantes, descargas, copias o correo.']},null,2));
}catch(error){
 const message=error instanceof Error?error.message:'';
 const reason=/quota|egress|resource.exhausted/i.test(message)?'quota':/credential|invalid_grant|reauth|unauthenticated|invalid.*token/i.test(message)?'authentication':/permission|denied/i.test(message)?'permission':'query-or-network';
 console.error(JSON.stringify({ok:false,reason,note:'No se ha podido medir. No se imprimen credenciales, datos personales ni errores remotos completos.'}));process.exitCode=1;
}finally{clearTimeout(deadline);}
