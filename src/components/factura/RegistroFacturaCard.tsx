import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Eye, ArrowRightLeft, History, FileText, FileCode, Trash2, QrCode } from "lucide-react";
import { format } from "date-fns";
import { EstadoBadge } from "@/components/factura/EstadoTimeline";
import type { Tables } from "@/integrations/supabase/types";

type Factura = Tables<"facturas">;

interface Props {
  factura: Factura;
  onShowQr: (f: Factura) => void;
  onViewPdf: (f: Factura) => void;
  onChangeEstado: (f: Factura) => void;
  onShowHistorial: (f: Factura) => void;
  onDownloadPdf: (f: Factura) => void;
  onDownloadJson: (f: Factura) => void;
  onMoveToTrash: (f: Factura) => void;
}

export const RegistroFacturaCard = memo(function RegistroFacturaCard({
  factura: f,
  onShowQr,
  onViewPdf,
  onChangeEstado,
  onShowHistorial,
  onDownloadPdf,
  onDownloadJson,
  onMoveToTrash,
}: Props) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium">{f.numero_factura}</p>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{f.cliente_nombre}</p>
        </div>
        <EstadoBadge estado={f.estado} />
      </div>
      <div className="flex items-center justify-between text-sm pt-2 border-t">
        <div>
          <p className="text-xs text-muted-foreground">Fecha</p>
          <p>{format(new Date(f.created_at), "dd/MM/yyyy")}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Tipo</p>
          <EstadoBadge estado={f.origen === "elaborada" ? "emitida" : "cargada"} />
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold">{Number(f.total).toFixed(2)} €</p>
        </div>
      </div>
      {f.qr_url && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-primary hover:text-primary"
          onClick={() => onShowQr(f)}
        >
          <QrCode className="h-4 w-4" /> Ver QR Tributario
        </Button>
      )}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onViewPdf(f)} disabled={!f.pdf_path}>
          <Eye className="h-4 w-4" /> Ver
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onChangeEstado(f)}>
          <ArrowRightLeft className="h-4 w-4" /> Estado
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onShowHistorial(f)}>
          <History className="h-4 w-4" /> Historial
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onDownloadPdf(f)}>
          <FileText className="h-4 w-4" /> PDF
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onDownloadJson(f)}>
          <FileCode className="h-4 w-4" /> JSON
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() => onMoveToTrash(f)}
        >
          <Trash2 className="h-4 w-4" /> Borrar
        </Button>
      </div>
    </div>
  );
});
