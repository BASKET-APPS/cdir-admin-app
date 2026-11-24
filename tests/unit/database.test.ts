import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {readFile,readdir} from 'node:fs/promises';
import {demoState,demoId as id} from '@/domain/seed';
import {tableMap} from '@/server/store';
it('aplica el esquema completo y exige integridad en PostgreSQL',async()=>{
 const db=new PGlite({extensions:{btree_gist}});
 try{for(const name of (await readdir('database')).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile('database/'+name,'utf8'));const s=demoState();for(const [key,table] of Object.entries(tableMap)){for(const row of s[key as keyof typeof s]){const data=row as unknown as Record<string,unknown>,fields=Object.keys(data);await db.query(`INSERT INTO ${table} (${fields.map(f=>'"'+f+'"').join(',')}) VALUES(${fields.map((_,i)=>'$'+(i+1)).join(',')})`,fields.map(f=>['fields','answers'].includes(f)?JSON.stringify(data[f]):data[f]));}}
 expect((await db.query('SELECT * FROM teams')).rows).toHaveLength(4);
 await expect(db.query('UPDATE player_seasons SET "seasonId"=$1 WHERE id=$2',[id(2),id(50)])).rejects.toThrow();
 await expect(db.query(`INSERT INTO sessions SELECT $1,"seasonId","teamId","venueId","startsAt","endsAt",kind,status FROM sessions WHERE id=$2`,[id(301),id(100)])).rejects.toThrow();
 await expect(db.query('UPDATE seasons SET current=true WHERE id=$1',[id(2)])).rejects.toThrow();
 await expect(db.query('DELETE FROM audit_logs')).rejects.toThrow();
 await expect(db.query('UPDATE forms SET version=2 WHERE id=$1',[id(120)])).rejects.toThrow();
 }finally{await db.close();}
});
