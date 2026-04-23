import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const formData = await req.formData();
    const pdfFile = formData.get("pdf") as File | null;

    if (!pdfFile) {
      return new Response(JSON.stringify({ error: "No se ha proporcionado un archivo PDF" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI no configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres un experto en extracción de datos de facturas españolas. Analiza el contenido del PDF proporcionado y extrae los datos estructurados de la factura.

Debes extraer:
- emisor_nombre: Nombre o razón social del emisor (quien emite la factura)
- emisor_nif: NIF/CIF del emisor
- emisor_direccion: Dirección del emisor
- cliente_nombre: Nombre o razón social del cliente / receptor / destinatario de la factura
- cliente_nif: NIF/CIF del cliente / receptor
- cliente_direccion: Dirección del cliente / receptor
- numero_factura: Número de la factura original
- fecha_emision: Fecha de emisión (formato DD-MM-YYYY)
- base_imponible: Base imponible total (número)
- total_iva: Cuota de IVA total (número)
- total_irpf: Retención IRPF total (número, 0 si no aplica)
- total: Importe total de la factura (número)
- tipo_iva: Porcentaje de IVA principal (número)
- descripcion: Breve descripción de los conceptos facturados
- layout_info: Información sobre el diseño del PDF para posicionar el QR. Indica "horizontal" si es apaisado, "vertical" si es vertical. Indica "footer_libre" si hay espacio libre en la parte inferior, "footer_ocupado" si no.

Si no puedes extraer algún campo, usa null.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrae los datos de esta factura PDF. Responde usando la función extract_invoice_data.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extrae datos estructurados de una factura",
              parameters: {
                type: "object",
                properties: {
                  emisor_nombre: { type: "string", description: "Nombre del emisor" },
                  emisor_nif: { type: "string", description: "NIF/CIF del emisor" },
                  emisor_direccion: { type: "string", description: "Dirección del emisor" },
                  cliente_nombre: { type: "string", description: "Nombre del cliente / receptor de la factura" },
                  cliente_nif: { type: "string", description: "NIF/CIF del cliente / receptor" },
                  cliente_direccion: { type: "string", description: "Dirección del cliente / receptor" },
                  numero_factura: { type: "string", description: "Número de factura original" },
                  fecha_emision: { type: "string", description: "Fecha de emisión DD-MM-YYYY" },
                  base_imponible: { type: "number", description: "Base imponible total" },
                  total_iva: { type: "number", description: "Cuota IVA total" },
                  total_irpf: { type: "number", description: "Retención IRPF" },
                  total: { type: "number", description: "Importe total" },
                  tipo_iva: { type: "number", description: "Porcentaje IVA principal" },
                  descripcion: { type: "string", description: "Descripción de conceptos" },
                  layout_orientacion: {
                    type: "string",
                    enum: ["horizontal", "vertical"],
                    description: "Orientación del PDF",
                  },
                  layout_footer_libre: {
                    type: "boolean",
                    description: "Si hay espacio libre en la parte inferior para el QR",
                  },
                },
                required: ["emisor_nombre", "emisor_nif", "total"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes, intenta más tarde" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Error al analizar el PDF con IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No se pudieron extraer datos del PDF" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ extracted: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
