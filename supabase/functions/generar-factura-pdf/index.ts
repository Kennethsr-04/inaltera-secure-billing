import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import QRCode from "https://esm.sh/qrcode@1.5.4?bundle";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LineaFactura {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  tipoIva: number;
  irpf: number;
  recargoEquivalencia: number;
}

interface FacturaPayload {
  clienteId: string;
  clienteNombre: string;
  clienteNif: string;
  clienteDireccion: string;
  tipoFactura: string;
  regimenIva: string;
  lineas: LineaFactura[];
  observaciones: string;
  emisorNombre: string;
  emisorNif: string;
  emisorDireccion: string;
}

function calcTotales(lineas: LineaFactura[]) {
  let baseImponible = 0, totalIva = 0, totalIrpf = 0, totalRecargo = 0;
  lineas.forEach((l) => {
    const base = l.cantidad * l.precioUnitario * (1 - l.descuento / 100);
    baseImponible += base;
    totalIva += base * (l.tipoIva / 100);
    totalIrpf += base * (l.irpf / 100);
    totalRecargo += base * (l.recargoEquivalencia / 100);
  });
  return { baseImponible, totalIva, totalIrpf, totalRecargo, total: baseImponible + totalIva - totalIrpf + totalRecargo };
}

function generarNumeroFactura(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `F-${year}/${seq}`;
}

