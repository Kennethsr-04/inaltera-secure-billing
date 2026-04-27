import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Trash2, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EstadoBadge } from "@/components/factura/EstadoTimeline";
import { PapeleraCard } from "@/components/factura/PapeleraCard";
import type { Tables } from "@/integrations/supabase/types";

type Factura = Tables<"facturas">;

export default function Papelera() {
  const { user } = useAuth();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Factura | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTrashed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("facturas")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at" as any, { ascending: false });
    if (error) {
      toast.error("Error al cargar la papelera");
    } else {
      setFacturas(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTrashed(); }, [fetchTrashed]);

  const restore = useCallback(async (factura: Factura) => {
    const { error } = await supabase
      .from("facturas")
      .update({ deleted_at: null } as any)
      .eq("id", factura.id);
    if (error) {
      toast.error("Error al restaurar");
    } else {
      toast.success(`Factura ${factura.numero_factura} restaurada`);
      fetchTrashed();
    }
  }, [fetchTrashed]);

  const askDelete = useCallback((factura: Factura) => setConfirmDelete(factura), []);

  const permanentDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    // Delete associated PDF from storage if exists
    if (confirmDelete.pdf_path) {
      await supabase.storage.from("facturas-pdf").remove([confirmDelete.pdf_path]);
    }
    // Delete status logs
    await supabase.from("factura_estados_log").delete().eq("factura_id", confirmDelete.id);
    // Delete the invoice permanently
    const { error } = await supabase.from("facturas").delete().eq("id", confirmDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Error al eliminar permanentemente");
    } else {
      toast.success(`Factura ${confirmDelete.numero_factura} eliminada permanentemente`);
      setConfirmDelete(null);
      fetchTrashed();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Papelera de Reciclaje</h1>
        <p className="text-muted-foreground">Facturas eliminadas. Puedes restaurarlas o eliminarlas permanentemente.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "Cargando..." : `${facturas.length} factura${facturas.length !== 1 ? "s" : ""} en la papelera`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : facturas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>La papelera está vacía</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha emisión</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Total (€)</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Eliminada el</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturas.map((f) => (
                      <TableRow key={f.id} className="opacity-75">
                        <TableCell className="text-sm">{format(new Date(f.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-mono text-sm">{f.numero_factura}</TableCell>
                        <TableCell className="text-sm">{f.cliente_nombre}</TableCell>
                        <TableCell className="text-right font-medium">{Number(f.total).toFixed(2)}</TableCell>
                        <TableCell><EstadoBadge estado={f.estado} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(f as any).deleted_at ? format(new Date((f as any).deleted_at), "dd/MM/yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" title="Restaurar" onClick={() => restore(f)}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Eliminar permanentemente" onClick={() => setConfirmDelete(f)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {facturas.map((f) => (
                  <PapeleraCard key={f.id} factura={f} onRestore={restore} onDelete={askDelete} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirm permanent delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar permanentemente
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la factura <strong>{confirmDelete?.numero_factura}</strong> de forma permanente? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={permanentDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Eliminar permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
