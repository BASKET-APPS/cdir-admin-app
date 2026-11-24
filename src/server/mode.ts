export function demoMode(){
 if(process.env.NODE_ENV==='production'||process.env.CDIR_DATABASE==='sql-connect')return false;
 if(process.env.CDIR_MODE==='demo'&&process.env.DATABASE_URL){const url=new URL(process.env.DATABASE_URL);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.pathname!=='/cdir_club_local')throw new Error('El acceso de prueba solo admite la base local cdir_club_local.');return true;}
 return process.env.CDIR_MODE!=='firebase'&&!process.env.DATABASE_URL;
}
export function localRequest(request:Request){const u=new URL(request.url);return ['127.0.0.1','localhost','[::1]'].includes(u.hostname);}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin||origin!==(process.env.APP_ORIGIN||new URL(request.url).protocol+'//'+(request.headers.get('host')||new URL(request.url).host)))throw new Error('Origen no permitido.');}
