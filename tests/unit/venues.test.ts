import {it,expect} from 'vitest';
import {demoState,demoId as id} from '@/domain/seed';
import {execute} from '@/domain/commands';
import {currentVenues,clubVenueNames} from '@/domain/venues';
import type {Identity} from '@/domain/types';
const admin:Identity={uid:'admin',name:'Admin',email:'admin@example.invalid',role:'ADMIN',teamIds:[],active:true};
it('registra exactamente los cinco centros, conserva el histórico y no inventa direcciones ni pistas',()=>{const s=demoState(),old=s.venues.map(v=>v.id),session=structuredClone(s.sessions[0]);execute(s,admin,'configureClubVenues',{});expect(currentVenues(s.venues).map(v=>v.name)).toEqual([...clubVenueNames]);expect(currentVenues(s.venues).every(v=>v.address===''&&v.space==='Espacio sin especificar')).toBe(true);expect(s.venues.filter(v=>old.includes(v.id)).every(v=>v.active===false)).toBe(true);expect(s.sessions[0]).toEqual(session);const ids=currentVenues(s.venues).map(v=>v.id);execute(s,admin,'configureClubVenues',{});expect(currentVenues(s.venues).map(v=>v.id)).toEqual(ids);expect(()=>execute(s,{...admin,role:'COACH'},'configureClubVenues',{})).toThrow('permiso');});
it('rechaza nuevas reservas en instalaciones archivadas sin invalidar el histórico',()=>{const s=demoState();execute(s,admin,'configureClubVenues',{});expect(()=>execute(s,admin,'session',{seasonId:id(1),teamId:id(10),venueId:id(90),startsAt:'2026-11-10T17:00:00Z',endsAt:'2026-11-10T18:00:00Z',kind:'Cancha',weeks:1})).toThrow('archivada');});