async function generarHuellaSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function generarQrUrl(nif: string, numero: string, fecha: string, importe: string, huella: string): string {
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=${encodeURIComponent(nif)}&numserie=${encodeURIComponent(numero)}&fecha=${encodeURIComponent(fecha)}&importe=${encodeURIComponent(importe)}&huella=${encodeURIComponent(huella)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload: FacturaPayload = await req.json();
    const totales = calcTotales(payload.lineas);
    const numeroFactura = generarNumeroFactura();
    const fechaEmision = new Date();
    const fechaStr = `${String(fechaEmision.getDate()).padStart(2, "0")}-${String(fechaEmision.getMonth() + 1).padStart(2, "0")}-${fechaEmision.getFullYear()}`;

    // Generate SHA-256 hash
    const huellaData = `${payload.emisorNif}|${numeroFactura}|${fechaStr}|${totales.total.toFixed(2)}`;
    const huella = await generarHuellaSHA256(huellaData);

    // Generate QR URL (AEAT format)
    const qrUrl = generarQrUrl(
      payload.emisorNif || "B00000000",
      numeroFactura,
      fechaStr,
      totales.total.toFixed(2),
      huella
    );

    // Generate QR code modules directly (no canvas needed in Deno)
    const qrData = QRCode.create(qrUrl, { errorCorrectionLevel: "H" });
    const modules = qrData.modules;
    const moduleCount = modules.size;

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();

    const margin = 50;
    let y = height - margin;

    // Header - Emisor
    page.drawText(payload.emisorNombre || "Mi Empresa S.L.", { x: margin, y, font: fontBold, size: 16, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
    page.drawText(`NIF: ${payload.emisorNif || "B00000000"}`, { x: margin, y, font, size: 9, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;
    page.drawText(payload.emisorDireccion || "", { x: margin, y, font, size: 9, color: rgb(0.3, 0.3, 0.3) });

    // Invoice number and date - right side
    page.drawText("FACTURA", { x: width - margin - 120, y: height - margin, font: fontBold, size: 20, color: rgb(0.15, 0.4, 0.7) });
    page.drawText(numeroFactura, { x: width - margin - 120, y: height - margin - 22, font: fontBold, size: 12 });
    page.drawText(`Fecha: ${fechaStr}`, { x: width - margin - 120, y: height - margin - 38, font, size: 9 });
    page.drawText(`Tipo: ${payload.tipoFactura}`, { x: width - margin - 120, y: height - margin - 52, font, size: 9 });

    // Separator line
    y -= 30;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

    // Client data
    y -= 25;
    page.drawText("DATOS DEL CLIENTE", { x: margin, y, font: fontBold, size: 10, color: rgb(0.15, 0.4, 0.7) });
    y -= 16;
    page.drawText(payload.clienteNombre, { x: margin, y, font: fontBold, size: 10 });
    y -= 14;
    page.drawText(`NIF: ${payload.clienteNif}`, { x: margin, y, font, size: 9 });
    y -= 14;
    page.drawText(payload.clienteDireccion || "", { x: margin, y, font, size: 9 });

    // Table header
    y -= 30;
    const colX = [margin, margin + 200, margin + 250, margin + 310, margin + 360, margin + 420];
    const headers = ["Descripción", "Cant.", "Precio", "Dto.%", "IVA%", "Subtotal"];
    page.drawRectangle({ x: margin - 5, y: y - 5, width: width - 2 * margin + 10, height: 20, color: rgb(0.93, 0.93, 0.96) });
    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i], y, font: fontBold, size: 8, color: rgb(0.2, 0.2, 0.2) });
    });

    // Table rows
    y -= 20;
    payload.lineas.forEach((linea) => {
      const subtotal = linea.cantidad * linea.precioUnitario * (1 - linea.descuento / 100);
      const desc = linea.descripcion.length > 35 ? linea.descripcion.substring(0, 35) + "..." : linea.descripcion;
      page.drawText(desc, { x: colX[0], y, font, size: 8 });
      page.drawText(String(linea.cantidad), { x: colX[1], y, font, size: 8 });
      page.drawText(`${linea.precioUnitario.toFixed(2)}€`, { x: colX[2], y, font, size: 8 });
      page.drawText(`${linea.descuento}%`, { x: colX[3], y, font, size: 8 });
      page.drawText(`${linea.tipoIva}%`, { x: colX[4], y, font, size: 8 });
      page.drawText(`${subtotal.toFixed(2)}€`, { x: colX[5], y, font, size: 8 });
      y -= 16;
    });

    // Totals
    y -= 10;
    page.drawLine({ start: { x: margin + 300, y: y + 5 }, end: { x: width - margin, y: y + 5 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    const drawTotal = (label: string, value: string, bold = false) => {
      page.drawText(label, { x: margin + 310, y, font: bold ? fontBold : font, size: bold ? 11 : 9 });
      page.drawText(value, { x: width - margin - 60, y, font: bold ? fontBold : font, size: bold ? 11 : 9 });
      y -= 16;
    };
    drawTotal("Base Imponible:", `${totales.baseImponible.toFixed(2)}€`);
    drawTotal("Cuota IVA:", `${totales.totalIva.toFixed(2)}€`);
    if (totales.totalIrpf > 0) drawTotal("Retención IRPF:", `-${totales.totalIrpf.toFixed(2)}€`);
    if (totales.totalRecargo > 0) drawTotal("Recargo Eq.:", `${totales.totalRecargo.toFixed(2)}€`);
    y -= 4;
    page.drawLine({ start: { x: margin + 300, y: y + 12 }, end: { x: width - margin, y: y + 12 }, thickness: 1, color: rgb(0.15, 0.4, 0.7) });
    drawTotal("TOTAL:", `${totales.total.toFixed(2)}€`, true);

    // Observaciones
    if (payload.observaciones) {
      y -= 10;
      page.drawText("Observaciones:", { x: margin, y, font: fontBold, size: 9 });
      y -= 14;
      page.drawText(payload.observaciones.substring(0, 100), { x: margin, y, font, size: 8, color: rgb(0.4, 0.4, 0.4) });
    }

    // Draw QR modules as rectangles directly
    const cellSize = qrSize / moduleCount;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (modules.get(row, col)) {
          page.drawRectangle({
            x: qrX + col * cellSize,
            y: qrY + qrSize - (row + 1) * cellSize,
            width: cellSize,
            height: cellSize,
            color: rgb(0, 0, 0),
          });
        }
      }
    }

    // QR label
    page.drawText("QR Tributario", { x: qrX + 18, y: qrY - 12, font: fontBold, size: 8, color: rgb(0.15, 0.4, 0.7) });
    page.drawText("Código QR de verificación", { x: qrX + 5, y: qrY - 22, font, size: 6, color: rgb(0.5, 0.5, 0.5) });

    // Huella hash at bottom left
    page.drawText(`Huella SHA-256: ${huella.substring(0, 32)}...`, { x: margin, y: margin, font, size: 6, color: rgb(0.6, 0.6, 0.6) });
    page.drawText(`Factura electrónica verificable`, { x: margin, y: margin - 10, font, size: 6, color: rgb(0.6, 0.6, 0.6) });

    const pdfBytes = await pdfDoc.save();

    // Upload PDF to storage
    const pdfPath = `${user.id}/${numeroFactura.replace(/\//g, "-")}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("facturas-pdf")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
    }

    // Save to database
    const { error: dbError } = await supabase.from("facturas").insert({
      user_id: user.id,
      numero_factura: numeroFactura,
      tipo: payload.tipoFactura,
      origen: "elaborada",
      cliente_nombre: payload.clienteNombre,
      cliente_nif: payload.clienteNif,
      cliente_direccion: payload.clienteDireccion,
      regimen_iva: payload.regimenIva,
      lineas: payload.lineas,
      observaciones: payload.observaciones,
      base_imponible: totales.baseImponible,
      total_iva: totales.totalIva,
      total_irpf: totales.totalIrpf,
      total_recargo: totales.totalRecargo,
      total: totales.total,
      huella_hash: huella,
      qr_url: qrUrl,
      verifactu_url: qrUrl,
      pdf_path: pdfPath,
    });

    if (dbError) {
      console.error("DB error:", dbError);
    }

    // Return PDF as base64 + metadata
    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));

    return new Response(
      JSON.stringify({
        id: numeroFactura,
        qrUrl,
        huella,
        pdfBase64: base64Pdf,
        pdfPath,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
