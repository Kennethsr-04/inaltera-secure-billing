
-- 1. Restringir políticas de facturas a authenticated
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.facturas;
DROP POLICY IF EXISTS "Users can view own invoices" ON public.facturas;

CREATE POLICY "Users can insert own invoices"
ON public.facturas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own invoices"
ON public.facturas
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Política DELETE para empresa_perfil
CREATE POLICY "Users can delete own empresa"
ON public.empresa_perfil
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Políticas UPDATE y DELETE para bucket facturas-pdf
CREATE POLICY "Users can update own invoice PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'facturas-pdf'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'facturas-pdf'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own invoice PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'facturas-pdf'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
