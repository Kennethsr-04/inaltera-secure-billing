
-- Table to store invoices with VeriFactu QR data
CREATE TABLE public.facturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  numero_factura TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'completa' CHECK (tipo IN ('completa', 'simplificada', 'rectificativa')),
  origen TEXT NOT NULL DEFAULT 'elaborada' CHECK (origen IN ('elaborada', 'cargada')),
  cliente_nombre TEXT NOT NULL,
  cliente_nif TEXT NOT NULL,
  cliente_direccion TEXT,
  regimen_iva TEXT NOT NULL DEFAULT 'general',
  lineas JSONB NOT NULL DEFAULT '[]'::jsonb,
  observaciones TEXT,
  base_imponible NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_iva NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_irpf NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_recargo NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  huella_hash TEXT,
  qr_url TEXT,
  verifactu_url TEXT,
  pdf_path TEXT,
  estado TEXT NOT NULL DEFAULT 'sellada',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON public.facturas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices" ON public.facturas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage bucket for generated PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('facturas-pdf', 'facturas-pdf', false);

CREATE POLICY "Users can upload own PDFs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'facturas-pdf' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own PDFs" ON storage.objects
  FOR SELECT USING (bucket_id = 'facturas-pdf' AND (storage.foldername(name))[1] = auth.uid()::text);
