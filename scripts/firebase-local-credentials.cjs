// Development only: reuse the Firebase CLI login as Application Default Credentials.
// Credentials stay in ignored .local; never copy them into the application bundle.
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 if(process.env.NODE_ENV==='production')throw Error('Solo desarrollo local.');
 const dir=process.env.FIREBASE_TOOLS_DIR;if(!dir)throw Error('Indica FIREBASE_TOOLS_DIR (directorio del paquete firebase-tools).');
 const {getGlobalDefaultAccount}=require(path.join(dir,'lib/auth.js'));
 const api=require(path.join(dir,'lib/api.js')),account=getGlobalDefaultAccount();
 if(!account?.tokens?.refresh_token)throw Error('Ejecuta firebase login primero.');
 await fs.mkdir('.local',{recursive:true});
 const target=path.resolve('.local/firebase-adc.json');
 await fs.writeFile(target,JSON.stringify({type:'authorized_user',client_id:api.clientId(),client_secret:api.clientSecret(),refresh_token:account.tokens.refresh_token}),{mode:0o600});
 let env=await fs.readFile('.env.local','utf8');env=env.replace(/^GOOGLE_APPLICATION_CREDENTIALS=.*\r?\n?/gm,'');env+='\nGOOGLE_APPLICATION_CREDENTIALS='+target.replaceAll('\\','/')+'\n';await fs.writeFile('.env.local',env);
 console.log('Credenciales locales de servidor preparadas en archivo excluido de Git.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
