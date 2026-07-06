-- Storage policies for chat-images bucket
-- Allow authenticated users to upload and read images

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('chat-images', 'chat-images', true, false, null, null)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated upload to chat-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to chat-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from chat-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from chat-images" ON storage.objects;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated upload to chat-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated update to chat-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-images')
WITH CHECK (bucket_id = 'chat-images');

-- Policy: Allow public read access to chat-images
CREATE POLICY "Allow public read from chat-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-images');

-- Policy: Allow authenticated delete of own files
CREATE POLICY "Allow authenticated delete from chat-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images');
