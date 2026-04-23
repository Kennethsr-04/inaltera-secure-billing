import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, FileJson, FileSpreadsheet, FileText, Database, Loader2, CheckCircle2, AlertCircle, ArrowUpDown, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Factura = Tables<"facturas">;

// ─── CSV helpers ────────────────────────────────────────────
function facturasToCSV(facturas: Factura[]): string {
  const headers = [
    "numero_factura", "tipo", "origen", "fecha", "cliente_nombre", "cliente_nif",
    "cliente_direccion", "base_imponible", "total_iva", "total_irpf",
    "total_recargo", "total", "estado", "regimen_iva", "huella_hash"
  ];
  const rows = facturas.map(f => [
    f.numero_factura, f.tipo, f.origen,
    format(new Date(f.created_at), "yyyy-MM-dd"),
    f.cliente_nombre, f.cliente_nif, f.cliente_direccion ?? "",
    f.base_imponible, f.total_iva, f.total_irpf, f.total_recargo,
    f.total, f.estado, f.regimen_iva, f.huella_hash ?? ""
  ]);
  return [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
}

function facturasToJSON(facturas: Factura[]): string {
  return JSON.stringify(
    facturas.map(f => ({
      numero_factura: f.numero_factura,
      tipo: f.tipo,
      origen: f.origen,
      fecha: f.created_at,
      cliente: { nombre: f.cliente_nombre, nif: f.cliente_nif, direccion: f.cliente_direccion },
      importes: {
        base_imponible: f.base_imponible,
        total_iva: f.total_iva,
        total_irpf: f.total_irpf,
        total_recargo: f.total_recargo,
        total: f.total,
      },
      estado: f.estado,
      regimen_iva: f.regimen_iva,
      verificacion: { huella_hash: f.huella_hash, qr_url: f.qr_url },
    })),
    null, 2
  );
}

// Robust CSV parser: handles BOM, CR/LF, quoted fields, escaped quotes ("")
// and auto-detects delimiter (',' or ';').
function parseCSV(rawText: string): Record<string, string>[] {
  // Strip UTF-8 BOM
  let text = rawText.replace(/^\uFEFF/, "");
  if (!text.trim()) return [];

  // Detect delimiter from header line
  const firstLineEnd = text.search(/\r?\n/);
  const headerLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const semiCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  const delim = semiCount > commaCount ? ";" : ",";

  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { current.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        current.push(field); field = "";
        if (current.some(c => c !== "")) rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  // flush
  if (field !== "" || current.length) {
    current.push(field);
    if (current.some(c => c !== "")) rows.push(current);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, "").trim().toLowerCase());
  return rows.slice(1).map(values => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? "").trim(); });
    return obj;
  });
}

// Parse number tolerating European format ("1.234,56" or "1234,56" or "1234.56")
function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  let s = String(v).trim().replace(/\s|€|EUR/gi, "");
  if (s === "") return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Assume '.' = thousands, ',' = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// ─── Export component ───────────────────────────────────────
