import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ESTADOS, EstadoBadge } from "./EstadoTimeline";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estadoActual: string;
  onConfirm: (nuevoEstado: string, nota: string) => Promise<void>;
}

export function CambiarEstadoDialog({ open, onOpenChange, estadoActual, onConfirm }: Props) {
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!nuevoEstado || nuevoEstado === estadoActual) return;
    setSaving(true);
    try {
      await onConfirm(nuevoEstado, nota);
      setNuevoEstado("");
      setNota("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar estado de factura</DialogTitle>
          <DialogDescription>
            Estado actual: <EstadoBadge estado={estadoActual} />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nuevo estado</Label>
            <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.filter((e) => e.value !== estadoActual).map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nota (opcional)</Label>
            <Textarea
              placeholder="Añade una nota sobre este cambio..."
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!nuevoEstado || nuevoEstado === estadoActual || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
