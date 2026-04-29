import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileUp, Trash2, Loader2, CheckCircle2, XCircle, Play, RotateCcw, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeUUID } from "@/lib/uuid";

type ItemStatus = "pending" | "extracting" | "sealing" | "done" | "error";

interface BulkItem {
  id: string;
  file: File;
  status: ItemStatus;
  message?: string;
  facturaId?: string;
  qrUrl?: string;
  pdfBase64?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function BulkPdfUpload() {
  const [items, setItems] = useState<BulkItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const cancelRef = useRef(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type === "application/pdf");
    const rejected = Array.from(files).length - arr.length;
    if (rejected > 0) toast.error(`${rejected} archivo(s) ignorados (solo PDF)`);
    if (arr.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...arr.map((file) => ({
        id: safeUUID(),
        file,
        status: "pending" as ItemStatus,
      })),
    ]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const removeItem = (id: string) => {
    if (running) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearAll = () => {
    if (running) return;
    setItems([]);
  };

  const updateItem = (id: string, patch: Partial<BulkItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const processOne = async (item: BulkItem, accessToken: string) => {
    // 1. Extract data with AI
    updateItem(item.id, { status: "extracting", message: "Analizando con IA..." });
    const extractForm = new FormData();
    extractForm.append("pdf", item.file);

    const extractRes = await fetch(`${SUPABASE_URL}/functions/v1/extraer-datos-factura`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: extractForm,
    });
    if (!extractRes.ok) {
      const err = await extractRes.json().catch(() => ({}));
      throw new Error(err.error || "Error al extraer datos");
    }
    const { extracted } = await extractRes.json();

    // 2. Seal PDF
    updateItem(item.id, { status: "sealing", message: "Sellando PDF..." });
    const sealForm = new FormData();
    sealForm.append("pdf", item.file);
    sealForm.append("emisorNif", extracted.emisor_nif || "");
    sealForm.append("emisorNombre", extracted.emisor_nombre || "");
    sealForm.append("emisorDireccion", extracted.emisor_direccion || "");
    sealForm.append("clienteNombre", extracted.cliente_nombre || "");
    sealForm.append("clienteNif", extracted.cliente_nif || "");
    sealForm.append("clienteDireccion", extracted.cliente_direccion || "");
    sealForm.append("layoutOrientacion", extracted.layout_orientacion || "vertical");
    sealForm.append("layoutFooterLibre", String(extracted.layout_footer_libre ?? true));
    sealForm.append("baseImponible", String(extracted.base_imponible || 0));
    sealForm.append("totalIva", String(extracted.total_iva || 0));
    sealForm.append("totalIrpf", String(extracted.total_irpf || 0));
    sealForm.append("total", String(extracted.total || 0));
    sealForm.append("descripcion", extracted.descripcion || "");
    sealForm.append("siteUrl", window.location.origin);

    const sealRes = await fetch(`${SUPABASE_URL}/functions/v1/sellar-pdf-tercero`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: sealForm,
    });
    if (!sealRes.ok) {
      const err = await sealRes.json().catch(() => ({}));
      throw new Error(err.error || "Error al sellar el PDF");
    }
    const sealed = await sealRes.json();

    updateItem(item.id, {
      status: "done",
      message: `Sellada: ${sealed.id}`,
      facturaId: sealed.id,
      qrUrl: sealed.qrUrl,
      pdfBase64: sealed.pdfBase64,
    });
  };

  const startProcessing = async () => {
    const pending = items.filter((i) => i.status === "pending" || i.status === "error");
    if (pending.length === 0) {
      toast.info("No hay archivos pendientes");
      return;
    }
    setRunning(true);
    cancelRef.current = false;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("No hay sesión activa");
      setRunning(false);
      return;
    }

    let ok = 0;
    let ko = 0;

    for (const item of pending) {
      if (cancelRef.current) break;
      try {
        await processOne(item, session.access_token);
        ok++;
      } catch (err: any) {
        updateItem(item.id, { status: "error", message: err.message || "Error desconocido" });
        ko++;
      }
    }

    setRunning(false);
    if (ok > 0) toast.success(`${ok} factura(s) sellada(s) correctamente`);
    if (ko > 0) toast.error(`${ko} factura(s) con errores`);
  };

  const cancelProcessing = () => {
    cancelRef.current = true;
    toast.info("Cancelando tras la factura actual...");
  };

  const downloadSealedPdf = (item: BulkItem) => {
    if (!item.pdfBase64) return;
    const binary = atob(item.pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factura-${(item.facturaId || "sellada").replace(/\//g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const errors = items.filter((i) => i.status === "error").length;
  const overall = total === 0 ? 0 : Math.round(((done + errors) / total) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-primary" />
          Carga en Bloque
        </CardTitle>
        <CardDescription>
          Sube varios PDFs a la vez. Cada factura se analizará con IA y se sellará automáticamente con su QR tributario.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-2 text-sm">
            Arrastra varios PDFs aquí o haz clic para seleccionar
          </p>
          <input
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            id="bulk-pdf-upload"
            onChange={handleFileInput}
          />
          <Button variant="outline" asChild disabled={running}>
            <label htmlFor="bulk-pdf-upload" className="cursor-pointer">
              Seleccionar PDFs
            </label>
          </Button>
        </div>

        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {done} / {total} completadas{errors > 0 && ` · ${errors} con error`}
                  </span>
                  <span>{overall}%</span>
                </div>
                <Progress value={overall} className="h-2" />
              </div>
              <div className="flex items-center gap-2">
                {!running ? (
                  <>
                    <Button variant="outline" size="sm" onClick={clearAll} disabled={items.length === 0}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Limpiar
                    </Button>
                    <Button size="sm" onClick={startProcessing}>
                      <Play className="h-4 w-4 mr-1" /> Procesar ({items.filter((i) => i.status === "pending" || i.status === "error").length})
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="destructive" onClick={cancelProcessing}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>

            <div className="border rounded-lg divide-y max-h-[420px] overflow-auto">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 text-sm">
                  <StatusIcon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(item.file.size / 1024).toFixed(0)} KB
                      {item.message && ` · ${item.message}`}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  {item.status === "done" && item.pdfBase64 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadSealedPdf(item)}
                      title="Descargar PDF sellado"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                  {!running && item.status !== "done" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />;
  if (status === "error") return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
  if (status === "extracting" || status === "sealing")
    return <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />;
  return <FileUp className="h-5 w-5 text-muted-foreground shrink-0" />;
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pendiente", variant: "outline" },
    extracting: { label: "Analizando", variant: "secondary" },
    sealing: { label: "Sellando", variant: "secondary" },
    done: { label: "Sellada", variant: "default" },
    error: { label: "Error", variant: "destructive" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant} className="shrink-0">{label}</Badge>;
}
