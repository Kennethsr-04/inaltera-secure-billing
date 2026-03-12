import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import QRCode from "https://esm.sh/qrcode@1.5.4?bundle";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generarHuellaSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function generarNumeroFactura(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `EXT-${year}/${seq}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const pdfFile = formData.get("pdf") as File | null;
    const emisorNif = (formData.get("emisorNif") as string) || "B00000000";
    const emisorNombre = (formData.get("emisorNombre") as string) || "";
    const layoutOrientacion = (formData.get("layoutOrientacion") as string) || "vertical";
    const layoutFooterLibre = formData.get("layoutFooterLibre") === "true";
    const baseImponible = parseFloat(formData.get("baseImponible") as string) || 0;
    const totalIva = parseFloat(formData.get("totalIva") as string) || 0;
    const totalIrpf = parseFloat(formData.get("totalIrpf") as string) || 0;
    const totalFactura = parseFloat(formData.get("total") as string) || 0;
    const descripcion = (formData.get("descripcion") as string) || "";

    if (!pdfFile) {
      return new Response(JSON.stringify({ error: "No se ha proporcionado un archivo PDF" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const originalPdfBytes = new Uint8Array(await pdfFile.arrayBuffer());

    // Load existing PDF
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width } = lastPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const numeroFactura = generarNumeroFactura();
    const fechaEmision = new Date();
    const fechaStr = `${String(fechaEmision.getDate()).padStart(2, "0")}-${String(
      fechaEmision.getMonth() + 1
    ).padStart(2, "0")}-${fechaEmision.getFullYear()}`;

    // Generate SHA-256 hash from PDF content + metadata
    const pdfContentHash = Array.from(originalPdfBytes.slice(0, 1024))
      .map((b) => b.toString(16))
      .join("");
    const huellaData = `${emisorNif}|${numeroFactura}|${fechaStr}|${pdfContentHash}`;
    const huella = await generarHuellaSHA256(huellaData);

    // Generate QR URL
    const qrUrl = `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=${encodeURIComponent(
      emisorNif
    )}&numserie=${encodeURIComponent(numeroFactura)}&fecha=${encodeURIComponent(
      fechaStr
    )}&huella=${encodeURIComponent(huella)}`;

    // Generate QR code as PNG
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 150,
    });

    const qrImageBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    // Smart QR positioning based on layout analysis
    const qrSize = 100;
    const margin = 40;
    let qrX: number;
    let qrY: number;

    if (layoutOrientacion === "horizontal") {
      // Landscape: place QR in bottom-left to avoid common right-side content
      qrX = margin;
      qrY = margin;
    } else if (layoutFooterLibre) {
      // Portrait with free footer: center QR at the bottom
      qrX = (width - qrSize) / 2;
      qrY = margin;
    } else {
      // Portrait with occupied footer: bottom-right corner (default)
      qrX = width - margin - qrSize;
      qrY = margin;
    }

    // White background behind QR
    lastPage.drawRectangle({
      x: qrX - 8,
      y: qrY - 30,
      width: qrSize + 16,
      height: qrSize + 50,
      color: rgb(1, 1, 1),
      opacity: 0.95,
    });

    // Draw border
    lastPage.drawRectangle({
      x: qrX - 8,
      y: qrY - 30,
      width: qrSize + 16,
      height: qrSize + 50,
      borderColor: rgb(0.15, 0.4, 0.7),
      borderWidth: 1,
    });

    lastPage.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    lastPage.drawText("QR Tributario", {
      x: qrX + 14,
      y: qrY + qrSize + 6,
      font: fontBold,
      size: 8,
      color: rgb(0.15, 0.4, 0.7),
    });

    lastPage.drawText(`Huella: ${huella.substring(0, 20)}...`, {
      x: qrX - 4,
      y: qrY - 12,
      font,
      size: 5,
      color: rgb(0.5, 0.5, 0.5),
    });

    lastPage.drawText(fechaStr, {
      x: qrX + 25,
      y: qrY - 22,
      font,
      size: 6,
      color: rgb(0.5, 0.5, 0.5),
    });

    const sealedPdfBytes = await pdfDoc.save();

    // Upload sealed PDF to storage
    const pdfPath = `${user.id}/${numeroFactura.replace(/\//g, "-")}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("facturas-pdf")
      .upload(pdfPath, sealedPdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
    }

    // Save record to database
    const { error: dbError } = await supabase.from("facturas").insert({
      user_id: user.id,
      numero_factura: numeroFactura,
      tipo: "tercero",
      origen: "cargada",
      cliente_nombre: emisorNombre || pdfFile.name.replace(".pdf", ""),
      cliente_nif: emisorNif || "N/A",
      regimen_iva: "general",
      lineas: [],
      base_imponible: baseImponible,
      total_iva: totalIva,
      total_irpf: totalIrpf,
      total_recargo: 0,
      total: totalFactura,
      huella_hash: huella,
      qr_url: qrUrl,
      pdf_path: pdfPath,
      observaciones: descripcion || null,
    });

    if (dbError) {
      console.error("DB error:", dbError);
    }

    // Return sealed PDF as base64
    const base64Pdf = btoa(String.fromCharCode(...sealedPdfBytes));

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
