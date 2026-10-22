-- Uploaded image keys are now "tenants/<tenant id>/images/<uuid>.<ext>" (~90 chars), longer than
-- the original varchar(40) columns. Only widen columns that are still narrower than 512.
DO $$
DECLARE
    col record;
BEGIN
    FOR col IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'character varying'
          AND character_maximum_length < 512
          AND (table_name, column_name) IN (
              ('products', 'thumbnail'), ('products', 'picture1'), ('products', 'picture2'),
              ('products', 'picture3'), ('products', 'picture4'),
              ('categories', 'thumbnail'), ('categories', 'full_picture')
          )
    LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE varchar(512)', col.table_name, col.column_name);
    END LOOP;
END $$;
