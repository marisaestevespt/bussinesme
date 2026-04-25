import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ListTodo, Info } from 'lucide-react';

interface Props {
  roleTitle: string;
  /** IDs (de sop_onboarding_items) ou textos (fallback inputs) que NÃO devem ser criados */
  excluded: string[];
  onChange: (excluded: string[]) => void;
}

export function OnboardingPreview({ roleTitle, excluded, onChange }: Props) {
  const role = roleTitle?.trim();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-preview', role],
    enabled: !!role,
    queryFn: async () => {
      // 1. Buscar SOPs de onboarding para o cargo (case-insensitive)
      const { data: sops } = await supabase
        .from('sops')
        .select('id, name, role_title, inputs')
        .eq('sop_type', 'onboarding')
        .ilike('role_title', role);

      if (!sops || sops.length === 0) return { sops: [], items: [], fallback: [] };

      const sopIds = sops.map(s => s.id);

      // 2. Templates ligados a esses SOPs
      const { data: templates } = await supabase
        .from('sop_onboarding_templates')
        .select('id, sop_id')
        .in('sop_id', sopIds);

      const templateIds = (templates || []).map(t => t.id);

      // 3. Items do template
      let items: { id: string; task: string; deadline_days: number; sop_name: string }[] = [];
      if (templateIds.length > 0) {
        const { data: rawItems } = await supabase
          .from('sop_onboarding_items')
          .select('id, task, deadline_days, sort_order, template_id')
          .in('template_id', templateIds)
          .order('sort_order');
        items = (rawItems || []).map(it => {
          const tpl = templates!.find(t => t.id === it.template_id);
          const sop = sops.find(s => s.id === tpl?.sop_id);
          return { id: it.id, task: it.task, deadline_days: it.deadline_days, sop_name: sop?.name || '' };
        });
      }

      // 4. Fallback: SOPs sem template usam o array `inputs`
      const fallback: { key: string; task: string; sop_name: string }[] = [];
      for (const sop of sops) {
        const hasTemplate = templates?.some(t => t.sop_id === sop.id);
        if (hasTemplate) continue;
        const checklist = Array.isArray((sop as any).inputs) ? (sop as any).inputs : [];
        checklist.forEach((it: any, idx: number) => {
          const text = typeof it === 'string' ? it : it.text || '';
          if (text) fallback.push({ key: `${sop.id}::${idx}::${text}`, task: text, sop_name: sop.name });
        });
      }

      return { sops, items, fallback };
    },
  });

  if (!role) return null;

  const totalAvailable = (data?.items.length || 0) + (data?.fallback.length || 0);

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/60 p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <ListTodo className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Onboarding que será criado</span>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">A carregar…</p>}

      {!isLoading && totalAvailable === 0 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Não existe SOP de onboarding para "{role}". Cria um SOP com tipo "Onboarding" e função "{role}" em Processos para automatizar.</span>
        </div>
      )}

      {!isLoading && totalAvailable > 0 && (
        <>
          <p className="text-[10px] text-muted-foreground">
            Desmarca os passos que não queres criar para este membro. Os marcados serão adicionados como tarefas no dia de início.
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {data!.items.map(it => {
              const checked = !excluded.includes(it.id);
              return (
                <label key={it.id} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={v => {
                      if (v) onChange(excluded.filter(x => x !== it.id));
                      else onChange([...excluded, it.id]);
                    }}
                    className="mt-0.5"
                  />
                  <span className="flex-1">{it.task}</span>
                  {it.deadline_days > 0 && <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">+{it.deadline_days}d</Badge>}
                </label>
              );
            })}
            {data!.fallback.map(it => {
              const checked = !excluded.includes(it.key);
              return (
                <label key={it.key} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={v => {
                      if (v) onChange(excluded.filter(x => x !== it.key));
                      else onChange([...excluded, it.key]);
                    }}
                    className="mt-0.5"
                  />
                  <span className="flex-1">{it.task}</span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">+7d</Badge>
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {totalAvailable - excluded.length} de {totalAvailable} passos serão criados.
          </p>
        </>
      )}
    </div>
  );
}