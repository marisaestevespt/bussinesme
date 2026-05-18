import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Check, AlertTriangle } from "lucide-react";

interface PendingItem {
  supplier_id: string;
  supplier_name: string;
  months: string[];
}

export function SupplierExtensionSuggestions() {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const scan = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("extend-supplier-expenses", {
      body: { months_ahead: 12 },
    });
    setLoading(false);
    if (error) {
      toast.error(`Falhou: ${error.message}`);
      return;
    }
    setPending((data as any)?.pending ?? []);
    setScanned(true);
  };

  const apply = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("extend-supplier-expenses", {
      body: { months_ahead: 12, apply: true },
    });
    setLoading(false);
    if (error) {
      toast.error(`Falhou: ${error.message}`);
      return;
    }
    toast.success(`${(data as any)?.inserted ?? 0} despesas criadas.`);
    setPending([]);
    setScanned(false);
  };

  const totalMonths = pending.reduce((a, p) => a + p.months.length, 0);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Extensão de despesas recorrentes</h2>
          <p className="text-sm text-muted-foreground">
            Verifica que despesas de fornecedores estão por estender e confirma manualmente
            antes de criar. (O cron mensal só sugere — nunca cria automaticamente.)
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={scan} disabled={loading}>
            <Search className="w-4 h-4 mr-2" />
            Verificar
          </Button>
          <Button size="sm" onClick={apply} disabled={loading || pending.length === 0}>
            <Check className="w-4 h-4 mr-2" />
            Aplicar ({totalMonths})
          </Button>
        </div>
      </div>

      {scanned && pending.length === 0 && (
        <p className="text-sm text-muted-foreground">Sem despesas pendentes de extensão.</p>
      )}

      {pending.length > 0 && (
        <div className="space-y-1">
          {pending.map((p) => (
            <div key={p.supplier_id} className="flex items-center justify-between text-sm border-l-2 border-secondary pl-3 py-1.5">
              <span className="font-medium">{p.supplier_name}</span>
              <div className="flex gap-1 flex-wrap">
                {p.months.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Ao aplicar, são criadas as despesas em estado "por pagar". Os valores vêm dos contratos ativos
              de cada fornecedor.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}