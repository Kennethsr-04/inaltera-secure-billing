
-- Add soft-delete column
ALTER TABLE public.facturas ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Allow authenticated users to delete their own invoices
CREATE POLICY "Users can delete own invoices"
ON public.facturas
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
