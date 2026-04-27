import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export interface ServicioRow {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  iva: number;
}

interface Props {
  servicio: ServicioRow;
  onEdit: (s: ServicioRow) => void;
  onDelete: (id: string) => void;
}

export const ServicioCard = memo(function ServicioCard({ servicio: s, onEdit, onDelete }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{s.nombre}</p>
          {s.descripcion && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{s.descripcion}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => onEdit(s)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(s.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm pt-2 border-t">
        <div>
          <p className="text-xs text-muted-foreground">Base Imponible</p>
          <p className="font-medium">{Number(s.precio).toFixed(2)} €</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">IVA</p>
          <p className="font-medium">{s.iva}%</p>
        </div>
      </div>
    </div>
  );
});
