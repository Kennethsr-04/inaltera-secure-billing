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
import { Download, Upload, FileJson, FileSpreadsheet, FileText, Database, Loader2, CheckCircle2, AlertCircle, ArrowUpDown, Link2, QrCode, ShieldAlert } from "lucide-react";
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
type NormalizedRow = {
  numero_factura: string;
  tipo: string;
  cliente_nombre: string;
  cliente_nif: string;
  cliente_direccion: string | null;
  base_imponible: number;
  total_iva: number;
  total_irpf: number;
  total_recargo: number;
  total: number;
  regimen_iva: string;
};

const VALID_TIPOS = ["completa", "simplificada", "rectificativa"];

function pick(row: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
    const lower = k.toLowerCase();
    if (row[lower] !== undefined && row[lower] !== null && row[lower] !== "") return row[lower];
  }
  return "";
}

// Normalize a header/key for fuzzy matching:
// lowercase, strip accents, drop non-alphanumerics → "Nº Factura" => "nfactura"
function normKey(s: string): string {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Detect the invoice number from any of its many possible header variants.
// Recognises: numero_factura, num_factura, nº factura, n° factura, nro, no.,
// id, id_factura, factura_id, invoice, invoice_id, invoice_number, invoice_no,
// ref, referencia, reference, codigo, code, folio, serie+numero, etc.
function detectInvoiceNumber(row: Record<string, any>): string {
  // 1) Direct + canonical aliases (highest priority)
  const direct = pick(
    row,
    "numero_factura", "num_factura", "n_factura", "nro_factura",
    "numero", "nro", "num", "no", "n",
    "id_factura", "factura_id", "id", "uuid",
    "invoice", "invoice_id", "invoice_no", "invoice_number", "invoicenumber", "invoiceid",
    "ref", "referencia", "reference", "ref_factura",
    "codigo", "codigo_factura", "code",
    "folio", "folio_factura", "documento", "doc", "doc_id", "n_documento"
  );
  if (direct) return String(direct).trim();

  // 2) Fuzzy match on normalized header names
  const scored: { key: string; value: any; score: number }[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null || value === "") continue;
    const nk = normKey(key);
    let score = 0;

    if (nk.includes("factura") || nk.includes("invoice") || nk.includes("folio")) score += 5;
    if (/^(n|no|num|nro|nfactura|nrofactura)$/.test(nk)) score += 4;
    if (nk.includes("numero") || nk.startsWith("num")) score += 3;
    if (nk === "id" || nk.endsWith("id") || nk.startsWith("id")) score += 2;
    if (nk.includes("ref") || nk.includes("codigo") || nk.includes("code")) score += 2;
    if (nk.includes("documento") || nk.startsWith("doc")) score += 1;

    // Penalise fields that are clearly not the invoice number
    if (nk.includes("cliente") || nk.includes("client") ||
        nk.includes("nif") || nk.includes("cif") || nk.includes("dni") ||
        nk.includes("user") || nk.includes("usuario") ||
        nk.includes("fecha") || nk.includes("date") ||
        nk.includes("total") || nk.includes("base") || nk.includes("iva") ||
        nk.includes("irpf") || nk.includes("importe") || nk.includes("amount")) {
      score -= 5;
    }

    if (score > 0) scored.push({ key, value, score });
  }

  if (scored.length === 0) return "";
  scored.sort((a, b) => b.score - a.score);
  const value = String(scored[0].value).trim();

  // 3) Optional serie/series prefix concatenation (e.g. "A" + "2024/001" → "A-2024/001")
  const serie = pick(row, "serie", "series", "serie_factura", "prefix", "prefijo");
  if (serie && !value.toLowerCase().includes(String(serie).toLowerCase())) {
    return `${String(serie).trim()}-${value}`;
  }
  return value;
}

// ─── Smart amount detection ──────────────────────────────────
// Detects monetary fields by matching a wide range of header variants
// and using fuzzy + heuristic scoring. Returns 0 when nothing matches.

type AmountKind = "total" | "iva" | "base" | "irpf" | "recargo";

