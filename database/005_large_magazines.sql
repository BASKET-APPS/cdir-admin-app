-- Relax only the PDF size bound; existing documents and publications are preserved.
ALTER TABLE magazine_documents DROP CONSTRAINT IF EXISTS magazine_documents_size_check;
ALTER TABLE magazine_documents ADD CONSTRAINT magazine_documents_size_check CHECK(size BETWEEN 1 AND 52428800);
CREATE TABLE IF NOT EXISTS magazine_pdf_parts(id uuid PRIMARY KEY,"uploadId" uuid NOT NULL,ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 49),payload text NOT NULL,UNIQUE("uploadId",ordinal));
-- Parts are staged before the atomic magazine/document insert. The private manifest
-- references uploadId; an unfinished upload never becomes a publication.
