import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Building2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { mockSubscriptionStatus } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const planes = [
  { id: "gratuito", nombre: "Gratuito", precio: 0, facturas: "0-5", limite: 5 },
  { id: "basico", nombre: "Básico", precio: 9, facturas: "6-10", limite: 10 },
  { id: "profesional", nombre: "Profesional", precio: 15, facturas: "11-20", limite: 20 },
];

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
  const subscription = mockSubscriptionStatus;

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
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

  const handleSubscribe = (planId: string) => {
    toast.info(`Redirigiendo a pasarela de pago para el plan ${planId}...`);
  };

  const usagePercent = (subscription.facturasUsadas / subscription.facturasLimite) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Datos de Empresa y Tarifas</h1>
        <p className="text-muted-foreground">Gestiona tu perfil fiscal y plan de suscripción</p>
      </div>

      <Tabs defaultValue="empresa" className="space-y-4">
        <TabsList>
          <TabsTrigger value="empresa" className="gap-2">
            <Building2 className="h-4 w-4" />
            Datos Fiscales
          </TabsTrigger>
          <TabsTrigger value="tarifas" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Tarifas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
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
        </TabsContent>

        <TabsContent value="tarifas">
          <div className="space-y-6">
            {/* Usage card */}
            <Card>
              <CardHeader>
                <CardTitle>Uso Actual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Facturas este mes</span>
                  <span className="font-medium">
                    {subscription.facturasUsadas} / {subscription.facturasLimite}
                  </span>
                </div>
                <Progress value={usagePercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Próxima renovación: {subscription.proximaRenovacion}
                </p>
              </CardContent>
            </Card>

            {/* Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {planes.map((plan) => {
                const isActive = subscription.plan === plan.id;
                return (
                  <Card
                    key={plan.id}
                    className={isActive ? "border-primary ring-2 ring-primary/20" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{plan.nombre}</CardTitle>
                        {isActive && <Badge>Activo</Badge>}
                      </div>
                      <CardDescription>{plan.facturas} facturas/mes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-display font-bold">
                        {plan.precio}€
                        <span className="text-sm font-normal text-muted-foreground">/mes</span>
                      </div>
                      <ul className="text-sm space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          Hasta {plan.limite} facturas
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          Sellado criptográfico
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          Registro inmutable
                        </li>
                      </ul>
                      <Button
                        variant={isActive ? "outline" : "default"}
                        className="w-full"
                        disabled={isActive}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        {isActive ? "Plan actual" : "Suscribirse"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
