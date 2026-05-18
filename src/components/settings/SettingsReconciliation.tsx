import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wrench, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

interface DriftRow {
  deliverable_id: string | null;
  task_id: string | null;
  deliverable_name: string | null;
  deliverable_status: string | null;
  task_status: string | null;
  issue: "missing_task" | "orphan_task" | "status_drift";
  fixed: boolean;
}

const ISSUE_LABEL: Record<DriftRow["issue"], string> = {
  missing_task: "Entrega sem tarefa",
  orphan_task: "Tarefa órfã",
  status_drift: "Estados divergentes",
};

export function SettingsReconciliation() {
  const [rows, setRows] = useState<DriftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const run = async (apply: boolean) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("reconcile_deliverable_tasks", { _apply: apply });
    setLoading(false);
    if (error) {
      toast.error(`Falhou: ${error.message}`);
      return;
    }
    setRows((data as DriftRow[]) ?? []);
    setHasScanned(true);
    if (apply) toast.success(`${(data as DriftRow[])?.length ?? 0} divergências corrigidas.`);
    else toast.message(`${(data as DriftRow[])?.length ?? 0} divergências encontradas.`);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Reconciliação Entregas ↔ Tarefas</h2>
          <p className="text-sm text-muted-foreground">
            Verifica e corrige divergências entre Entregas de projeto e as Tarefas associadas
            (entregas sem tarefa, tarefas órfãs, estados dessincronizados).
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => run(false)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Verificar
          </Button>
          <Button size="sm" onClick={() => run(true)} disabled={loading || !hasScanned || rows.length === 0}>
            <Wrench className="w-4 h-4 mr-2" />
            Corrigir tudo
          </Button>
        </div>
      </div>

      {hasScanned && rows.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Sem divergências. Tudo sincronizado.
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-auto">
          {rows.map((r, i) => (
            <div key={i} className="text-xs border-l-2 border-secondary pl-3 py-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={r.fixed ? "default" : "destructive"} className="gap-1">
                  {r.fixed ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {ISSUE_LABEL[r.issue]}
                </Badge>
                {r.deliverable_name && <span className="font-medium">{r.deliverable_name}</span>}
                {r.deliverable_status && (
                  <span className="text-muted-foreground">entrega: {r.deliverable_status}</span>
                )}
                {r.task_status && (
                  <span className="text-muted-foreground">tarefa: {r.task_status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}