// Explicit remote, READ-ONLY validator. Never run by the app or local tests.
// Usage: npm run validate:scoped -- <uid> [seasonId]
// Multiple paginated full/scoped reads, up to 3 attempts: consumes transfer/operation quota.
// Exit: 0 equivalent; 1 differences/error; 2 inconclusive (concurrent writes).
import {readSqlConnectState,sqlConnectRevision} from '../src/server/sql-connect-store';
import {readWorkspace} from '../src/server/scoped-store';
import {sliceState,workspaceScope,AUDIT_PAGE} from '../src/domain/scope';
import {visibleState} from '../src/domain/permissions';
import {coachIdentity} from '../src/domain/people';
import {compareStableViews} from '../src/domain/validation';

async function main(){
 const [uid,wanted]=process.argv.slice(2);
 if(!uid)throw Error('Indica el uid de un usuario: npm run validate:scoped -- <uid> [seasonId]');
 if(process.env.FIREBASE_PROJECT_ID!=='cdir-apps')throw Error('FIREBASE_PROJECT_ID debe ser cdir-apps.');
 process.env.CDIR_DATABASE='sql-connect';
 const result=await compareStableViews(sqlConnectRevision,async()=>{
  const full=await readSqlConnectState();
  const member=full.members.find(m=>m.uid===uid&&m.active);if(!member)throw Error('Usuario no encontrado o inactivo.');
  const user=coachIdentity(full,member),scoped=await readWorkspace(user,wanted||null);
  const expected=visibleState(sliceState(full,workspaceScope(user,scoped.seasonId)),user);
  const actual=visibleState(scoped.state,coachIdentity(scoped.state,user));
  return {expected:expected as unknown as Record<string,unknown>,actual:actual as unknown as Record<string,unknown>,auditCount:scoped.state.audit.length};
 });
 if(result.status==='changing'){
  console.error('NO CONCLUYENTE: la revisión cambió durante las lecturas. Repite en un periodo sin escrituras.');process.exitCode=2;return;
 }
 for(const d of result.differences)console.error(`DIFERENCIA ${d.table}: faltan ${d.missing}, sobran ${d.extra}, valores distintos ${d.changed}, duplicados ${d.duplicates}`);
 console.log(`Intentos: ${result.attempt}; auditoría: ${result.views.auditCount}/${AUDIT_PAGE}. Se comparan identificadores y valores normalizados, sin imprimir datos personales.`);
 if(result.differences.length){console.error('NO desplegar: las vistas difieren.');process.exitCode=1;}
 else console.log('Sin diferencias en una revisión estable. Esto valida lecturas; no sustituye pruebas de escritura, permisos ni capacidad.');
}
main().catch(()=>{console.error('Validación no completada. Revisa credenciales, conectividad y compatibilidad de las consultas. No se imprimen errores remotos que puedan contener datos privados.');process.exitCode=1;});
