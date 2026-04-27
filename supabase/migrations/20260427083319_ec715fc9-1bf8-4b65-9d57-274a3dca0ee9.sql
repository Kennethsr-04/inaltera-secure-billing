
DROP POLICY IF EXISTS "Users can upload own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own PDFs" ON storage.objects;

CREATE POLICY "Users can upload own PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'facturas-pdf'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'facturas-pdf'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
