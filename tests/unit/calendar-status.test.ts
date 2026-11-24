import {it,expect} from 'vitest';
import {physicalCalendarStatus} from '@/domain/calendar-status';
import {demoId as id} from '@/domain/seed';
import type {SupportSession} from '@/domain/types';
const row:SupportSession={id:id(1),seasonId:id(2),coachId:id(3),teamId:id(4),venueId:id(5),kind:'PHYSICAL',title:'Físico',startsAt:'2026-11-02T16:00:00.000Z',endsAt:'2026-11-02T17:00:00.000Z',status:'SCHEDULED'};
it('detecta nuevas sesiones, cambios y cancelaciones sin transferir otra vez el club completo',()=>{const empty=physicalCalendarStatus([],id(2)),one=physicalCalendarStatus([row],id(2));expect(one.count).toBe(1);expect(one.first).toBe(row.startsAt);expect(one.signature).not.toBe(empty.signature);const cancelled=physicalCalendarStatus([{...row,status:'CANCELLED'}],id(2));expect(cancelled.signature).not.toBe(one.signature);expect(cancelled.scheduled).toBe(0);expect(physicalCalendarStatus([{...row,venueId:id(9)}],id(2)).signature).not.toBe(one.signature);});
it('la firma es estable aunque las filas lleguen en otro orden y excluye otras temporadas y psicología',()=>{const other={...row,id:id(8)};expect(physicalCalendarStatus([row,other],id(2))).toEqual(physicalCalendarStatus([other,row],id(2)));expect(physicalCalendarStatus([row,{...row,id:id(6),kind:'PSYCHOLOGY'},{...row,id:id(7),seasonId:id(99)}],id(2)).count).toBe(1);});
