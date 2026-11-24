CREATE TABLE magazine_documents(id uuid PRIMARY KEY,"magazineId" uuid NOT NULL UNIQUE REFERENCES magazines(id),payload text NOT NULL,size integer NOT NULL CHECK(size BETWEEN 1 AND 2097152));
