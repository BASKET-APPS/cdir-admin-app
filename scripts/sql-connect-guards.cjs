// Additional PostgreSQL invariants not expressible in the GraphQL schema.
// Run only against the fixed CDIR database, using the Firebase CLI IAM login.
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const dir=process.env.FIREBASE_TOOLS_DIR;if(!dir)throw Error('Indica FIREBASE_TOOLS_DIR.');
 const {requireAuth}=require(path.join(dir,'lib/requireAuth.js'));
 const {executeSqlCmdsAsSuperUser,executeSqlCmdsAsIamUser}=require(path.join(dir,'lib/gcp/cloudsql/connect.js'));
 const options={project:'cdir-apps',projectId:'cdir-apps',projectRoot:process.cwd(),nonInteractive:true};Object.assign(options,require(path.join(dir,'lib/auth.js')).getGlobalDefaultAccount());await requireAuth(options);
 const sql=await fs.readFile('dataconnect/relational-guards.sql','utf8');
 await executeSqlCmdsAsSuperUser(options,'cdir-apps-instance','cdir-apps-2-database',['CREATE EXTENSION IF NOT EXISTS btree_gist'],true,true);
 await executeSqlCmdsAsIamUser(options,'cdir-apps-instance','cdir-apps-2-database',['SET ROLE "firebaseowner_cdir-apps-2-database_public"',sql.replace('CREATE EXTENSION IF NOT EXISTS btree_gist;','')],true,true);
 console.log('Restricciones, reservas sin solapamientos y auditoría inmutable aplicadas a SQL Connect.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
