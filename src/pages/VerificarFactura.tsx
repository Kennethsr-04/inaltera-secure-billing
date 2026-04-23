import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  ShieldCheck,
  Calendar,
  Building2,
  User,
  Receipt,
  QrCode,
  Download,
  Search,
} from "lucide-react";

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

const estadoConfig: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  sellada: { label: "Sellada", className: "bg-primary/10 text-primary" },
  enviada: { label: "Enviada", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  pagada: { label: "Pagada", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  vencida: { label: "Vencida", className: "bg-destructive/10 text-destructive" },
  anulada: { label: "Anulada", className: "bg-muted text-muted-foreground line-through" },
};

export default function VerificarFactura() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [factura, setFactura] = useState<FacturaPublica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualNumero, setManualNumero] = useState("");
  const qrContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const huella = searchParams.get("huella");
    const numero = searchParams.get("numero");

    if (!huella && !numero) {
      setError(null);
      setFactura(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFactura(null);

    const params = new URLSearchParams();
    if (huella) params.set("huella", huella);
    if (numero) params.set("numero", numero);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${supabaseUrl}/functions/v1/verificar-factura?${params.toString()}`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error desconocido");
        setFactura(data.factura);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const value = manualNumero.trim();
    if (!value) return;
    setSearchParams({ numero: value });
  };

  const handleDownloadQr = () => {
    if (!factura?.qr_url || !qrContainerRef.current) return;
    const svg = qrContainerRef.current.querySelector("svg");
    if (!svg) return;
    const svgString = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const link = document.createElement("a");
      link.download = `qr-factura-${factura.numero_factura}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando factura…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Factura no encontrada</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {error}. Comprueba que el enlace o código QR sea correcto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!factura) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Verificar factura</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Escanea el código QR de la factura o introduce su número para verificarla.
              </p>
            </div>
            <form onSubmit={handleManualSearch} className="flex gap-2 w-full mt-2">
              <Input
                placeholder="Nº de factura (ej. F-2025-0001)"
                value={manualNumero}
                onChange={(e) => setManualNumero(e.target.value)}
              />
              <Button type="submit">Verificar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const estado = estadoConfig[factura.estado] || { label: factura.estado, className: "" };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header con verificación */}
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-2.5 shrink-0">
              <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200 text-sm">
                Factura verificada
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Documento registrado y autenticado digitalmente
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Código QR de la factura */}
        {factura.qr_url && (
          <Card>
            <CardContent className="pt-6 pb-5 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <QrCode className="h-4 w-4 text-primary" />
                Código QR de verificación
              </div>
              <div
                ref={qrContainerRef}
                className="bg-white p-3 rounded-lg border"
              >
                <QRCodeSVG
                  value={factura.qr_url}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center break-all max-w-[280px] font-mono">
                {factura.qr_url}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadQr}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar QR
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Datos principales */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Número y estado */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nº Factura</p>
                  <p className="font-bold text-lg leading-tight">{factura.numero_factura}</p>
                </div>
              </div>
              <Badge className={`${estado.className} mt-1`}>{estado.label}</Badge>
            </div>

            <Separator />

            {/* Total destacado */}
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Importe total</p>
              <p className="text-3xl font-bold text-foreground">{fmt(factura.total)}</p>
            </div>

            <Separator />

            {/* Info clave en grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="text-sm font-medium">{fmtDate(factura.created_at)}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Receipt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Régimen</p>
                  <p className="text-sm font-medium capitalize">{factura.regimen_iva}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium">{factura.cliente_nombre}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">NIF/CIF</p>
                  <p className="text-sm font-medium font-mono">{factura.cliente_nif}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Desglose fiscal */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Desglose</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base imponible</span>
                  <span className="font-medium">{fmt(factura.base_imponible)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-medium">{fmt(factura.total_iva)}</span>
                </div>
                {factura.total_irpf > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IRPF</span>
                    <span className="font-medium text-destructive">-{fmt(factura.total_irpf)}</span>
                  </div>
                )}
                {factura.total_recargo > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recargo equiv.</span>
                    <span className="font-medium">{fmt(factura.total_recargo)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Huella digital */}
        {factura.huella_hash && (
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium">Huella digital SHA-256</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono break-all leading-relaxed">
                {factura.huella_hash}
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          Verificación generada automáticamente · Inaltera
        </p>
      </div>
    </div>
  );
}