// Direct alias map per kind (checked first, highest priority)
const AMOUNT_ALIASES: Record<AmountKind, string[]> = {
  total: [
    "total", "total_factura", "totalfactura", "total_general", "totalgeneral",
    "total_a_pagar", "totalapagar", "total_pagar", "totalpagar",
    "importe_total", "importetotal", "import_total", "imp_total",
    "importe", "importe_factura", "importefactura",
    "monto", "monto_total", "montototal", "monto_factura",
    "amount", "amount_total", "totalamount", "total_amount",
    "grand_total", "grandtotal", "total_con_iva", "totalconiva",
    "precio_total", "preciototal", "suma_total", "sumatotal",
    "valor_total", "valortotal", "factura_total",
    "total_eur", "totaleur", "total_euros", "totaleuros",
    "neto_a_pagar", "a_pagar", "apagar", "pendiente",
  ],
  iva: [
    "total_iva", "totaliva", "iva", "importe_iva", "importeiva",
    "imp_iva", "impiva", "iva_total", "ivatotal",
    "cuota_iva", "cuotaiva", "cuota", "tax", "vat",
    "vat_amount", "vatamount", "tax_amount", "taxamount",
    "iva_repercutido", "ivarepercutido", "iva_eur", "ivaeur",
    "monto_iva", "montoiva", "valor_iva", "valoriva",
  ],
  base: [
    "base_imponible", "baseimponible", "base", "subtotal", "sub_total",
    "neto", "importe_neto", "importeneto", "imp_neto",
    "base_iva", "baseiva", "base_eur", "baseeur",
    "taxable_amount", "taxableamount", "net_amount", "netamount",
    "monto_base", "montobase", "valor_base", "valorbase",
  ],
  irpf: [
    "total_irpf", "totalirpf", "irpf", "importe_irpf", "importeirpf",
    "imp_irpf", "impirpf", "retencion", "retencion_irpf", "retencionirpf",
    "withholding", "withholding_tax",
  ],
  recargo: [
    "total_recargo", "totalrecargo", "recargo", "recargo_equivalencia",
    "recargoequivalencia", "rec_equivalencia", "re",
    "importe_recargo", "importerecargo",
  ],
};

// Keyword scoring per kind for fuzzy matching on normalized headers
function scoreAmount(nk: string, kind: AmountKind): number {
  let s = 0;
  if (kind === "total") {
    if (nk === "total" || nk === "importe" || nk === "monto" || nk === "amount") s += 10;
    if (nk.includes("total")) s += 5;
    if (nk.includes("importe")) s += 4;
    if (nk.includes("monto")) s += 3;
    if (nk.includes("amount") || nk.includes("grand")) s += 3;
    if (nk.includes("pagar")) s += 3;
    if (nk.includes("coniva") || nk.includes("withvat")) s += 4;
    // Penalise obvious non-totals
    if (nk.includes("iva") || nk.includes("vat") || nk.includes("tax")) s -= 6;
    if (nk.includes("base") || nk.includes("neto") || nk.includes("net")) s -= 6;
    if (nk.includes("irpf") || nk.includes("retencion") || nk.includes("withhold")) s -= 6;
    if (nk.includes("recargo")) s -= 6;
    if (nk.includes("unidad") || nk.includes("unit") || nk.includes("cantidad") || nk.includes("qty")) s -= 6;
  } else if (kind === "iva") {
    if (nk === "iva" || nk === "vat" || nk === "tax") s += 10;
    if (nk.includes("iva")) s += 6;
    if (nk.includes("vat") || nk.includes("tax")) s += 5;
    if (nk.includes("cuota")) s += 4;
    if (nk.includes("repercutido")) s += 3;
    // Penalise non-IVA
    if (nk.includes("base") || nk.includes("neto")) s -= 6;
    if (nk.includes("irpf") || nk.includes("retencion")) s -= 6;
    if (nk.includes("recargo")) s -= 6;
    if (nk.includes("regimen") || nk.includes("tipo")) s -= 8; // "tipo_iva", "regimen_iva"
    if (/^(total|importe|monto|amount)$/.test(nk)) s -= 4;
  } else if (kind === "base") {
    if (nk === "base" || nk === "neto" || nk === "subtotal") s += 10;
    if (nk.includes("base")) s += 5;
    if (nk.includes("neto") || nk.includes("net")) s += 4;
    if (nk.includes("subtotal") || nk.includes("imponible")) s += 5;
    if (nk.includes("iva") && !nk.includes("base")) s -= 6;
    if (nk.includes("irpf") || nk.includes("recargo")) s -= 6;
  } else if (kind === "irpf") {
    if (nk === "irpf") s += 10;
    if (nk.includes("irpf")) s += 6;
    if (nk.includes("retencion") || nk.includes("withhold")) s += 5;
    if (nk.includes("iva") || nk.includes("base") || nk.includes("recargo")) s -= 6;
  } else if (kind === "recargo") {
    if (nk === "recargo" || nk === "re") s += 10;
    if (nk.includes("recargo")) s += 6;
    if (nk.includes("equivalencia")) s += 3;
    if (nk.includes("iva") || nk.includes("base") || nk.includes("irpf")) s -= 6;
  }
  return s;
}

