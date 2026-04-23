import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FilePlus, Upload, Plus, Trash2, FileUp, Download, FileText, Brain, CheckCircle, Edit2, ChevronsUpDown, Check, UserPlus, Loader2, Eye, EyeOff, ClipboardList, FileSpreadsheet, FileJson, Layers } from "lucide-react";
const RegistroFacturas = lazy(() => import("@/pages/Registro"));
import { ImportTab } from "@/pages/Datos";
import { BulkPdfUpload } from "@/components/factura/BulkPdfUpload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Cliente {
  id: string;
  nombre: string;
  nif: string;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
}

interface LineaFactura {
  id: string;
  productoId: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  tipoIva: number;
  irpf: number;
  recargoEquivalencia: number;
}

const emptyLinea = (): LineaFactura => ({
  id: crypto.randomUUID(),
  productoId: "",
  descripcion: "",
  cantidad: 1,
  precioUnitario: 0,
  descuento: 0,
  tipoIva: 21,
  irpf: 0,
  recargoEquivalencia: 0,
});

interface QrResultData {
  id: string;
  qrUrl: string;
  huella: string;
  pdfBase64: string;
}

interface ExtractedInvoiceData {
  emisor_nombre: string;
  emisor_nif: string;
  emisor_direccion: string;
  cliente_nombre: string;
  cliente_nif: string;
  cliente_direccion: string;
  numero_factura: string;
  fecha_emision: string;
  base_imponible: number;
  total_iva: number;
  total_irpf: number;
  total: number;
  tipo_iva: number;
  descripcion: string;
  layout_orientacion: "horizontal" | "vertical";
  layout_footer_libre: boolean;
}

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  iva: number;
}

function useServicios() {
  const [servicios, setServicios] = useState<Servicio[]>([]);

  const fetchServicios = useCallback(async () => {
    const { data } = await supabase
      .from("servicios")
      .select("id, nombre, descripcion, precio, iva")
      .order("nombre");
    if (data) setServicios(data);
  }, []);

  useEffect(() => { fetchServicios(); }, [fetchServicios]);

  return { servicios, refetch: fetchServicios };
}

function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nombre, nif, direccion, email, telefono")
      .order("nombre");
    if (!error && data) setClientes(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  return { clientes, loading, refetch: fetchClientes };
}

function NuevoClienteDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [nif, setNif] = useState("");
  const [direccion, setDireccion] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim() || !nif.trim()) {
      toast.error("Nombre y NIF son obligatorios");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("No autenticado"); setSaving(false); return; }

    const { data, error } = await supabase.from("clientes").insert({
      user_id: user.id,
      nombre: nombre.trim(),
      nif: nif.trim(),
      direccion: direccion.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
    }).select("id").single();

    setSaving(false);
    if (error) {
      toast.error("Error al guardar el cliente");
    } else {
      toast.success("Cliente creado correctamente");
      setNombre(""); setNif(""); setDireccion(""); setEmail(""); setTelefono("");
      onOpenChange(false);
      onCreated(data.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Nuevo Cliente
          </DialogTitle>
          <DialogDescription>Añade los datos del nuevo cliente</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre / Razón Social *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Empresa S.L." />
            </div>
            <div className="space-y-1.5">
              <Label>NIF / CIF *</Label>
              <Input value={nif} onChange={(e) => setNif(e.target.value)} placeholder="B12345678" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle Mayor 1, Madrid" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="912345678" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Guardar Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClienteCombobox({ value, onChange, clientes, onRefetch }: {
  value: string;
  onChange: (v: string) => void;
  clientes: Cliente[];
  onRefetch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const selectedCliente = clientes.find((c) => c.id === value);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selectedCliente
              ? `${selectedCliente.nombre} (${selectedCliente.nif})`
              : "Buscar o seleccionar cliente..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar cliente por nombre o NIF..." />
            <CommandList>
              <CommandEmpty>
                <p className="text-sm text-muted-foreground">No se encontraron clientes.</p>
              </CommandEmpty>
              <CommandGroup>
                {clientes.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.nombre} ${c.nif}`}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === c.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {c.nombre} ({c.nif})
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setShowNew(true);
                  }}
                  className="text-primary"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Añadir nuevo cliente
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <NuevoClienteDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(id) => {
          onRefetch();
          onChange(id);
        }}
      />
    </>
  );
}

export default function Facturacion() {

  const { token } = useAuth();
  const { servicios } = useServicios();

  const { clientes, refetch: refetchClientes } = useClientes();

  // Factura form state
  const [clienteId, setClienteId] = useState("");
  const [tipoFactura, setTipoFactura] = useState("completa");
  const [regimenIva, setRegimenIva] = useState("general");
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaFactura[]>([emptyLinea()]);
  const [emitiendo, setEmitiendo] = useState(false);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [extrayendo, setExtrayendo] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null);
  const [uploadStep, setUploadStep] = useState<"upload" | "review" | "sealing">("upload");
  const [showPreview, setShowPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // QR result state
  const [qrResult, setQrResult] = useState<QrResultData | null>(null);

  const addLinea = () => setLineas([...lineas, emptyLinea()]);
  const removeLinea = (id: string) => {
    if (lineas.length <= 1) return;
    setLineas(lineas.filter((l) => l.id !== id));
  };

  const updateLinea = (id: string, field: keyof LineaFactura, value: any) => {
    setLineas(lineas.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const selectProducto = (lineaId: string, servicioId: string) => {
    const svc = servicios.find((s) => s.id === servicioId);
    if (svc) {
      setLineas(
        lineas.map((l) =>
          l.id === lineaId
            ? { ...l, productoId: servicioId, descripcion: svc.nombre + (svc.descripcion ? ` - ${svc.descripcion}` : ""), precioUnitario: svc.precio, tipoIva: svc.iva }
            : l
        )
      );
    }
  };

  const totales = useMemo(() => {
    let baseImponible = 0;
    let totalIva = 0;
    let totalIrpf = 0;
    let totalRecargo = 0;

    lineas.forEach((l) => {
      const base = l.cantidad * l.precioUnitario * (1 - l.descuento / 100);
      baseImponible += base;
      totalIva += base * (l.tipoIva / 100);
      totalIrpf += base * (l.irpf / 100);
      totalRecargo += base * (l.recargoEquivalencia / 100);
    });

    return {
      baseImponible,
      totalIva,
      totalIrpf,
      totalRecargo,
      total: baseImponible + totalIva - totalIrpf + totalRecargo,
    };
  }, [lineas]);

  const handleEmitir = async () => {
    if (!clienteId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (lineas.some((l) => !l.descripcion || l.precioUnitario <= 0)) {
      toast.error("Completa todas las líneas de factura");
      return;
    }
    setEmitiendo(true);
    try {
      const { data: clienteData, error: clienteError } = await supabase
        .from("clientes")
        .select("nombre, nif, direccion")
        .eq("id", clienteId)
        .single();
      if (clienteError || !clienteData) throw new Error("Cliente no encontrado");
      const cliente = clienteData;

      const { data, error } = await supabase.functions.invoke("generar-factura-pdf", {
        body: {
          clienteId,
          clienteNombre: cliente.nombre,
          clienteNif: cliente.nif,
          clienteDireccion: cliente.direccion,
          tipoFactura,
          regimenIva,
          lineas: lineas.map((l) => ({
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            descuento: l.descuento,
            tipoIva: l.tipoIva,
            irpf: l.irpf,
            recargoEquivalencia: l.recargoEquivalencia,
          })),
          observaciones,
          emisorNombre: "",
          emisorNif: "",
          emisorDireccion: "",
          siteUrl: window.location.origin,
        },
      });

      if (error) throw error;

      setQrResult({
        id: data.id,
        qrUrl: data.qrUrl,
        huella: data.huella,
        pdfBase64: data.pdfBase64,
      });

      toast.success(`Factura ${data.id} generada con QR tributario`);
      setClienteId("");
      setLineas([emptyLinea()]);
      setObservaciones("");
    } catch (err: any) {
      toast.error(err.message || "Error al generar la factura");
    } finally {
      setEmitiendo(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      const url = URL.createObjectURL(file);
      setPdfPreviewUrl(url);
      setShowPreview(true);
    } else {
      toast.error("Solo se aceptan archivos PDF");
    }
  }, [pdfPreviewUrl]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      const url = URL.createObjectURL(file);
      setPdfPreviewUrl(url);
      setShowPreview(true);
    } else {
      toast.error("Solo se aceptan archivos PDF");
    }
  };

  const handleExtractData = async () => {
    if (!pdfFile) return;
    setExtrayendo(true);
    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extraer-datos-factura`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Error al extraer datos");
      }

      const data = await response.json();
      setExtractedData({
        emisor_nombre: data.extracted.emisor_nombre || "",
        emisor_nif: data.extracted.emisor_nif || "",
        emisor_direccion: data.extracted.emisor_direccion || "",
        cliente_nombre: data.extracted.cliente_nombre || "",
        cliente_nif: data.extracted.cliente_nif || "",
        cliente_direccion: data.extracted.cliente_direccion || "",
        numero_factura: data.extracted.numero_factura || "",
        fecha_emision: data.extracted.fecha_emision || "",
        base_imponible: data.extracted.base_imponible || 0,
        total_iva: data.extracted.total_iva || 0,
        total_irpf: data.extracted.total_irpf || 0,
        total: data.extracted.total || 0,
        tipo_iva: data.extracted.tipo_iva || 21,
        descripcion: data.extracted.descripcion || "",
        layout_orientacion: data.extracted.layout_orientacion || "vertical",
        layout_footer_libre: data.extracted.layout_footer_libre ?? true,
      });
      setUploadStep("review");
      toast.success("Datos extraídos correctamente. Revisa y confirma.");
    } catch (err: any) {
      toast.error(err.message || "Error al analizar el PDF");
    } finally {
      setExtrayendo(false);
    }
  };

  const handleSubirPdf = async () => {
    if (!pdfFile || !extractedData) return;
    setSubiendo(true);
    setUploadStep("sealing");
    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      formData.append("emisorNif", extractedData.emisor_nif);
      formData.append("emisorNombre", extractedData.emisor_nombre);
      formData.append("emisorDireccion", extractedData.emisor_direccion);
      formData.append("clienteNombre", extractedData.cliente_nombre);
      formData.append("clienteNif", extractedData.cliente_nif);
      formData.append("clienteDireccion", extractedData.cliente_direccion);
      formData.append("layoutOrientacion", extractedData.layout_orientacion);
      formData.append("layoutFooterLibre", String(extractedData.layout_footer_libre));
      formData.append("baseImponible", String(extractedData.base_imponible));
      formData.append("totalIva", String(extractedData.total_iva));
      formData.append("totalIrpf", String(extractedData.total_irpf));
      formData.append("total", String(extractedData.total));
      formData.append("descripcion", extractedData.descripcion);
      formData.append("siteUrl", window.location.origin);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sellar-pdf-tercero`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Error al sellar el PDF");
      }

      const data = await response.json();

      setQrResult({
        id: data.id,
        qrUrl: data.qrUrl,
        huella: data.huella,
        pdfBase64: data.pdfBase64,
      });

      toast.success(`PDF sellado con QR tributario — ${data.id}`);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfFile(null);
      setPdfPreviewUrl(null);
      setShowPreview(false);
      setExtractedData(null);
      setUploadStep("upload");
    } catch (err: any) {
      toast.error(err.message || "Error al cargar el PDF");
      setUploadStep("review");
    } finally {
      setSubiendo(false);
    }
  };

  const resetUpload = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfFile(null);
    setPdfPreviewUrl(null);
    setShowPreview(false);
    setExtractedData(null);
    setUploadStep("upload");
  };

  const downloadPdf = () => {
    if (!qrResult?.pdfBase64) return;
    const binary = atob(qrResult.pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factura-${qrResult.id.replace(/\//g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Facturación y Carga</h1>
        <p className="text-muted-foreground">Crea facturas o carga PDFs de terceros para sellar con QR tributario</p>
      </div>

      <Tabs defaultValue="elaborar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="elaborar" className="gap-2">
            <FilePlus className="h-4 w-4" />
            Elaborar Factura
          </TabsTrigger>
          <TabsTrigger value="cargar" className="gap-2">
            <Upload className="h-4 w-4" />
            Cargar
          </TabsTrigger>
          <TabsTrigger value="registro" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Registro de Facturas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="elaborar">
          <div className="space-y-4">
            {/* Header fields */}
            <Card>
              <CardHeader>
                <CardTitle>Datos de la Factura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <ClienteCombobox value={clienteId} onChange={setClienteId} clientes={clientes} onRefetch={refetchClientes} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Factura</Label>
                    <Select value={tipoFactura} onValueChange={setTipoFactura}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completa">Completa</SelectItem>
                        <SelectItem value="simplificada">Simplificada</SelectItem>
                        <SelectItem value="rectificativa">Rectificativa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Régimen IVA</Label>
                    <Select value={regimenIva} onValueChange={setRegimenIva}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">Régimen General</SelectItem>
                        <SelectItem value="simplificado">Simplificado</SelectItem>
                        <SelectItem value="recargo">Recargo de Equivalencia</SelectItem>
                        <SelectItem value="exento">Exento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice lines */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Líneas de Factura</CardTitle>
                  <Button variant="outline" size="sm" onClick={addLinea}>
                    <Plus className="h-4 w-4 mr-1" /> Añadir línea
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Producto / Descripción</TableHead>
                        <TableHead className="w-20">Cant.</TableHead>
                        <TableHead className="w-24">Base Imponible</TableHead>
                        <TableHead className="w-20">Dto.%</TableHead>
                        <TableHead className="w-20">IVA%</TableHead>
                        <TableHead className="w-20">IRPF%</TableHead>
                        <TableHead className="w-20">R.E.%</TableHead>
                        <TableHead className="w-24 text-right">Subtotal</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineas.map((linea) => {
                        const subtotal =
                          linea.cantidad * linea.precioUnitario * (1 - linea.descuento / 100);
                        return (
                          <TableRow key={linea.id}>
                            <TableCell>
                              <Select
                                value={linea.productoId}
                                onValueChange={(v) => selectProducto(linea.id, v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {servicios.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.nombre}{s.descripcion ? ` - ${s.descripcion}` : ""} ({s.precio.toFixed(2)}€)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                className="h-8 text-xs w-16"
                                value={linea.cantidad}
                                onChange={(e) =>
                                  updateLinea(linea.id, "cantidad", Number(e.target.value))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="h-8 text-xs w-20"
                                value={linea.precioUnitario}
                                onChange={(e) =>
                                  updateLinea(linea.id, "precioUnitario", Number(e.target.value))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                className="h-8 text-xs w-16"
                                value={linea.descuento}
                                onChange={(e) =>
                                  updateLinea(linea.id, "descuento", Number(e.target.value))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={String(linea.tipoIva)}
                                onValueChange={(v) => updateLinea(linea.id, "tipoIva", Number(v))}
                              >
                                <SelectTrigger className="h-8 text-xs w-16">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="21">21%</SelectItem>
                                  <SelectItem value="10">10%</SelectItem>
                                  <SelectItem value="4">4%</SelectItem>
                                  <SelectItem value="0">0%</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                className="h-8 text-xs w-16"
                                value={linea.irpf}
                                onChange={(e) =>
                                  updateLinea(linea.id, "irpf", Number(e.target.value))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                className="h-8 text-xs w-16"
                                value={linea.recargoEquivalencia}
                                onChange={(e) =>
                                  updateLinea(linea.id, "recargoEquivalencia", Number(e.target.value))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              {subtotal.toFixed(2)}€
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => removeLinea(linea.id)}
                                disabled={lineas.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Totals & submit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Observaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Notas adicionales..."
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={4}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Base Imponible</span>
                    <span>{totales.baseImponible.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Cuota IVA</span>
                    <span>{totales.totalIva.toFixed(2)}€</span>
                  </div>
                  {totales.totalIrpf > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Retención IRPF</span>
                      <span>-{totales.totalIrpf.toFixed(2)}€</span>
                    </div>
                  )}
                  {totales.totalRecargo > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Recargo Equivalencia</span>
                      <span>{totales.totalRecargo.toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{totales.total.toFixed(2)}€</span>
                  </div>
                  <Button
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleEmitir}
                    disabled={emitiendo}
                  >
                    {emitiendo ? "Generando PDF con QR tributario..." : "Generar Factura con QR Tributario"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cargar">
          <Tabs defaultValue="pdf" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pdf" className="gap-2">
                <FileUp className="h-4 w-4" />
                Cargar PDF
              </TabsTrigger>
              <TabsTrigger value="csv" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Cargar CSV
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-2">
                <FileJson className="h-4 w-4" />
                Cargar JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf">
          <div className="flex gap-4">
            {/* Left side: steps */}
            <div className={cn("space-y-4 transition-all", showPreview && pdfPreviewUrl ? "w-1/2" : "w-full")}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-2">
                    <div className={`flex items-center gap-2 text-sm font-medium ${uploadStep === "upload" ? "text-primary" : "text-muted-foreground"}`}>
                      <FileUp className="h-4 w-4" />
                      1. Subir PDF
                    </div>
                    <div className="h-px flex-1 bg-border" />
                    <div className={`flex items-center gap-2 text-sm font-medium ${uploadStep === "review" ? "text-primary" : "text-muted-foreground"}`}>
                      <Brain className="h-4 w-4" />
                      2. Revisar datos
                    </div>
                    <div className="h-px flex-1 bg-border" />
                    <div className={`flex items-center gap-2 text-sm font-medium ${uploadStep === "sealing" ? "text-primary" : "text-muted-foreground"}`}>
                      <CheckCircle className="h-4 w-4" />
                      3. Sellar
                    </div>
                  </div>
                  <Progress value={uploadStep === "upload" ? 33 : uploadStep === "review" ? 66 : 100} className="h-2" />
                </CardContent>
              </Card>

              {uploadStep === "upload" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Cargar Factura de Terceros</CardTitle>
                    <CardDescription>Sube un PDF de factura. La IA extraerá automáticamente los datos para revisarlos antes de sellar.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div
                      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50"}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                    >
                      <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-2">Arrastra un archivo PDF aquí o haz clic para seleccionar</p>
                      <input type="file" accept=".pdf" className="hidden" id="pdf-upload" onChange={handleFileInput} />
                      <Button variant="outline" asChild>
                        <label htmlFor="pdf-upload" className="cursor-pointer">Seleccionar PDF</label>
                      </Button>
                    </div>
                    {pdfFile && (
                      <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileUp className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{pdfFile.name}</span>
                          <span className="text-xs text-muted-foreground">({(pdfFile.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPreview(!showPreview)}
                            className="text-muted-foreground hover:text-primary"
                            title={showPreview ? "Ocultar vista previa" : "Ver vista previa"}
                          >
                            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); setPdfFile(null); setPdfPreviewUrl(null); setShowPreview(false); }} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <Button className="w-full" size="lg" disabled={!pdfFile || extrayendo} onClick={handleExtractData}>
                      <Brain className="h-4 w-4 mr-2" />
                      {extrayendo ? "Analizando PDF con IA..." : "Analizar y Extraer Datos"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {uploadStep === "review" && extractedData && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2"><Edit2 className="h-5 w-5" /> Datos Extraídos — Revisa y Edita</CardTitle>
                        <CardDescription>La IA ha extraído estos datos del PDF. Revísalos y corrígelos si es necesario.</CardDescription>
                      </div>
                      {pdfPreviewUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPreview(!showPreview)}
                          className="gap-2"
                        >
                          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showPreview ? "Ocultar PDF" : "Ver PDF"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Emisor (Nombre)</Label>
                        <Input value={extractedData.emisor_nombre} onChange={(e) => setExtractedData({ ...extractedData, emisor_nombre: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Emisor (NIF/CIF)</Label>
                        <Input value={extractedData.emisor_nif} onChange={(e) => setExtractedData({ ...extractedData, emisor_nif: e.target.value })} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Dirección del emisor</Label>
                        <Input value={extractedData.emisor_direccion} onChange={(e) => setExtractedData({ ...extractedData, emisor_direccion: e.target.value })} />
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Datos del Cliente (Receptor)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Cliente (Nombre)</Label>
                          <Input value={extractedData.cliente_nombre} onChange={(e) => setExtractedData({ ...extractedData, cliente_nombre: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Cliente (NIF/CIF)</Label>
                          <Input value={extractedData.cliente_nif} onChange={(e) => setExtractedData({ ...extractedData, cliente_nif: e.target.value })} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Dirección del cliente</Label>
                          <Input value={extractedData.cliente_direccion} onChange={(e) => setExtractedData({ ...extractedData, cliente_direccion: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Datos de la Factura</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nº Factura Original</Label>
                        <Input value={extractedData.numero_factura} onChange={(e) => setExtractedData({ ...extractedData, numero_factura: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha de Emisión</Label>
                        <Input value={extractedData.fecha_emision} onChange={(e) => setExtractedData({ ...extractedData, fecha_emision: e.target.value })} />
                      </div>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Importes</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Base Imponible</Label>
                          <Input type="number" step="0.01" value={extractedData.base_imponible} onChange={(e) => setExtractedData({ ...extractedData, base_imponible: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>IVA ({extractedData.tipo_iva}%)</Label>
                          <Input type="number" step="0.01" value={extractedData.total_iva} onChange={(e) => setExtractedData({ ...extractedData, total_iva: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>IRPF</Label>
                          <Input type="number" step="0.01" value={extractedData.total_irpf} onChange={(e) => setExtractedData({ ...extractedData, total_irpf: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Total</Label>
                          <Input type="number" step="0.01" value={extractedData.total} onChange={(e) => setExtractedData({ ...extractedData, total: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descripción</Label>
                      <Textarea value={extractedData.descripcion} onChange={(e) => setExtractedData({ ...extractedData, descripcion: e.target.value })} rows={2} />
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Posición del QR</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Orientación del PDF</Label>
                          <Select value={extractedData.layout_orientacion} onValueChange={(v) => setExtractedData({ ...extractedData, layout_orientacion: v as "horizontal" | "vertical" })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vertical">Vertical (portrait)</SelectItem>
                              <SelectItem value="horizontal">Horizontal (landscape)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Pie de página</Label>
                          <Select value={extractedData.layout_footer_libre ? "libre" : "ocupado"} onValueChange={(v) => setExtractedData({ ...extractedData, layout_footer_libre: v === "libre" })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="libre">Libre (QR centrado abajo)</SelectItem>
                              <SelectItem value="ocupado">Ocupado (QR en esquina)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetUpload}>Volver</Button>
                      <Button className="flex-1" size="lg" onClick={handleSubirPdf} disabled={subiendo}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {subiendo ? "Sellando PDF..." : "Confirmar y Sellar con QR Tributario"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {uploadStep === "sealing" && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                      <CheckCircle className="h-12 w-12 text-primary" />
                      <p className="text-lg font-medium">Sellando PDF con QR Tributario...</p>
                      <p className="text-sm text-muted-foreground">Generando huella SHA-256 y código QR</p>
                      <Progress value={75} className="w-64 h-2" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right side: PDF preview */}
            {showPreview && pdfPreviewUrl && (
              <div className="w-1/2 space-y-4">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Vista previa
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <iframe
                      src={pdfPreviewUrl}
                      className="w-full rounded-lg border bg-muted"
                      style={{ height: "calc(100vh - 300px)", minHeight: "500px" }}
                      title="Vista previa del PDF"
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
            </TabsContent>

            <TabsContent value="csv">
              <ImportTab
                accept=".csv"
                title="Cargar CSV"
                description="Sube un archivo CSV. Acepta separador ',' o ';', decimales con punto o coma, y BOM UTF-8. Cada factura importada genera automáticamente su huella SHA-256 y código QR de verificación."
              />
            </TabsContent>

            <TabsContent value="json">
              <ImportTab
                accept=".json"
                title="Cargar JSON"
                description="Sube un archivo JSON con un array de facturas. Cada factura importada genera automáticamente su huella SHA-256 y código QR de verificación."
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="registro">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <RegistroFacturas />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* QR Tributario Result Dialog */}
      <Dialog open={!!qrResult} onOpenChange={(open) => !open && setQrResult(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>QR Tributario — Factura {qrResult?.id}</DialogTitle>
            <DialogDescription>
              Código QR de verificación fiscal con huella SHA-256
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg border" id="qr-container">
              <QRCodeSVG
                value={qrResult?.qrUrl ?? ""}
                size={200}
                level="H"
                includeMargin
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Huella: {qrResult?.huella}</p>
              <p className="text-xs text-muted-foreground break-all max-w-[400px]">
                {qrResult?.qrUrl}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const svg = document.querySelector("#qr-container svg");
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const blob = new Blob([svgData], { type: "image/svg+xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `qr-tributario-${qrResult?.id?.replace(/\//g, "-")}.svg`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Descargar QR
              </Button>
              {qrResult?.pdfBase64 && (
                <Button size="sm" onClick={downloadPdf}>
                  <FileText className="h-4 w-4 mr-2" /> Descargar PDF
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
