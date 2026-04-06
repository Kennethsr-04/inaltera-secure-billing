
CREATE TABLE public.empresa_perfil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  razon_social text NOT NULL DEFAULT '',
  nif text NOT NULL DEFAULT '',
  direccion text DEFAULT '',
  codigo_postal text DEFAULT '',
  ciudad text DEFAULT '',
  provincia text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own empresa" ON public.empresa_perfil
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own empresa" ON public.empresa_perfil
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own empresa" ON public.empresa_perfil
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
