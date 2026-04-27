import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";

export interface LineaFactura {
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

export interface ServicioOption {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  iva: number;
}

interface LineaItemProps {
  linea: LineaFactura;
  servicios: ServicioOption[];
  canRemove: boolean;
  onUpdate: (id: string, field: keyof LineaFactura, value: any) => void;
  onSelectProducto: (lineaId: string, servicioId: string) => void;
  onRemove: (id: string) => void;
}

const computeSubtotal = (l: LineaFactura) =>
  l.cantidad * l.precioUnitario * (1 - l.descuento / 100);

export const LineaRow = memo(function LineaRow({
  linea,
  servicios,
  canRemove,
  onUpdate,
  onSelectProducto,
  onRemove,
}: LineaItemProps) {
  const subtotal = computeSubtotal(linea);
  return (
    <TableRow>
      <TableCell>
        <Select value={linea.productoId} onValueChange={(v) => onSelectProducto(linea.id, v)}>
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
        <Input type="number" min="1" className="h-8 text-xs w-16" value={linea.cantidad}
          onChange={(e) => onUpdate(linea.id, "cantidad", Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input type="number" min="0" step="0.01" className="h-8 text-xs w-20" value={linea.precioUnitario}
          onChange={(e) => onUpdate(linea.id, "precioUnitario", Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input type="number" min="0" max="100" className="h-8 text-xs w-16" value={linea.descuento}
          onChange={(e) => onUpdate(linea.id, "descuento", Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Select value={String(linea.tipoIva)} onValueChange={(v) => onUpdate(linea.id, "tipoIva", Number(v))}>
          <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="21">21%</SelectItem>
            <SelectItem value="10">10%</SelectItem>
            <SelectItem value="4">4%</SelectItem>
            <SelectItem value="0">0%</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input type="number" min="0" max="100" className="h-8 text-xs w-16" value={linea.irpf}
          onChange={(e) => onUpdate(linea.id, "irpf", Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input type="number" min="0" max="100" className="h-8 text-xs w-16" value={linea.recargoEquivalencia}
          onChange={(e) => onUpdate(linea.id, "recargoEquivalencia", Number(e.target.value))} />
      </TableCell>
      <TableCell className="text-right font-medium text-sm">{subtotal.toFixed(2)}€</TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(linea.id)}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
});

export const LineaCard = memo(function LineaCard({
  linea,
  index,
  servicios,
  canRemove,
  onUpdate,
  onSelectProducto,
  onRemove,
}: LineaItemProps & { index: number }) {
  const subtotal = computeSubtotal(linea);
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Línea {index + 1}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(linea.id)}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Producto / Descripción</Label>
        <Select value={linea.productoId} onValueChange={(v) => onSelectProducto(linea.id, v)}>
          <SelectTrigger className="h-9 text-sm">
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
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Cant.</Label>
          <Input type="number" min="1" className="h-9 text-sm" value={linea.cantidad}
            onChange={(e) => onUpdate(linea.id, "cantidad", Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Base Imponible</Label>
          <Input type="number" min="0" step="0.01" className="h-9 text-sm" value={linea.precioUnitario}
            onChange={(e) => onUpdate(linea.id, "precioUnitario", Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Dto. %</Label>
          <Input type="number" min="0" max="100" className="h-9 text-sm" value={linea.descuento}
            onChange={(e) => onUpdate(linea.id, "descuento", Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">IVA %</Label>
          <Select value={String(linea.tipoIva)} onValueChange={(v) => onUpdate(linea.id, "tipoIva", Number(v))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="21">21%</SelectItem>
              <SelectItem value="10">10%</SelectItem>
              <SelectItem value="4">4%</SelectItem>
              <SelectItem value="0">0%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">IRPF %</Label>
          <Input type="number" min="0" max="100" className="h-9 text-sm" value={linea.irpf}
            onChange={(e) => onUpdate(linea.id, "irpf", Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">R.E. %</Label>
          <Input type="number" min="0" max="100" className="h-9 text-sm" value={linea.recargoEquivalencia}
            onChange={(e) => onUpdate(linea.id, "recargoEquivalencia", Number(e.target.value))} />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <span className="font-semibold">{subtotal.toFixed(2)}€</span>
      </div>
    </div>
  );
});