function ExportTab() {
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "pdf">("csv");

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("facturas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const facturas = data as Factura[];
      if (facturas.length === 0) {
        toast.info("No hay facturas para exportar");
        return;
      }

      let blob: Blob;
      let filename: string;

      if (exportFormat === "csv") {
        blob = new Blob([facturasToCSV(facturas)], { type: "text/csv;charset=utf-8;" });
        filename = `facturas-export-${format(new Date(), "yyyyMMdd")}.csv`;
      } else if (exportFormat === "json") {
        blob = new Blob([facturasToJSON(facturas)], { type: "application/json" });
        filename = `facturas-export-${format(new Date(), "yyyyMMdd")}.json`;
      } else {
        // PDF summary — generate a simple HTML-based printable summary
        const html = generatePdfHtml(facturas);
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
        setLoading(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${facturas.length} facturas exportadas en formato ${exportFormat.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Error al exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Exportar Facturas
          </CardTitle>
          <CardDescription>Descarga todas tus facturas en el formato que prefieras</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setExportFormat("csv")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${exportFormat === "csv" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <FileSpreadsheet className={`h-8 w-8 ${exportFormat === "csv" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="font-medium text-sm">CSV / Excel</span>
              <span className="text-xs text-muted-foreground">Compatible con hojas de cálculo</span>
            </button>
            <button
              onClick={() => setExportFormat("json")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${exportFormat === "json" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <FileJson className={`h-8 w-8 ${exportFormat === "json" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="font-medium text-sm">JSON</span>
              <span className="text-xs text-muted-foreground">Formato estructurado para integraciones</span>
            </button>
            <button
              onClick={() => setExportFormat("pdf")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${exportFormat === "pdf" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <FileText className={`h-8 w-8 ${exportFormat === "pdf" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="font-medium text-sm">PDF Resumen</span>
              <span className="text-xs text-muted-foreground">Informe imprimible de facturas</span>
            </button>
          </div>
          <Button onClick={handleExport} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Exportar {exportFormat.toUpperCase()}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Import component ───────────────────────────────────────
function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (f.name.endsWith(".json")) {
        try {
          const data = JSON.parse(text);
          const arr = Array.isArray(data) ? data : [data];
          setParsedRows(arr.map((item: any) => ({
            numero_factura: item.numero_factura ?? "",
            tipo: item.tipo ?? "completa",
            cliente_nombre: item.cliente?.nombre ?? item.cliente_nombre ?? "",
            cliente_nif: item.cliente?.nif ?? item.cliente_nif ?? "",
            cliente_direccion: item.cliente?.direccion ?? item.cliente_direccion ?? "",
            base_imponible: String(item.importes?.base_imponible ?? item.base_imponible ?? 0),
            total_iva: String(item.importes?.total_iva ?? item.total_iva ?? 0),
            total_irpf: String(item.importes?.total_irpf ?? item.total_irpf ?? 0),
            total_recargo: String(item.importes?.total_recargo ?? item.total_recargo ?? 0),
            total: String(item.importes?.total ?? item.total ?? 0),
            regimen_iva: item.regimen_iva ?? "general",
          })));
        } catch {
          toast.error("JSON inválido");
          setParsedRows([]);
        }
      } else {
        setParsedRows(parseCSV(text));
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("No autenticado"); setImporting(false); return; }

    let success = 0;
    let errors = 0;

    for (const row of parsedRows) {
      const { error } = await supabase.from("facturas").insert({
        user_id: user.id,
        numero_factura: row.numero_factura || `IMP-${Date.now()}`,
        tipo: row.tipo || "completa",
        origen: "importada",
        cliente_nombre: row.cliente_nombre || "Sin nombre",
        cliente_nif: row.cliente_nif || "00000000X",
        cliente_direccion: row.cliente_direccion || null,
        base_imponible: parseFloat(row.base_imponible) || 0,
        total_iva: parseFloat(row.total_iva) || 0,
        total_irpf: parseFloat(row.total_irpf) || 0,
        total_recargo: parseFloat(row.total_recargo) || 0,
        total: parseFloat(row.total) || 0,
        regimen_iva: row.regimen_iva || "general",
        estado: "importada",
      });
      if (error) { errors++; console.error(error); } else { success++; }
    }

    setResult({ success, errors });
    setImporting(false);
    if (success > 0) toast.success(`${success} facturas importadas correctamente`);
    if (errors > 0) toast.error(`${errors} facturas con error`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar Facturas
          </CardTitle>
          <CardDescription>Sube un archivo CSV o JSON con datos de facturas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">{file ? file.name : "Haz clic o arrastra un archivo CSV / JSON"}</p>
            <p className="text-xs text-muted-foreground mt-1">Formatos soportados: .csv, .json</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {parsedRows.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{parsedRows.length} registros detectados</Badge>
                {result && (
                  <div className="flex gap-2">
                    <Badge className="bg-success/10 text-success border-success/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />{result.success} OK
                    </Badge>
                    {result.errors > 0 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />{result.errors} errores
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Factura</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{row.numero_factura}</TableCell>
                        <TableCell className="text-sm">{row.cliente_nombre}</TableCell>
                        <TableCell className="text-sm">{row.cliente_nif}</TableCell>
                        <TableCell className="text-right">{parseFloat(row.total || "0").toFixed(2)}€</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedRows.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 20 de {parsedRows.length} registros
                  </p>
                )}
              </div>

              <Button onClick={handleImport} disabled={importing || !!result}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Importar {parsedRows.length} facturas
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── External DB connection component ───────────────────────
function ConexionExternaTab() {
  const [dbType, setDbType] = useState("postgresql");
  const [nombre, setNombre] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [dbName, setDbName] = useState("");
  const [dbUser, setDbUser] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [conexiones, setConexiones] = useState<any[]>([]);
  const [loadingConexiones, setLoadingConexiones] = useState(true);

  const fetchConexiones = async () => {
    setLoadingConexiones(true);
    const { data, error } = await supabase.from("conexiones_bd").select("*").order("created_at", { ascending: false });
    if (!error && data) setConexiones(data);
    setLoadingConexiones(false);
  };

  useState(() => { fetchConexiones(); });

  const handleSave = async () => {
    if (!host || !dbName || !dbUser) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("No autenticado"); setSaving(false); return; }

    const { error } = await supabase.from("conexiones_bd").insert({
      user_id: user.id,
      nombre: nombre || `${dbType} - ${host}`,
      tipo_bd: dbType,
      host,
      puerto: port,
      nombre_bd: dbName,
      usuario_bd: dbUser,
      password_bd: dbPassword || null,
      activa: true,
    } as any);

    setSaving(false);
    if (error) {
      toast.error("Error al guardar la conexión");
      console.error(error);
    } else {
      toast.success("Conexión guardada correctamente");
      setNombre(""); setHost(""); setPort("5432"); setDbName(""); setDbUser(""); setDbPassword("");
      fetchConexiones();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("conexiones_bd").delete().eq("id", id);
    if (error) toast.error("Error al eliminar");
    else { toast.success("Conexión eliminada"); fetchConexiones(); }
  };

  const handleToggle = async (id: string, activa: boolean) => {
    const { error } = await supabase.from("conexiones_bd").update({ activa: !activa } as any).eq("id", id);
    if (!error) fetchConexiones();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Nueva Conexión a Base de Datos
          </CardTitle>
          <CardDescription>Configura y guarda conexiones a bases de datos externas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de la conexión</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Mi base de datos" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Base de Datos</Label>
              <Select value={dbType} onValueChange={setDbType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="mariadb">MariaDB</SelectItem>
                  <SelectItem value="mssql">SQL Server</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Host *</Label>
              <Input value={host} onChange={e => setHost(e.target.value)} placeholder="db.ejemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Puerto</Label>
              <Input value={port} onChange={e => setPort(e.target.value)} placeholder="5432" />
            </div>
            <div className="space-y-2">
              <Label>Nombre de la Base de Datos *</Label>
              <Input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="mi_base_datos" />
            </div>
            <div className="space-y-2">
              <Label>Usuario *</Label>
              <Input value={dbUser} onChange={e => setDbUser(e.target.value)} placeholder="usuario" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Contraseña</Label>
              <Input type="password" value={dbPassword} onChange={e => setDbPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
            Guardar Conexión
          </Button>
        </CardContent>
      </Card>

      {/* Saved connections list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conexiones Guardadas</CardTitle>
          <CardDescription>Gestiona tus conexiones a bases de datos externas</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConexiones ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conexiones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay conexiones guardadas</p>
          ) : (
            <div className="space-y-3">
              {conexiones.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">{c.tipo_bd} · {c.host}:{c.puerto} · {c.nombre_bd}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={c.activa ? "bg-success/10 text-success border-success/20 cursor-pointer" : "cursor-pointer"}
                      variant={c.activa ? "outline" : "secondary"}
                      onClick={() => handleToggle(c.id, c.activa)}
                    >
                      {c.activa ? "Activa" : "Inactiva"}
                    </Badge>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PDF HTML generator ─────────────────────────────────────
function generatePdfHtml(facturas: Factura[]): string {
  const totalGeneral = facturas.reduce((s, f) => s + Number(f.total), 0);
  const rows = facturas.map(f => `
    <tr>
      <td>${format(new Date(f.created_at), "dd/MM/yyyy")}</td>
      <td>${f.numero_factura}</td>
      <td>${f.cliente_nombre}</td>
      <td>${f.cliente_nif}</td>
      <td style="text-align:right">${Number(f.base_imponible).toFixed(2)}€</td>
      <td style="text-align:right">${Number(f.total_iva).toFixed(2)}€</td>
      <td style="text-align:right;font-weight:600">${Number(f.total).toFixed(2)}€</td>
      <td>${f.estado}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resumen de Facturas — INALTERA</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:40px;color:#1a1a2e}
    h1{color:#007bff;font-size:24px;margin-bottom:4px}
    .sub{color:#666;margin-bottom:24px;font-size:13px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f0f4ff;padding:8px;text-align:left;border-bottom:2px solid #007bff}
    td{padding:6px 8px;border-bottom:1px solid #eee}
    .total-row{font-size:14px;font-weight:700;margin-top:16px;text-align:right}
  </style></head><body>
    <h1>INALTERA — Resumen de Facturas</h1>
    <p class="sub">Generado el ${format(new Date(), "dd/MM/yyyy HH:mm")} · ${facturas.length} facturas</p>
    <table><thead><tr>
      <th>Fecha</th><th>Nº Factura</th><th>Cliente</th><th>NIF</th>
      <th style="text-align:right">Base</th><th style="text-align:right">IVA</th>
      <th style="text-align:right">Total</th><th>Estado</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <p class="total-row">Total General: ${totalGeneral.toFixed(2)}€</p>
  </body></html>`;
}

// ─── Main page ──────────────────────────────────────────────
export default function Datos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Importar / Exportar Datos</h1>
        <p className="text-muted-foreground">Conecta con bases de datos externas o transfiere datos en CSV, JSON o PDF</p>
      </div>

      <Tabs defaultValue="exportar" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="exportar" className="gap-1.5">
            <Download className="h-4 w-4" /> Exportar
          </TabsTrigger>
          <TabsTrigger value="importar" className="gap-1.5">
            <Upload className="h-4 w-4" /> Importar
          </TabsTrigger>
          <TabsTrigger value="conexion" className="gap-1.5">
            <Database className="h-4 w-4" /> BD Externa
          </TabsTrigger>
        </TabsList>
        <TabsContent value="exportar"><ExportTab /></TabsContent>
        <TabsContent value="importar"><ImportTab /></TabsContent>
        <TabsContent value="conexion"><ConexionExternaTab /></TabsContent>
      </Tabs>
    </div>
  );
}
