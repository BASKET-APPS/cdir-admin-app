-- Preserve venue IDs used by historical sessions while controlling the current catalogue.
ALTER TABLE venues ADD COLUMN active boolean DEFAULT true;
