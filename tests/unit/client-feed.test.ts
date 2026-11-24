import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {loadSections,resetClubFeed} from '../../../front-cdir/lib/club-feed';
beforeEach(()=>resetClubFeed());
afterEach(()=>vi.unstubAllGlobals());
it('el cliente comparte la descarga simultánea de las mismas secciones',async()=>{
 const fetcher=vi.fn(async(_url:string)=>Response.json({matches:[]}));vi.stubGlobal('fetch',fetcher);
 await Promise.all([loadSections('https://example.invalid',['matches'],'recent'),loadSections('https://example.invalid',['matches'],'recent')]);
 expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toContain('matchView=recent');
});
it('el cliente nunca confunde una petición de portada con la del histórico',async()=>{
 const urls:string[]=[];vi.stubGlobal('fetch',async(url:string)=>{urls.push(url);return Response.json({matches:[]});});
 await Promise.all([loadSections('https://example.invalid',['matches'],'recent'),loadSections('https://example.invalid',['matches'],'archive')]);
 expect(urls).toHaveLength(2);expect(urls.filter(u=>u.includes('matchView=recent'))).toHaveLength(1);
 expect(urls).toContain('https://example.invalid/api/public/club?sections=matches');
});
it('permite reintentar una petición fallida en lugar de conservar una promesa rechazada',async()=>{
 let calls=0;vi.stubGlobal('fetch',async()=>{calls++;return calls===1?new Response('',{status:503}):Response.json({matches:[]});});
 await expect(loadSections('https://example.invalid',['matches'],'recent')).rejects.toThrow();
 await loadSections('https://example.invalid',['matches'],'recent');expect(calls).toBe(2);
});