function detectAmount(row: Record<string, any>, kind: AmountKind): number {
  // 1) Direct alias hit
  for (const alias of AMOUNT_ALIASES[kind]) {
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined || value === null || value === "") continue;
      if (normKey(key) === alias) {
        const n = parseNum(value);
        if (n || value === 0 || value === "0") return n;
      }
    }
  }
  // 2) Fuzzy scoring
  const scored: { value: any; score: number }[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null || value === "") continue;
    const nk = normKey(key);
    const s = scoreAmount(nk, kind);
    if (s > 0) scored.push({ value, score: s });
  }
  if (scored.length === 0) return 0;
  scored.sort((a, b) => b.score - a.score);
  return parseNum(scored[0].value);
}

// Compute total when missing: base + iva + recargo - irpf
function computeTotalFallback(base: number, iva: number, recargo: number, irpf: number): number {
  const t = base + iva + recargo - irpf;
  return Number.isFinite(t) ? Math.round(t * 100) / 100 : 0;
}
// Compute IVA when missing but total & base present
function computeIvaFallback(total: number, base: number, recargo: number, irpf: number): number {
  if (!total || !base) return 0;
  const i = total - base - recargo + irpf;
  return i > 0 ? Math.round(i * 100) / 100 : 0;
}

function normalizeJsonItem(item: any): NormalizedRow {
  const cliente = item.cliente ?? {};
  const importes = item.importes ?? {};
  const tipo = String(pick(item, "tipo") || "completa").toLowerCase();
  const tipoOk = VALID_TIPOS.includes(tipo) ? tipo : "completa";

  // Merge importes + item so detectAmount sees all candidate keys
  const merged: Record<string, any> = { ...item, ...importes };
  const base = detectAmount(merged, "base");
  const recargo = detectAmount(merged, "recargo");
  const irpf = detectAmount(merged, "irpf");
  let iva = detectAmount(merged, "iva");
  let total = detectAmount(merged, "total");
  if (!total && (base || iva)) total = computeTotalFallback(base, iva, recargo, irpf);
  if (!iva && total && base) iva = computeIvaFallback(total, base, recargo, irpf);

  return {
    numero_factura: detectInvoiceNumber({ ...item, ...cliente }),
    tipo: tipoOk,
    cliente_nombre: String(pick(cliente, "nombre") || pick(item, "cliente_nombre") || ""),
    cliente_nif: String(pick(cliente, "nif", "cif", "dni") || pick(item, "cliente_nif") || ""),
    cliente_direccion: (pick(cliente, "direccion") || pick(item, "cliente_direccion") || null) as any,
    base_imponible: base,
    total_iva: iva,
    total_irpf: irpf,
    total_recargo: recargo,
    total: total,
    regimen_iva: String(pick(item, "regimen_iva") || "general"),
  };
}

