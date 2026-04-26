import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface RunRow {
  id: string;
  function_name: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: "success" | "failed" | "warning" | "running";
  attempts: number;
  error_message: string | null;
  context: Record<string, unknown> | null;
}

const STATUS_BADGE: Record<RunRow["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  success: { label: "Sucesso", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
  warning: { label: "Aviso", variant: "secondary", icon: <AlertTriangle className="w-3 h-3" /> },
  failed: { label: "Falhada", variant: "destructive", icon: <AlertTriangle className="w-3 h-3" /> },
  running: { label: "A correr", variant: "outline", icon: <Clock className="w-3 h-3" /> },
};

export function SettingsEdgeMonitoring() {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("edge_function_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    setRows((data as RunRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const lastByFn = new Map<string, RunRow>();
  for (const r of rows) {
    if (!lastByFn.has(r.function_name)) lastByFn.set(r.function_name, r);
  }
  const failures24h = rows.filter(r =>
    r.status === "failed" &&
    new Date(r.started_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Monitorização de Automações</h2>
          <p className="text-sm text-muted-foreground">
            Histórico das últimas 100 execuções de tarefas automáticas (cron).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {failures24h.length > 0 && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">
                {failures24h.length} falha{failures24h.length > 1 ? "s" : ""} nas últimas 24h
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Verifica os detalhes abaixo. Funções que falham repetidamente devem ser investigadas.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-medium mb-2">Estado por função</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Array.from(lastByFn.values()).map(r => {
            const cfg = STATUS_BADGE[r.status];
            return (
              <Card key={r.id} className="p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-sm truncate">{r.function_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.started_at).toLocaleString("pt-PT")}
                    {r.duration_ms != null && ` · ${r.duration_ms}ms`}
                  </p>
                </div>
                <Badge variant={cfg.variant} className="gap-1 shrink-0">
                  {cfg.icon}{cfg.label}
                </Badge>
              </Card>
            );
          })}
          {lastByFn.size === 0 && !loading && (
            <p className="text-sm text-muted-foreground col-span-full">
              Ainda não há execuções registadas. As próximas execuções automáticas vão aparecer aqui.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Histórico recente</h3>
        <div className="space-y-1 max-h-96 overflow-auto">
          {rows.map(r => {
            const cfg = STATUS_BADGE[r.status];
            return (
              <div key={r.id} className="text-xs border-l-2 border-secondary pl-3 py-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={cfg.variant} className="gap-1">{cfg.icon}{cfg.label}</Badge>
                  <span className="font-mono">{r.function_name}</span>
                  <span className="text-muted-foreground">
                    {new Date(r.started_at).toLocaleString("pt-PT")}
                  </span>
                  {r.duration_ms != null && <span className="text-muted-foreground">{r.duration_ms}ms</span>}
                  {r.attempts > 1 && <span className="text-muted-foreground">{r.attempts} tentativas</span>}
                </div>
                {r.error_message && (
                  <p className="text-destructive mt-0.5 font-mono">{r.error_message}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}