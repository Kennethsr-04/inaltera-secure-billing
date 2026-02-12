import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FilePlus, Upload, Plus, Trash2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { mockClientes, mockProductos } from "@/lib/mock-data";

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

export default function Facturacion() {
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
      // await api.post('/factura/emitir', { clienteId, tipoFactura, regimenIva, lineas, observaciones });
      await new Promise((r) => setTimeout(r, 1200));
      toast.success("Factura generada y sellada correctamente. ID: F-2026/004");
      // Reset form
      setClienteId("");
      setLineas([emptyLinea()]);
      setObservaciones("");
    } catch {
      toast.error("Error al generar la factura");
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
      // const formData = new FormData();
      // formData.append('file', pdfFile);
      // await api.postFormData('/factura/cargar_pdf', formData);
      await new Promise((r) => setTimeout(r, 1500));
      toast.success("PDF cargado y sellado con QR correctamente");
      setPdfFile(null);
    } catch {
      toast.error("Error al cargar el PDF");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Facturación y Carga</h1>
        <p className="text-muted-foreground">Crea facturas o carga PDFs de terceros para sellar</p>
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
                    {emitiendo ? "Generando y sellando..." : "Generar y Sellar Factura"}
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
                Sube un PDF de factura para sellarlo con código QR de trazabilidad
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
                {subiendo ? "Cargando y sellando..." : "Cargar y Sellar PDF"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
