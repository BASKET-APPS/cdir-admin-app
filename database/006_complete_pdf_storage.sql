-- Approval required before applying to the live database.
-- Verified scope: two currently empty PDF storage tables. No publications are removed.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM magazine_documents) OR EXISTS(SELECT 1 FROM magazine_pdf_parts) THEN
  RAISE EXCEPTION 'PDF storage is no longer empty; review migration before continuing';
 END IF;
END $$;
-- Preserve uniqueness using the exact standalone index expected by SQL Connect.
CREATE UNIQUE INDEX IF NOT EXISTS "magazine_pdf_parts_uploadId_ordinal_uidx" ON magazine_pdf_parts("uploadId",ordinal);
ALTER TABLE magazine_pdf_parts DROP CONSTRAINT IF EXISTS "magazine_pdf_parts_uploadId_ordinal_key";
ALTER TABLE magazine_pdf_parts DROP CONSTRAINT IF EXISTS cdir_magazine_pdf_parts_upload_ordinal_key;
-- SQL Connect cannot model these additional checks. The upload API enforces the
-- 50 MB size, 1 MB parts, 0..49 order, complete length and SHA-256 verification.
ALTER TABLE magazine_documents DROP CONSTRAINT IF EXISTS magazine_documents_size_check;
ALTER TABLE magazine_documents DROP CONSTRAINT IF EXISTS cdir_magazine_documents_size_check;
ALTER TABLE magazine_pdf_parts DROP CONSTRAINT IF EXISTS magazine_pdf_parts_ordinal_check;
ALTER TABLE magazine_pdf_parts DROP CONSTRAINT IF EXISTS cdir_magazine_pdf_parts_ordinal_check;
-- Primary keys, the magazine foreign key, NOT NULL, private authorization and
-- the unique upload/order index remain in force. Schema validation stays COMPATIBLE.
