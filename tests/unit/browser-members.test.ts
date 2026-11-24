import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {emptyState,type State,type Member} from '@/domain/types';
const mock=vi.hoisted(()=>({query:vi.fn(),mutate:vi.fn(),auth:vi.fn()}));
vi.mock('@/lib/browser-sql',()=>({browserQuery:mock.query,browserMutation:mock.mutate,browserPublicFeed:vi.fn(),browserMagazine:vi.fn()}));
vi.mock('@/lib/client-auth',()=>({clientAuth:mock.auth}));
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const owner:Member={id:id(1),uid:'owner-uid',email:'owner@example.invalid',name:'Administración',role:'ADMIN',teamIds:[],active:true};
let state:State;
afterEach(()=>vi.unstubAllGlobals());
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.stubGlobal('location',{origin:'https://example.invalid'});state=emptyState();state.members=[owner];state.seasons=[{id:id(2),name:'2026 / 2027',startsAt:'2026-09-01',endsAt:'2027-08-31',current:true,status:'OPEN'}];mock.auth.mockReturnValue({authStateReady:async()=>{},currentUser:{uid:owner.uid,photoURL:null,getIdToken:async()=>'synthetic-token'}});mock.query.mockImplementation(async(name:string)=>{if(name==='BrowserIdentity')return state;if(name==='BrowserAdminPage')return {...state,workspaceRevision:{version:42}};throw Error('Unexpected operation '+name);});});
it('the actual workspace POST authorizes the selected account and refreshes from Firebase',async()=>{
 mock.mutate.mockImplementation(async(name:string,v:Record<string,unknown>)=>{expect(name).toBe('BrowserAuthorizeMember');state.members.push({id:String(v.memberId),uid:String(v.uid),name:String(v.name),email:String(v.email),role:'ADMIN',teamIds:[],active:true});return {};});
 const {browserApi}=await import('@/lib/browser-api');
 await browserApi('https://example.invalid/api/workspace');
 const r=await browserApi('https://example.invalid/api/workspace',{method:'POST',body:JSON.stringify({action:'memberByEmail',seasonId:id(2),payload:{name:'Nueva responsable',email:'PERSONA@example.invalid',role:'ADMIN',staffFunctions:['COACH','PHYSICAL']}})});
 expect(r.status).toBe(200);const data=await r.json();expect(data.state.members).toHaveLength(2);expect(mock.mutate).toHaveBeenCalledWith('BrowserAuthorizeMember',expect.objectContaining({email:'persona@example.invalid',role:'ADMIN',coach:true,physical:true,psychology:false,version:42,next:43}),'synthetic-token');
 expect(mock.query.mock.calls.filter(([name])=>name==='BrowserAdminPage')).toHaveLength(2);
});
it('a verified invitation is bound before loading the new coach without assigned teams',async()=>{
 const invite={...owner,id:id(3),uid:'invite:pending',email:'invited@example.invalid',role:'COACH' as const};let claimed=false;
 mock.auth.mockReturnValue({authStateReady:async()=>{},currentUser:{uid:'new-google-uid',photoURL:null,getIdToken:async()=>'synthetic-token'}});
 mock.query.mockImplementation(async(name:string)=>{if(name==='BrowserIdentity'){if(!claimed)throw Object.assign(Error('Denied'),{code:'CDIR_ACCESS_REQUIRED'});return {...emptyState(),members:[{...invite,uid:'new-google-uid'}],seasons:state.seasons};}if(name==='BrowserInvitation')return {members:[invite],workspaceRevision:{version:7}};throw Error('Unexpected query');});
 mock.mutate.mockImplementation(async()=>{claimed=true;return {};});
 const {browserApi}=await import('@/lib/browser-api');const r=await browserApi('https://example.invalid/api/workspace');expect(r.status).toBe(200);const data=await r.json();expect(data.user.uid).toBe('new-google-uid');expect(data.user.role).toBe('COACH');expect(data.state.seasons).toHaveLength(1);expect(mock.mutate).toHaveBeenCalledWith('BrowserAcceptInvitation',{memberId:id(3),version:7,next:8},'synthetic-token');
});
it('the HTTP adapter preserves a concurrency error for the existing reload flow',async()=>{
 const {browserApi}=await import('@/lib/browser-api');await browserApi('https://example.invalid/api/workspace');mock.mutate.mockRejectedValue(Object.assign(Error('Los datos han cambiado'),{status:409}));
 const r=await browserApi('https://example.invalid/api/workspace',{method:'POST',body:JSON.stringify({action:'memberByEmail',payload:{name:'Nueva cuenta',email:'other@example.invalid',role:'COACH',staffFunctions:['COACH']}})});expect(r.status).toBe(409);
});
