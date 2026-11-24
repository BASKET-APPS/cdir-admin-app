// Keep every existing validation. Rename custom checks and add the index expected
// by Data Connect; no constraints, rows, or tables are removed.
const path=require('node:path');
(async()=>{const dir=process.env.FIREBASE_TOOLS_DIR;if(!dir)throw Error('Falta Firebase CLI.');const options={project:'cdir-apps',projectId:'cdir-apps',projectRoot:process.cwd(),nonInteractive:true};Object.assign(options,require(path.join(dir,'lib/auth.js')).getGlobalDefaultAccount());await require(path.join(dir,'lib/requireAuth.js')).requireAuth(options);const sql=`SET ROLE "firebaseowner_cdir-apps-2-database_public";
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM magazine_documents) OR EXISTS(SELECT 1 FROM magazine_pdf_parts) THEN RAISE EXCEPTION 'Expected empty PDF storage; stop for review'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname='magazine_documents_size_check' AND conrelid='magazine_documents'::regclass) THEN ALTER TABLE magazine_documents RENAME CONSTRAINT magazine_documents_size_check TO cdir_magazine_documents_size_check; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname='magazine_pdf_parts_ordinal_check' AND conrelid='magazine_pdf_parts'::regclass) THEN ALTER TABLE magazine_pdf_parts RENAME CONSTRAINT magazine_pdf_parts_ordinal_check TO cdir_magazine_pdf_parts_ordinal_check; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname='magazine_pdf_parts_uploadId_ordinal_key' AND conrelid='magazine_pdf_parts'::regclass) THEN ALTER TABLE magazine_pdf_parts RENAME CONSTRAINT "magazine_pdf_parts_uploadId_ordinal_key" TO cdir_magazine_pdf_parts_upload_ordinal_key; END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "magazine_pdf_parts_uploadId_ordinal_uidx" ON magazine_pdf_parts("uploadId",ordinal);`;
await require(path.join(dir,'lib/gcp/cloudsql/connect.js')).executeSqlCmdsAsIamUser(options,'cdir-apps-instance','cdir-apps-2-database',[sql],true,true);console.log('Constraint names aligned. All validations retained; no data removed.');})().catch(e=>{console.error(e.message);process.exitCode=1});
