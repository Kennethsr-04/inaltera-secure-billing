import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Search, Download, FileText, FileCode, CalendarIcon, QrCode, Loader2, ArrowRightLeft, History, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { EstadoBadge, EstadoTimeline, ESTADOS, type EstadoLog } from "@/components/factura/EstadoTimeline";
import { CambiarEstadoDialog } from "@/components/factura/CambiarEstadoDialog";

type Factura = Tables<"facturas">;

export default function RegistroFacturas() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQr, setSelectedQr] = useState<Factura | null>(null);
  const [cambiarEstadoFactura, setCambiarEstadoFactura] = useState<Factura | null>(null);
  const [historialFactura, setHistorialFactura] = useState<Factura | null>(null);
  const [historialLogs, setHistorialLogs] = useState<EstadoLog[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [previewFactura, setPreviewFactura] = useState<Factura | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchFacturas = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("facturas")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Error al cargar facturas");
      console.error(error);
    } else {
      setFacturas(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFacturas(); }, [fetchFacturas]);

  const moveToTrash = async (factura: Factura) => {
    const { error } = await supabase
      .from("facturas")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", factura.id);
    if (error) {
      toast.error("Error al mover a la papelera");
    } else {
      toast.success(`Factura ${factura.numero_factura} movida a la papelera`);
      fetchFacturas();
    }
  };

  const handleCambiarEstado = async (nuevoEstado: string, nota: string) => {
    if (!cambiarEstadoFactura) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { toast.error("No autenticado"); return; }
    const estadoAnterior = cambiarEstadoFactura.estado;
    const { error: updateError } = await supabase
      .from("facturas")
      .update({ estado: nuevoEstado })
      .eq("id", cambiarEstadoFactura.id);
    if (updateError) { toast.error("Error al actualizar estado"); return; }
    await supabase.from("factura_estados_log").insert({
      factura_id: cambiarEstadoFactura.id,
      user_id: authUser.id,
      estado_anterior: estadoAnterior,
      estado_nuevo: nuevoEstado,
      nota: nota || null,
    });
    toast.success(`Estado cambiado a "${nuevoEstado}"`);
    fetchFacturas();
  };

  const openHistorial = async (factura: Factura) => {
    setHistorialFactura(factura);
    setLoadingHistorial(true);
    const { data } = await supabase
      .from("factura_estados_log")
      .select("id, estado_anterior, estado_nuevo, nota, created_at")
      .eq("factura_id", factura.id)
      .order("created_at", { ascending: false });
    setHistorialLogs((data as EstadoLog[]) || []);
    setLoadingHistorial(false);
  };

  const filtered = useMemo(() => {
    return facturas.filter((f) => {
      const matchSearch =
        !search ||
        f.numero_factura.toLowerCase().includes(search.toLowerCase()) ||
        f.cliente_nombre.toLowerCase().includes(search.toLowerCase());
      const fDate = new Date(f.created_at);
      const matchFrom = !dateFrom || fDate >= dateFrom;
      const matchTo = !dateTo || fDate <= dateTo;
      const matchEstado = estadoFilter === "todos" || f.estado === estadoFilter;
      return matchSearch && matchFrom && matchTo && matchEstado;
    });
  }, [facturas, search, dateFrom, dateTo, estadoFilter]);

  const downloadPdf = async (factura: Factura) => {
    if (!factura.pdf_path) {
      toast.error("PDF no disponible");
      return;
    }
    const { data, error } = await supabase.storage
      .from("facturas-pdf")
      .download(factura.pdf_path);
    if (error || !data) {
      toast.error("Error al descargar el PDF");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factura-${factura.numero_factura.replace(/\//g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewPdf = async (factura: Factura) => {
    if (!factura.pdf_path) {
      toast.error("PDF no disponible");
      return;
    }
    setPreviewFactura(factura);
    setLoadingPreview(true);
    setPreviewPdfUrl(null);
    const { data, error } = await supabase.storage
      .from("facturas-pdf")
      .download(factura.pdf_path);
    if (error || !data) {
      toast.error("Error al cargar el PDF");
      setPreviewFactura(null);
      setLoadingPreview(false);
      return;
    }
    const url = URL.createObjectURL(data);
    setPreviewPdfUrl(url);
    setLoadingPreview(false);
  };

  const closePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewFactura(null);
    setPreviewPdfUrl(null);
  };

  const downloadJson = (factura: Factura) => {
    const registro = {
      numero_factura: factura.numero_factura,
      tipo: factura.tipo,
      origen: factura.origen,
      fecha: factura.created_at,
      cliente: {
        nombre: factura.cliente_nombre,
        nif: factura.cliente_nif,
        direccion: factura.cliente_direccion,
      },
      importes: {
        base_imponible: factura.base_imponible,
        total_iva: factura.total_iva,
        total_irpf: factura.total_irpf,
        total_recargo: factura.total_recargo,
        total: factura.total,
      },
      verificacion: {
        huella_hash: factura.huella_hash,
        algoritmo: "SHA-256",
        qr_url: factura.qr_url,
      },
      estado: factura.estado,
    };
    const blob = new Blob([JSON.stringify(registro, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registro-${factura.numero_factura.replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Registro de Facturas</h1>
        <p className="text-muted-foreground">Consulta y descarga tus facturas selladas con QR tributario</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Desde"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={es} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Hasta"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={es} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(dateFrom || dateTo || search || estadoFilter !== "todos") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setDateFrom(undefined);
                  setDateTo(undefined);
                  setEstadoFilter("todos");
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "Cargando..." : `${filtered.length} factura${filtered.length !== 1 ? "s" : ""} encontrada${filtered.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total (€)</TableHead>
                    <TableHead>QR Tributario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-sm">{format(new Date(f.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <EstadoBadge estado={f.origen === "elaborada" ? "emitida" : "cargada"} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{f.numero_factura}</TableCell>
                      <TableCell className="text-sm">{f.cliente_nombre}</TableCell>
                      <TableCell className="text-right font-medium">{Number(f.total).toFixed(2)}</TableCell>
                      <TableCell>
                        {(f.verifactu_url || f.qr_url) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-primary hover:text-primary"
                            onClick={() => setSelectedQr(f)}
                          >
                            <QrCode className="h-4 w-4" />
                            Ver QR
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <EstadoBadge estado={f.estado} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver PDF" onClick={() => viewPdf(f)} disabled={!f.pdf_path}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Cambiar estado" onClick={() => setCambiarEstadoFactura(f)}>
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver historial" onClick={() => openHistorial(f)}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar PDF con QR" onClick={() => downloadPdf(f)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar registro JSON" onClick={() => downloadJson(f)}>
                            <FileCode className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Mover a papelera" onClick={() => moveToTrash(f)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No se encontraron facturas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR VeriFactu Detail Dialog */}
      <Dialog open={!!selectedQr} onOpenChange={(open) => !open && setSelectedQr(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>QR Tributario — {selectedQr?.numero_factura}</DialogTitle>
            <DialogDescription>
              Código QR de verificación fiscal con huella SHA-256
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg border" id="registro-qr-container">
              <QRCodeSVG
                value={selectedQr?.verifactu_url ?? ""}
                size={200}
                level="H"
                includeMargin
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                {selectedQr?.cliente_nombre} — {Number(selectedQr?.total ?? 0).toFixed(2)}€
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                Huella: {selectedQr?.huella_hash ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground break-all max-w-[400px]">
                {selectedQr?.qr_url}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const svg = document.querySelector("#registro-qr-container svg");
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const blob = new Blob([svgData], { type: "image/svg+xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `qr-tributario-${selectedQr?.numero_factura?.replace(/\//g, "-")}.svg`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Descargar QR
              </Button>
              {selectedQr?.pdf_path && (
                <Button size="sm" onClick={() => selectedQr && downloadPdf(selectedQr)}>
                  <FileText className="h-4 w-4 mr-2" /> Descargar PDF
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cambiar Estado Dialog */}
      <CambiarEstadoDialog
        open={!!cambiarEstadoFactura}
        onOpenChange={(open) => !open && setCambiarEstadoFactura(null)}
        estadoActual={cambiarEstadoFactura?.estado ?? "sellada"}
        onConfirm={handleCambiarEstado}
      />

      {/* Historial Dialog */}
      <Dialog open={!!historialFactura} onOpenChange={(open) => !open && setHistorialFactura(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Historial — {historialFactura?.numero_factura}</DialogTitle>
            <DialogDescription>Registro de cambios de estado</DialogDescription>
          </DialogHeader>
          {loadingHistorial ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <EstadoTimeline logs={historialLogs} />
          )}
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewFactura} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {previewFactura?.numero_factura} — {previewFactura?.cliente_nombre}
            </DialogTitle>
            <DialogDescription>
              Vista previa del PDF de la factura
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {loadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewPdfUrl ? (
              <iframe
                src={previewPdfUrl}
                className="w-full h-full rounded-md border"
                title={`Vista previa factura ${previewFactura?.numero_factura}`}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
