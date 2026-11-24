CREATE TABLE magazine_covers(id uuid PRIMARY KEY,"magazineId" uuid NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,payload text NOT NULL,etag text NOT NULL);
CREATE UNIQUE INDEX "magazine_covers_magazineId_uidx" ON magazine_covers("magazineId");
