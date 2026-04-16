import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Perfil() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    razonSocial: "",
    nif: "",
    direccion: "",
    codigoPostal: "",
    ciudad: "",
    provincia: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("empresa_perfil")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          razonSocial: data.razon_social || "",
          nif: data.nif || "",
          direccion: data.direccion || "",
          codigoPostal: data.codigo_postal || "",
          ciudad: data.ciudad || "",
          provincia: data.provincia || "",
        });
      }
      setLoading(false);
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.razonSocial || !profile.nif) {
      toast.error("Razón Social y NIF son obligatorios");
      return;
    }
    const nifRegex = /^[A-Za-z0-9]{8,9}$/;
    if (!nifRegex.test(profile.nif)) {
      toast.error("Formato de NIF/CIF no válido");
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No autenticado");

      const payload = {
        user_id: session.user.id,
        razon_social: profile.razonSocial,
        nif: profile.nif,
        direccion: profile.direccion,
        codigo_postal: profile.codigoPostal,
        ciudad: profile.ciudad,
        provincia: profile.provincia,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("empresa_perfil")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      toast.success("Datos guardados correctamente");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar los datos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Datos de Empresa</h1>
        <p className="text-muted-foreground">Gestiona tu perfil fiscal</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos Fiscales de la Empresa</CardTitle>
          <CardDescription>
            Estos datos se usarán como emisor en las facturas generadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Cargando datos...</p>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="razonSocial">Razón Social *</Label>
                  <Input
                    id="razonSocial"
                    placeholder="Mi Empresa S.L."
                    value={profile.razonSocial}
                    onChange={(e) => setProfile({ ...profile, razonSocial: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nif">NIF/CIF *</Label>
                  <Input
                    id="nif"
                    placeholder="B12345678"
                    value={profile.nif}
                    onChange={(e) => setProfile({ ...profile, nif: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input
                    id="provincia"
                    placeholder="Madrid"
                    value={profile.provincia}
                    onChange={(e) => setProfile({ ...profile, provincia: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="direccion">Domicilio Fiscal</Label>
                  <Input
                    id="direccion"
                    placeholder="Calle Mayor, 1"
                    value={profile.direccion}
                    onChange={(e) => setProfile({ ...profile, direccion: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigoPostal">Código Postal</Label>
                  <Input
                    id="codigoPostal"
                    placeholder="28001"
                    value={profile.codigoPostal}
                    onChange={(e) => setProfile({ ...profile, codigoPostal: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input
                    id="ciudad"
                    placeholder="Madrid"
                    value={profile.ciudad}
                    onChange={(e) => setProfile({ ...profile, ciudad: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar Datos"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
