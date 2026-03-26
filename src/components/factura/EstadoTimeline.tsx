import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface EstadoLog {
  id: string;
  estado_anterior: string;
  estado_nuevo: string;
  nota: string | null;
  created_at: string;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "bg-muted text-muted-foreground" },
  sellada: { label: "Sellada", color: "bg-primary/10 text-primary border-primary/30" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  pagada: { label: "Pagada", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  vencida: { label: "Vencida", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  anulada: { label: "Anulada", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function getEstadoConfig(estado: string) {
  return ESTADO_CONFIG[estado] ?? { label: estado, color: "bg-muted text-muted-foreground" };
}

export const ESTADOS = Object.entries(ESTADO_CONFIG).map(([value, { label }]) => ({ value, label }));

export function EstadoBadge({ estado }: { estado: string }) {
  const config = getEstadoConfig(estado);
  return (
    <Badge variant="outline" className={cn("capitalize", config.color)}>
      {config.label}
    </Badge>
  );
}

export function EstadoTimeline({ logs }: { logs: EstadoLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Sin historial de cambios</p>;
  }

  return (
    <div className="space-y-3">
      {logs.map((log, i) => {
        const configNuevo = getEstadoConfig(log.estado_nuevo);
        return (
          <div key={log.id} className="flex gap-3 items-start">
            <div className="flex flex-col items-center">
              <div className={cn("w-3 h-3 rounded-full mt-1.5 border-2", configNuevo.color)} />
              {i < logs.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
            </div>
            <div className="pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <EstadoBadge estado={log.estado_nuevo} />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                </span>
              </div>
              {log.nota && <p className="text-sm text-muted-foreground mt-1">{log.nota}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
