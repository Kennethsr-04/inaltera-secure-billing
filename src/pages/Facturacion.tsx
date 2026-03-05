import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FilePlus, Upload, Plus, Trash2, FileUp, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { mockClientes, mockProductos } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

export default function Facturacion() {
  const { token } = useAuth();

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

  const selectProducto = (lineaId: string, productoId: string) => {
    const prod = mockProductos.find((p) => p.id === productoId);
    if (prod) {
      setLineas(
        lineas.map((l) =>
          l.id === lineaId
            ? { ...l, productoId, descripcion: prod.descripcion, precioUnitario: prod.precio, tipoIva: prod.iva }
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
      const cliente = mockClientes.find((c) => c.id === clienteId);
      if (!cliente) throw new Error("Cliente no encontrado");

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
    } else {
      toast.error("Solo se aceptan archivos PDF");
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else {
      toast.error("Solo se aceptan archivos PDF");
    }
  };

  const handleSubirPdf = async () => {
    if (!pdfFile) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      formData.append("emisorNif", "");
      formData.append("emisorNombre", "");

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
      setPdfFile(null);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar el PDF");
    } finally {
      setSubiendo(false);
    }
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
            Cargar PDF
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
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockClientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre} ({c.nif})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        <TableHead className="w-24">Precio</TableHead>
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
                                  {mockProductos.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.descripcion}
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
          <Card>
            <CardHeader>
              <CardTitle>Cargar Factura de Terceros</CardTitle>
              <CardDescription>
                Sube un PDF de factura para sellarlo con código QR tributario de trazabilidad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Arrastra un archivo PDF aquí o haz clic para seleccionar
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  id="pdf-upload"
                  onChange={handleFileInput}
                />
                <Button variant="outline" asChild>
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    Seleccionar PDF
                  </label>
                </Button>
              </div>

              {pdfFile && (
                <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{pdfFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(pdfFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPdfFile(null)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                disabled={!pdfFile || subiendo}
                onClick={handleSubirPdf}
              >
                {subiendo ? "Cargando y sellando..." : "Cargar y Sellar con QR Tributario"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR VeriFactu Result Dialog */}
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
