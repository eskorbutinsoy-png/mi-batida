-- Public bucket for app update artifacts (APK + latest.json)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('app-updates', 'app-updates', true, false, null, null)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public read from app-updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to app-updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update on app-updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete on app-updates" ON storage.objects;

CREATE POLICY "Allow public read from app-updates"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-updates');

CREATE POLICY "Allow authenticated upload to app-updates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-updates');

CREATE POLICY "Allow authenticated update on app-updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app-updates')
WITH CHECK (bucket_id = 'app-updates');

CREATE POLICY "Allow authenticated delete on app-updates"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app-updates');
