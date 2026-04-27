import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ServicioCard } from "@/components/servicios/ServicioCard";

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  iva: number;
}

const emptyServicio = { nombre: "", descripcion: "", precio: 0, iva: 21 };

export default function Servicios() {
  const { user } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Servicio | null>(null);
  const [form, setForm] = useState(emptyServicio);
  const [saving, setSaving] = useState(false);

  const loadServicios = async () => {
    const { data } = await supabase
      .from("servicios")
      .select("*")
      .order("nombre");
    if (data) setServicios(data as Servicio[]);
    setLoading(false);
  };

  useEffect(() => { loadServicios(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyServicio);
    setDialogOpen(true);
  };

  const openEdit = (s: Servicio) => {
    setEditing(s);
    setForm({ nombre: s.nombre, descripcion: s.descripcion, precio: s.precio, iva: s.iva });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (form.precio < 0) { toast.error("El precio no puede ser negativo"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("servicios")
          .update({ nombre: form.nombre, descripcion: form.descripcion, precio: form.precio, iva: form.iva, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Servicio actualizado");
      } else {
        const { error } = await supabase
          .from("servicios")
          .insert({ user_id: userId!, nombre: form.nombre, descripcion: form.descripcion, precio: form.precio, iva: form.iva });
        if (error) throw error;
        toast.success("Servicio creado");
      }
      setDialogOpen(false);
      loadServicios();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("servicios").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Servicio eliminado");
    loadServicios();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Servicios</h1>
          <p className="text-muted-foreground">Gestiona los servicios que ofreces para incluirlos en tus facturas</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Servicio
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Catálogo de Servicios
          </CardTitle>
          <CardDescription>Lista de servicios disponibles para facturar</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : servicios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No hay servicios todavía</p>
              <p className="text-sm">Crea tu primer servicio para empezar a facturar</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Base Imponible (€)</TableHead>
                      <TableHead className="text-right">IVA (%)</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicios.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">{s.descripcion || "—"}</TableCell>
                        <TableCell className="text-right">{Number(s.precio).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{s.iva}%</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive">
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
                {servicios.map((s) => (
                  <div key={s.id} className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{s.nombre}</p>
                        {s.descripcion && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{s.descripcion}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive">
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
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc-nombre">Nombre *</Label>
              <Input id="svc-nombre" placeholder="Consultoría IT" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Descripción</Label>
              <Input id="svc-desc" placeholder="Descripción del servicio" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="svc-precio">Base Imponible (€)</Label>
                <Input id="svc-precio" type="number" min="0" step="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-iva">IVA (%)</Label>
                <Input id="svc-iva" type="number" min="0" max="100" value={form.iva} onChange={(e) => setForm({ ...form, iva: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
