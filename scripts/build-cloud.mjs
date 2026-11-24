import {spawnSync} from 'node:child_process';
let c;try{c=JSON.parse(process.env.FIREBASE_WEB_CONFIG||'');}catch{throw Error('FIREBASE_WEB_CONFIG must contain public Firebase web configuration JSON.');}
if(c.projectId!=='cdir-apps')throw Error('Cloud builds must use cdir-apps, never Basket Analytics.');
const fields={apiKey:'API_KEY',authDomain:'AUTH_DOMAIN',projectId:'PROJECT_ID',storageBucket:'STORAGE_BUCKET',messagingSenderId:'MESSAGING_SENDER_ID',appId:'APP_ID'};
const env={...process.env,CDIR_STANDALONE:'true',CDIR_BUILD_CPUS:'1',NEXT_PUBLIC_CDIR_PUBLIC_URL:process.env.PUBLIC_SITE_URL||'https://basket-apps.github.io/front-cdir'};
for(const [key,name] of Object.entries(fields)){if(typeof c[key]!=='string'||!c[key])throw Error('Missing public Firebase setting '+key);env['NEXT_PUBLIC_FIREBASE_'+name]=c[key];}
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{env,stdio:'inherit'});process.exit(result.status??1);
