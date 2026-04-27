// Edge function: probar conexión a BD externa
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Client as PgClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
  details?: string;
}

async function testPostgres(opts: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}): Promise<TestResult> {
  const started = Date.now();
  const client = new PgClient({
    hostname: opts.host,
    port: opts.port,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    tls: { enabled: true, enforce: false },
    connection: { attempts: 1 },
  });
  try {
    await client.connect();
    const res = await client.queryObject<{ v: number }>("SELECT 1 as v");
    await client.end();
    const ok = res.rows[0]?.v === 1;
    return {
      success: ok,
      message: ok
        ? "Conexión PostgreSQL establecida correctamente"
        : "Conectado pero la consulta de prueba no devolvió 1",
      latency_ms: Date.now() - started,
    };
  } catch (e) {
    try { await client.end(); } catch (_) { /* ignore */ }
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      message: "No se pudo conectar a PostgreSQL",
      latency_ms: Date.now() - started,
      details: msg,
    };
  }
}

async function testTcp(host: string, port: number, label: string): Promise<TestResult> {
  const started = Date.now();
  try {
    const conn = await Promise.race([
      Deno.connect({ hostname: host, port }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Timeout (5s) al conectar")), 5000),
      ),
    ]);
    (conn as Deno.Conn).close();
    return {
      success: true,
      message: `Host alcanzable en ${host}:${port}. ` +
        `La autenticación de ${label} no se prueba completamente desde el navegador, ` +
        `pero el puerto está abierto.`,
      latency_ms: Date.now() - started,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      message: `No se pudo alcanzar ${host}:${port}`,
      latency_ms: Date.now() - started,
      details: msg,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "No autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, message: "Sesión inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const conexionId = String(body.conexionId ?? "");
    if (!conexionId) {
      return new Response(
        JSON.stringify({ success: false, message: "Falta conexionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch connection (RLS protege que sea del usuario)
    const { data: conn, error: connErr } = await supabase
      .from("conexiones_bd")
      .select("*")
      .eq("id", conexionId)
      .maybeSingle();
    if (connErr || !conn) {
      return new Response(
        JSON.stringify({ success: false, message: "Conexión no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const host = String(conn.host);
    const port = parseInt(String(conn.puerto || "5432"), 10);
    const database = String(conn.nombre_bd);
    const user = String(conn.usuario_bd);
    const password = String(conn.password_bd ?? "");
    const tipo = String(conn.tipo_bd || "postgresql").toLowerCase();

    let result: TestResult;
    if (tipo === "postgresql" || tipo === "postgres") {
      result = await testPostgres({ host, port, database, user, password });
    } else if (tipo === "mysql") {
      result = await testTcp(host, port, "MySQL");
    } else if (tipo === "mariadb") {
      result = await testTcp(host, port, "MariaDB");
    } else if (tipo === "mssql" || tipo === "sqlserver") {
      result = await testTcp(host, port, "SQL Server");
    } else {
      result = await testTcp(host, port, tipo);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ success: false, message: "Error inesperado", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
