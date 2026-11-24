import {it,expect} from 'vitest';
import {demoState} from '@/domain/seed';
import {emptyState} from '@/domain/types';
import {workspaceMutation,workspacePageQuery,changedRows} from '@/domain/sql-connect';
it('serializa los cambios en una transacción con comparación de revisión',()=>{
 const s=demoState(),mutation=workspaceMutation(emptyState(),s,4)!;
 expect(mutation.query).toContain('@transaction');expect(mutation.query).toContain('@auth(level: NO_ACCESS)');
 expect(mutation.query).toContain('CDIR_CONCURRENT_CHANGE');expect(mutation.variables).toMatchObject({version:4,next:5});
 expect(workspaceMutation(s,structuredClone(s),5)).toBeNull();
});
it('no permite borrar histórico ni modificar auditoría',()=>{
 const s=demoState(),after=structuredClone(s);after.players.pop();expect(()=>changedRows(s,after)).toThrow();
 const audit=structuredClone(s);audit.audit[0].detail='alterado';expect(()=>changedRows(s,audit)).toThrow();
});
it('pagina las entidades sin descargar secretos en el cliente',()=>{
 const q=workspacePageQuery(500);expect(q).toContain('offset: 500');expect(q).toContain('orderBy: {id: ASC}');expect(q).toContain('attendanceRows');
});
