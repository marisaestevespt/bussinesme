import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface AutomationSetting {
  id: string;
  automation_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
}

const CATEGORY_MAP: Record<string, string> = {
  sales_overdue: 'Comercial',
  sales_awaiting: 'Comercial',
  client_renewal: 'Clientes',
  contract_expiry: 'Equipa',
  capacity_alert: 'Equipa',
  payroll_sync: 'Financeiro',
  payroll_autogen: 'Financeiro',
  portal_deactivation: 'Clientes',
  nps_autogen: 'Clientes',
  meeting_reminders: 'Operação',
  project_deadlines: 'Operação',
  overdue_tasks: 'Operação',
  crm_followup: 'Comercial',
  routine_missed: 'Operação',
  recurring_expenses: 'Financeiro',
  access_revoke: 'Equipa',
};

export function SettingsAutomations() {
  const qc = useQueryClient();

  const { data: automations, isLoading } = useQuery({
    queryKey: ['automation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('id, automation_key, label, description, enabled')
        .order('label');
      if (error) throw error;
      return data as AutomationSetting[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('automation_settings')
        .update({ enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ['automation-settings'] });
      const prev = qc.getQueryData<AutomationSetting[]>(['automation-settings']);
      qc.setQueryData<AutomationSetting[]>(['automation-settings'], old =>
        (old || []).map(a => a.id === id ? { ...a, enabled } : a)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['automation-settings'], ctx.prev);
      toast.error('Erro ao atualizar automação');
    },
    onSuccess: () => toast.success('Automação atualizada'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Group by category
  const grouped = new Map<string, AutomationSetting[]>();
  for (const a of automations || []) {
    const cat = CATEGORY_MAP[a.automation_key] || 'Outro';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(a);
  }

  const categoryOrder = ['Comercial', 'Clientes', 'Financeiro', 'Equipa', 'Operação', 'Outro'];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Controla quais automações do sistema estão activas. Todas correm diariamente às 08:00.
      </p>
      {categoryOrder.map(cat => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <div key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{cat}</h3>
            <div className="space-y-1">
              {items.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.label}</p>
                    {a.description && (
                      <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                    )}
                  </div>
                  <Switch
                    checked={a.enabled}
                    onCheckedChange={(checked) => toggle.mutate({ id: a.id, enabled: checked })}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
