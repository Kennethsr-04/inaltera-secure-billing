import { memo } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { EstadoBadge } from "@/components/factura/EstadoTimeline";
import type { Tables } from "@/integrations/supabase/types";

type Factura = Tables<"facturas">;

interface Props {
  factura: Factura;
  onRestore: (f: Factura) => void;
  onDelete: (f: Factura) => void;
}

export const PapeleraCard = memo(function PapeleraCard({ factura: f, onRestore, onDelete }: Props) {
  const deletedAt = (f as any).deleted_at;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 opacity-90">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium">{f.numero_factura}</p>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{f.cliente_nombre}</p>
        </div>
        <EstadoBadge estado={f.estado} />
      </div>
      <div className="flex items-center justify-between text-sm pt-2 border-t">
        <div>
          <p className="text-xs text-muted-foreground">Emitida</p>
          <p>{format(new Date(f.created_at), "dd/MM/yyyy")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold">{Number(f.total).toFixed(2)} €</p>
        </div>
      </div>
      {deletedAt && (
        <p className="text-xs text-muted-foreground">
          Eliminada el {format(new Date(deletedAt), "dd/MM/yyyy HH:mm")}
        </p>
      )}
      <div className="flex gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => onRestore(f)}>
          <RotateCcw className="h-4 w-4" /> Restaurar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 text-destructive hover:text-destructive"
          onClick={() => onDelete(f)}
        >
          <Trash2 className="h-4 w-4" /> Eliminar
        </Button>
      </div>
    </div>
  );
});
