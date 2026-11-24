import {parseSections,publicFeed} from '@/domain/public-feed';
import {readPublicSlice} from '@/server/public-data';
import {cachedPublicJson,notModified} from '@/server/public-cache';
import {failure} from '@/server/http';
import {sqlConnectRevision} from '@/server/sql-connect-store';
// Public data only. Browsers revalidate with ETag (304 without body); shared caches may keep it briefly.
// Shared caches (CDN) may keep it 15 s and serve it 15 s more while refreshing; browsers always revalidate.
const headers={'Cache-Control':'public, max-age=0, s-maxage=15, stale-while-revalidate=15','Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
export async function GET(request:Request){try{
 const params=new URL(request.url).searchParams,sections=parseSections(params.get('sections')),registration=process.env.PUBLIC_REGISTRATION_ENABLED==='true';
 // Opt in: existing consumers and the calendar keep the complete published archive.
 const matchView=params.get('matchView')==='recent'?'recent':'archive';
 const {body,etag}=await cachedPublicJson('club:'+sections.join(',')+':'+registration+':'+matchView,async()=>publicFeed(await readPublicSlice(sections,{registration,matchView}),sections,registration),process.env.CDIR_DATABASE==='sql-connect'?sqlConnectRevision:undefined);
 if(notModified(request,etag))return new Response(null,{status:304,headers:{...headers,ETag:etag}});
 return new Response(body,{headers:{...headers,ETag:etag}});
}catch(e){const response=failure(e);response.headers.set('Access-Control-Allow-Origin','*');return response;}}
