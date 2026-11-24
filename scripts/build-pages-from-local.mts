import {spawnSync} from 'node:child_process';
const config=Object.fromEntries(Object.entries({apiKey:'API_KEY',authDomain:'AUTH_DOMAIN',projectId:'PROJECT_ID',storageBucket:'STORAGE_BUCKET',messagingSenderId:'MESSAGING_SENDER_ID',appId:'APP_ID'}).map(([k,v])=>[k,process.env['NEXT_PUBLIC_FIREBASE_'+v]]));
const r=spawnSync(process.execPath,['--import','tsx','scripts/build-pages-live.mts'],{env:{...process.env,FIREBASE_WEB_CONFIG:JSON.stringify(config)},stdio:'inherit'});process.exit(r.status??1);