function normalizeCsvRow(row: Record<string, string>): NormalizedRow {
  const tipoRaw = (pick(row, "tipo") || "completa").toString().toLowerCase();
  const tipoOk = VALID_TIPOS.includes(tipoRaw) ? tipoRaw : "completa";

  const base = detectAmount(row, "base");
  const recargo = detectAmount(row, "recargo");
  const irpf = detectAmount(row, "irpf");
  let iva = detectAmount(row, "iva");
  let total = detectAmount(row, "total");
  if (!total && (base || iva)) total = computeTotalFallback(base, iva, recargo, irpf);
  if (!iva && total && base) iva = computeIvaFallback(total, base, recargo, irpf);

  return {
    numero_factura: detectInvoiceNumber(row),
    tipo: tipoOk,
    cliente_nombre: String(pick(row, "cliente_nombre", "cliente", "nombre") || ""),
    cliente_nif: String(pick(row, "cliente_nif", "nif", "cif") || ""),
    cliente_direccion: (pick(row, "cliente_direccion", "direccion") || null) as any,
    base_imponible: base,
    total_iva: iva,
    total_irpf: irpf,
    total_recargo: recargo,
    total: total,
    regimen_iva: String(pick(row, "regimen_iva") || "general"),
  };
}

// Generate SHA-256 fingerprint for an imported invoice (deterministic by content + user)
async function generarHuellaImportada(r: NormalizedRow, userId: string): Promise<string> {
  const payload = [
    userId,
    r.numero_factura,
    r.cliente_nif,
    r.cliente_nombre,
    r.base_imponible.toFixed(2),
    r.total_iva.toFixed(2),
    r.total_irpf.toFixed(2),
    r.total_recargo.toFixed(2),
    r.total.toFixed(2),
    r.regimen_iva,
    "importada",
  ].join("|");
  const buf = new TextEncoder().encode(payload);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildQrUrl(huella: string): string {
  const origin = window.location.origin.replace(/\/+$/, "");
  return `${origin}/verificar?huella=${encodeURIComponent(huella)}`;
}

function validateRow(r: NormalizedRow, idx: number): string | null {
  if (!r.numero_factura.trim()) return `Fila ${idx + 1}: falta nº de factura`;
  if (!r.cliente_nombre.trim()) return `Fila ${idx + 1}: falta nombre de cliente`;
  if (!r.cliente_nif.trim()) return `Fila ${idx + 1}: falta NIF de cliente`;
  if (r.total < 0) return `Fila ${idx + 1}: total negativo`;
  return null;
}

type QrStatus = "pending" | "ready" | "error";
type RowQr = { status: QrStatus; huella?: string; qrUrl?: string; error?: string };

function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [qrStates, setQrStates] = useState<RowQr[]>([]);
  const [qrErrors, setQrErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: number; messages: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setValidationErrors([]);
    setQrStates([]);
    setQrErrors([]);
    setResult(null);
    setProgress(0);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    reset();

    const reader = new FileReader();
    reader.onerror = () => toast.error("No se pudo leer el archivo");
    reader.onload = async (ev) => {
      const text = (ev.target?.result as string) ?? "";
      let normalized: NormalizedRow[] = [];

      try {
        if (f.name.toLowerCase().endsWith(".json")) {
          const data = JSON.parse(text);
          const arr = Array.isArray(data) ? data : [data];
          normalized = arr.map(normalizeJsonItem);
        } else {
          const parsed = parseCSV(text);
          if (parsed.length === 0) {
            toast.error("El CSV está vacío o no tiene cabecera válida");
            return;
          }
          normalized = parsed.map(normalizeCsvRow);
        }
      } catch (err: any) {
        toast.error(`Archivo inválido: ${err.message ?? "formato no reconocido"}`);
        return;
      }

      const errs: string[] = [];
      normalized.forEach((r, i) => {
        const e = validateRow(r, i);
        if (e) errs.push(e);
      });

      setRows(normalized);
      setValidationErrors(errs);

      // Pre-compute huella SHA-256 + QR URL for each row so the table can
      // show "QR listo" status before the actual import.
      const { data: { user } } = await supabase.auth.getUser();
      const baseTs = Date.now();
      const initial: RowQr[] = normalized.map(() => ({ status: "pending" }));
      setQrStates(initial);

      const computed: RowQr[] = [];
      const qrErrs: string[] = [];
      for (let i = 0; i < normalized.length; i++) {
        const r = normalized[i];
        if (validateRow(r, i)) {
          // Skip rows that won't be imported anyway
          computed.push({ status: "pending" });
          continue;
        }
        try {
          const numero = r.numero_factura || `IMP-${baseTs}-${i}`;
          const rowForHash: NormalizedRow = { ...r, numero_factura: numero };
          const huella = await generarHuellaImportada(rowForHash, user?.id ?? "anon");
          const qrUrl = buildQrUrl(huella);
          computed.push({ status: "ready", huella, qrUrl });
        } catch (err: any) {
          const msg = `Fila ${i + 1} (${r.numero_factura || "sin nº"}): no se pudo calcular la huella — ${err?.message ?? "error desconocido"}`;
          qrErrs.push(msg);
          console.error("QR generation error", err);
          computed.push({ status: "error", error: err?.message ?? "Error desconocido" });
        }
      }
      setQrStates(computed);
      setQrErrors(qrErrs);

      const readyCount = computed.filter(s => s.status === "ready").length;
      if (errs.length > 0 || qrErrs.length > 0) {
        toast.warning(`${normalized.length} leídos · ${readyCount} con QR listo · ${errs.length + qrErrs.length} con errores`);
      } else {
        toast.success(`${normalized.length} registros listos para importar (QR generado)`);
      }
    };
    reader.readAsText(f, "utf-8");
  };

  const handleImport = async () => {
    const validIndices = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => !validateRow(r, i) && qrStates[i]?.status === "ready");
    if (validIndices.length === 0) {
      toast.error("No hay filas válidas con QR listo para importar");
      return;
    }
    setImporting(true);
    setProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("No autenticado"); setImporting(false); return; }

    const CHUNK = 100;
    let success = 0;
    let errors = 0;
    const messages: string[] = [];
    const baseTs = Date.now();

    for (let i = 0; i < validIndices.length; i += CHUNK) {
      const slice = validIndices.slice(i, i + CHUNK);
      const chunk = slice.map(({ r, i: idx }, k) => {
        const numero = r.numero_factura || `IMP-${baseTs}-${i + k}`;
        const qr = qrStates[idx];
        return {
          user_id: user.id,
          numero_factura: numero,
          tipo: r.tipo,
          origen: "importada",
          cliente_nombre: r.cliente_nombre,
          cliente_nif: r.cliente_nif,
          cliente_direccion: r.cliente_direccion,
          base_imponible: r.base_imponible,
          total_iva: r.total_iva,
          total_irpf: r.total_irpf,
          total_recargo: r.total_recargo,
          total: r.total,
          regimen_iva: r.regimen_iva,
          estado: "importada",
          huella_hash: qr.huella!,
          qr_url: qr.qrUrl!,
        };
      });

      const { error, data } = await supabase.from("facturas").insert(chunk).select("id");
      if (error) {
        // Fallback: try one by one to salvage good rows
        for (const single of chunk) {
          const { error: e2 } = await supabase.from("facturas").insert(single);
          if (e2) { errors++; messages.push(`${single.numero_factura}: ${e2.message}`); }
          else success++;
        }
      } else {
        success += data?.length ?? chunk.length;
      }
      setProgress(Math.round(((i + chunk.length) / validIndices.length) * 100));
    }

    setResult({ success, errors, messages: messages.slice(0, 5) });
    setImporting(false);
    if (success > 0) toast.success(`${success} facturas importadas`);
    if (errors > 0) toast.error(`${errors} con error`);
  };

  const validCount = rows.length - validationErrors.length;
  const qrReadyCount = qrStates.filter(s => s.status === "ready").length;
  const qrErrorCount = qrStates.filter(s => s.status === "error").length;
  const qrPendingCount = qrStates.filter(s => s.status === "pending").length;
  const importableCount = rows.filter((r, i) => !validateRow(r, i) && qrStates[i]?.status === "ready").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar Facturas
          </CardTitle>
          <CardDescription>
            Sube un archivo CSV o JSON. Acepta separador "," o ";", decimales con punto o coma, y BOM UTF-8. Cada factura importada genera automáticamente su huella SHA-256 y código QR de verificación.
          </CardDescription>
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
              accept=".csv,.json,application/json,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{rows.length} registros leídos</Badge>
                <Badge className="bg-success/10 text-success border-success/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />{validCount} válidos
                </Badge>
                {validationErrors.length > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />{validationErrors.length} con error
                  </Badge>
                )}
                {qrReadyCount > 0 && (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    <QrCode className="h-3 w-3 mr-1" />{qrReadyCount} QR listos
                  </Badge>
                )}
                {qrPendingCount > 0 && qrPendingCount !== rows.length && (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />{qrPendingCount} calculando QR
                  </Badge>
                )}
                {qrErrorCount > 0 && (
                  <Badge variant="destructive">
                    <ShieldAlert className="h-3 w-3 mr-1" />{qrErrorCount} QR con error
                  </Badge>
                )}
                {result && (
                  <>
                    <Badge className="bg-success/10 text-success border-success/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />{result.success} importadas
                    </Badge>
                    {result.errors > 0 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />{result.errors} fallidas
                      </Badge>
                    )}
                  </>
                )}
              </div>

              {validationErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1 max-h-32 overflow-y-auto">
                  {validationErrors.slice(0, 10).map((e, i) => (
                    <p key={i} className="text-destructive">• {e}</p>
                  ))}
                  {validationErrors.length > 10 && (
                    <p className="text-muted-foreground">…y {validationErrors.length - 10} más</p>
                  )}
                </div>
              )}

              {qrErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1 max-h-32 overflow-y-auto">
                  <p className="font-medium text-destructive mb-1 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Errores al generar QR / huella:
                  </p>
                  {qrErrors.slice(0, 10).map((e, i) => (
                    <p key={i} className="text-destructive">• {e}</p>
                  ))}
                  {qrErrors.length > 10 && (
                    <p className="text-muted-foreground">…y {qrErrors.length - 10} más</p>
                  )}
                </div>
              )}

              {result && result.messages.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1 max-h-32 overflow-y-auto">
                  <p className="font-medium text-destructive mb-1">Errores de inserción:</p>
                  {result.messages.map((m, i) => <p key={i} className="text-destructive">• {m}</p>)}
                </div>
              )}

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Factura</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>QR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 20).map((row, i) => {
                      const err = validateRow(row, i);
                      const qr = qrStates[i];
                      return (
                        <TableRow key={i} className={err ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-sm">{row.numero_factura || "—"}</TableCell>
                          <TableCell className="text-sm">{row.cliente_nombre || "—"}</TableCell>
                          <TableCell className="text-sm">{row.cliente_nif || "—"}</TableCell>
                          <TableCell className="text-right text-sm">{row.base_imponible.toFixed(2)}€</TableCell>
                          <TableCell className="text-right text-sm">{row.total.toFixed(2)}€</TableCell>
                          <TableCell>
                            {err ? (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">—</Badge>
                            ) : qr?.status === "ready" ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]" title={qr.huella}>
                                <QrCode className="h-3 w-3 mr-1" />QR listo
                              </Badge>
                            ) : qr?.status === "error" ? (
                              <Badge variant="destructive" className="text-[10px]" title={qr.error}>
                                <ShieldAlert className="h-3 w-3 mr-1" />Error
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />…
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {rows.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 20 de {rows.length} registros
                  </p>
                )}
              </div>

              {importing && (
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing || !!result || importableCount === 0}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Importar {importableCount} facturas
                </Button>
                {(result || rows.length > 0) && (
                  <Button variant="outline" onClick={() => { setFile(null); reset(); if (fileRef.current) fileRef.current.value = ""; }}>
                    Limpiar
                  </Button>
                )}
              </div>
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
