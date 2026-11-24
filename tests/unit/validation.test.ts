import {it,expect,vi} from 'vitest';
import {compareViews,compareStableViews} from '@/domain/validation';

it('detecta valores diferentes aunque todos los identificadores coincidan',()=>{
 expect(compareViews({matches:[{id:'m',scoreFor:10}]},{matches:[{id:'m',scoreFor:20}]})).toEqual([{table:'matches',missing:0,extra:0,changed:1,duplicates:0}]);
});
it('detecta campos ausentes, filas ausentes, extras y duplicadas',()=>{
 const diff=compareViews({players:[{id:'a',email:null},{id:'b'}]},{players:[{id:'a'},{id:'c'},{id:'c'}]});
 expect(diff[0]).toMatchObject({missing:1,extra:1,changed:1,duplicates:1});
});
it('normaliza orden de claves, de filas, UUID y formatos equivalentes de fecha',()=>{
 expect(compareViews({rows:[{id:'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',at:'2030-01-01T01:00:00+01:00',nested:{b:2,a:1}},{id:'b'}]},
 {rows:[{id:'b'},{nested:{a:1,b:2},at:'2030-01-01T00:00:00.000Z',id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}]})).toEqual([]);
});
it('descarta una comparación si cambió la revisión y solo compara el siguiente par estable',async()=>{
 const values=[1,2,2,2],read=vi.fn().mockResolvedValueOnce({expected:{rows:[{id:'a'}]},actual:{rows:[]}}).mockResolvedValueOnce({expected:{rows:[{id:'a'}]},actual:{rows:[{id:'a'}]}});
 const result=await compareStableViews(async()=>values.shift()!,read);
 expect(result).toMatchObject({status:'stable',attempt:2,differences:[]});expect(read).toHaveBeenCalledTimes(2);
});
it('no declara éxito si la base cambia en todos los intentos',async()=>{
 let version=0;expect(await compareStableViews(async()=>++version,async()=>({expected:{},actual:{}}))).toEqual({status:'changing',attempt:3});
});
it('no convierte una lectura fallida en un resultado equivalente',async()=>{
 await expect(compareStableViews(async()=>1,async()=>{throw Error('Falló la lectura');})).rejects.toThrow('Falló la lectura');
});
