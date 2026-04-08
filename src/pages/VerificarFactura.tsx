import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, FileText, Loader2, ShieldCheck } from "lucide-react";

interface FacturaPublica {
  numero_factura: string;
  cliente_nombre: string;
  cliente_nif: string;
  base_imponible: number;
  total_iva: number;
  total_irpf: number;
  total_recargo: number;
  total: number;
  regimen_iva: string;
  estado: string;
  created_at: string;
  huella_hash: string | null;
  qr_url: string | null;
}

const estadoColor: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground",
  sellada: "bg-primary/10 text-primary",
  enviada: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pagada: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  vencida: "bg-destructive/10 text-destructive",
  anulada: "bg-muted text-muted-foreground line-through",
};

export default function VerificarFactura() {
  const [searchParams] = useSearchParams();
  const [factura, setFactura] = useState<FacturaPublica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const huella = searchParams.get("huella");
    const numero = searchParams.get("numero");

    if (!huella && !numero) {
      setError("No se proporcionó identificador de factura.");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (huella) params.set("huella", huella);
    if (numero) params.set("numero", numero);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${supabaseUrl}/functions/v1/verificar-factura?${params.toString()}`, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error desconocido");
        setFactura(data.factura);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl">Verificación de Factura</CardTitle>
          <p className="text-sm text-muted-foreground">
            Consulta pública de datos fiscales
          </p>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="font-medium text-destructive">{error}</p>
              <p className="text-sm text-muted-foreground">
                La factura no existe o el enlace es inválido.
              </p>
            </div>
          ) : factura ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">{factura.numero_factura}</span>
                </div>
                <Badge className={estadoColor[factura.estado] || ""}>
                  {factura.estado.charAt(0).toUpperCase() + factura.estado.slice(1)}
                </Badge>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{factura.cliente_nombre}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">NIF/CIF</p>
                  <p className="font-medium">{factura.cliente_nif}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha emisión</p>
                  <p className="font-medium">{fmtDate(factura.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Régimen IVA</p>
                  <p className="font-medium capitalize">{factura.regimen_iva}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base imponible</span>
                  <span>{fmt(factura.base_imponible)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span>{fmt(factura.total_iva)}</span>
                </div>
                {factura.total_irpf > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IRPF</span>
                    <span>-{fmt(factura.total_irpf)}</span>
                  </div>
                )}
                {factura.total_recargo > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recargo equiv.</span>
                    <span>{fmt(factura.total_recargo)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>{fmt(factura.total)}</span>
                </div>
              </div>

              {factura.huella_hash && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Huella digital verificada</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      SHA-256: {factura.huella_hash}
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
