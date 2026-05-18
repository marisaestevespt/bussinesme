import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, CalendarClock } from "lucide-react";

interface UpcomingClone {
  template_id: string;
  template_name: string;
  project_id: string;
  project_name: string | null;
  period: string;
  deadline: string;
  opens_on: string;
  already_exists: boolean;
}

export function RecurringPhasesPreview() {
  const [items, setItems] = useState<UpcomingClone[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const scan = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("clone-recurring-phases", {
      body: { preview: true, preview_days: 60 },
    });
    setLoading(false);
    if (error) {
      toast.error(`Falhou: ${error.message}`);
      return;
    }
    setItems((data as any)?.upcoming ?? []);
    setScanned(true);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Próximos clones de fases recorrentes
          </h2>
          <p className="text-sm text-muted-foreground">
            Mostra que fases recorrentes serão clonadas nos próximos 60 dias e em que projetos.
            Útil para detetar templates mal configurados antes do cron executar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={scan} disabled={loading}>
          <Search className="w-4 h-4 mr-2" />
          Pré-visualizar
        </Button>
      </div>

      {scanned && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum clone previsto nos próximos 60 dias.</p>
      )}

      {items.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-auto">
          {items.map((it, i) => (
            <div key={i} className="text-xs border-l-2 border-secondary pl-3 py-1.5 flex items-center gap-2 flex-wrap">
              {it.already_exists ? (
                <Badge variant="secondary">já existe</Badge>
              ) : (
                <Badge variant="default">vai criar</Badge>
              )}
              <span className="font-medium">{it.template_name}</span>
              <span className="text-muted-foreground">→ {it.project_name ?? it.project_id.slice(0, 8)}</span>
              <span className="text-muted-foreground">abre {it.opens_on} · entrega {it.deadline}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}