
-- Table to store external database connection configurations
CREATE TABLE public.conexiones_bd (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT 'Mi conexión',
  tipo_bd TEXT NOT NULL DEFAULT 'postgresql',
  host TEXT NOT NULL,
  puerto TEXT NOT NULL DEFAULT '5432',
  nombre_bd TEXT NOT NULL,
  usuario_bd TEXT NOT NULL,
  password_bd TEXT,
  activa BOOLEAN NOT NULL DEFAULT false,
  ultima_sincronizacion TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.conexiones_bd ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON public.conexiones_bd FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
  ON public.conexiones_bd FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON public.conexiones_bd FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON public.conexiones_bd FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
