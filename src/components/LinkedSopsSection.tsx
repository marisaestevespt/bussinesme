import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FileText, Plus, Link2, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { parseISO, addDays } from 'date-fns';
import { addBusinessDays } from '@/lib/holidays';
import { getSopStatusInfo } from '@/lib/sopStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface LinkedSopsSectionProps {
  entityType: 'produto' | 'cliente' | 'projeto';
  entityId: string;
  productId?: string;
  clientId?: string;
  projectStartDate?: string | null;
  title?: string;
}

/** Calculate a due date from a base date + days offset */
function calcDate(base: Date, days: number, unit?: string): string {
  const d = unit === 'dias_corridos' ? addDays(base, days) : addBusinessDays(base, days);
  return d.toISOString().split('T')[0];
}

/** Copy SOP steps → client_onboarding, client_offboarding or client_renewals */
async function copySopStepsToClient(sopId: string, clientId: string, projectStartDate?: string | null) {
  const { data: sop } = await supabase.from('sops').select('sop_type, name').eq('id', sopId).single();
  if (!sop) return;

  // Prefer the typed `sop_type` enum; only fall back to name heuristics if it's null/undefined.
  const sopType = (sop as any).sop_type as string | null | undefined;
  const lname = sop.name?.toLowerCase() ?? '';
  const isOnboarding = sopType
    ? sopType === 'onboarding'
    : (lname.includes('onboarding') && !lname.includes('offboarding'));
  const isOffboarding = sopType
    ? sopType === 'offboarding'
    : lname.includes('offboarding');
  const isRenewal = sopType
    ? sopType === 'renovacao'
    : lname.includes('renovação') || lname.includes('renovacao');

  if (!isOnboarding && !isOffboarding && !isRenewal) return;

  const targetTable = isOnboarding
    ? 'client_onboarding'
    : isOffboarding
      ? 'client_offboarding'
      : 'client_renewals';

  // For renewals, allow multiple cycles — only skip if there is already content for this cycle
  let nextCycleNumber = 1;
  if (isRenewal) {
    const { data: maxCycle } = await supabase
      .from('client_renewals')
      .select('cycle_number')
      .eq('client_id', clientId)
      .order('cycle_number', { ascending: false })
      .limit(1) as any;
    if (maxCycle?.length) nextCycleNumber = (maxCycle[0].cycle_number || 0) + 1;
  } else {
    const { data: existing } = await supabase.from(targetTable).select('id').eq('client_id', clientId).limit(1) as any;
    if (existing?.length) return;
  }

  const { data: steps } = await supabase
    .from('sop_steps')
    .select('*')
    .eq('sop_id', sopId)
    .order('sort_order', { ascending: true });

  if (!steps?.length) return;

  const baseDate = projectStartDate ? parseISO(projectStartDate) : new Date();

  // Build rows with cascading "apos_passo_anterior" support
  const rows: any[] = [];
  let prevDueDate: string | null = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as any;
    let dueDate: string | null = null;

    if (step.deadline_days != null) {
      if (step.deadline_trigger === 'apos_passo_anterior' && prevDueDate) {
        // Base on previous step's due date
        dueDate = calcDate(parseISO(prevDueDate), step.deadline_days, step.deadline_unit);
      } else {
        // For renewals "antes_fim_ciclo", subtract days from baseDate (which is the cycle end)
        const offset = isRenewal && step.deadline_trigger === 'antes_fim_ciclo'
          ? -Math.abs(step.deadline_days)
          : step.deadline_days;
        dueDate = calcDate(baseDate, offset, step.deadline_unit);
      }
    }

    prevDueDate = dueDate;

    const row: any = {
      client_id: clientId,
      activity: step.description || '',
      responsible: step.responsible || null,
      rule_days: step.deadline_days ?? null,
      rule_unit: step.deadline_unit || 'dias_uteis',
      rule_trigger: step.deadline_trigger || 'inicio_cliente',
      due_date: dueDate,
      sort_order: i,
      completed: false,
    };
    if (isRenewal) row.cycle_number = nextCycleNumber;
    rows.push(row);
  }

  await supabase.from(targetTable).insert(rows);
  return targetTable;
}

/**
 * Recalculate due dates for items with rule_trigger='apos_passo_anterior'
 * after a step is completed. Uses the actual completion date (today) as base.
 */
export async function recalcCascadingDates(
  table: 'client_onboarding' | 'client_offboarding' | 'client_renewals',
  clientId: string,
  completedItemSortOrder: number,
) {
  // Fetch all items for this client, ordered
  const { data: items } = await supabase
    .from(table)
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true }) as any;

  if (!items?.length) return;

  const today = new Date().toISOString().split('T')[0];

  // Find items after the completed one that depend on previous step
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.sort_order <= completedItemSortOrder) continue;
    if (item.rule_trigger !== 'apos_passo_anterior') continue;
    if (item.completed) continue;
    if (item.rule_days == null) continue;

    // The previous item's due_date or completion date
    const prevItem = items[i - 1];
    const prevBase = prevItem?.completed ? (today) : prevItem?.due_date;
    if (!prevBase) continue;

    const newDueDate = calcDate(parseISO(prevBase), item.rule_days, item.rule_unit);

    if (newDueDate !== item.due_date) {
      await supabase.from(table).update({ due_date: newDueDate }).eq('id', item.id);
      // Update in-memory for cascading
      items[i] = { ...items[i], due_date: newDueDate };
    }
  }
}

export function LinkedSopsSection({ entityType, entityId, productId, clientId, projectStartDate, title = 'Processos' }: LinkedSopsSectionProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: sops = [] } = useQuery({
    queryKey: ['linked-sops', entityType, entityId, productId],
    queryFn: async () => {
      if (entityType === 'cliente') {
        const { data: directData } = await supabase.from('sops').select('*')
          .eq('linked_entity_type', 'cliente')
          .eq('linked_entity_id', entityId) as any;
        const direct = directData || [];
        if (productId) {
          const { data: prodData } = await supabase.from('sops').select('*')
            .eq('linked_entity_type', 'produto')
            .eq('linked_entity_id', productId) as any;
          const prodSops = prodData || [];
          const map = new Map([...direct, ...prodSops].map((s: any) => [s.id, s]));
          return Array.from(map.values());
        }
        return direct;
      }
      const { data } = await supabase.from('sops').select('*')
        .eq('linked_entity_type', entityType)
        .eq('linked_entity_id', entityId) as any;
      return data || [];
    },
    enabled: !!entityId,
  });

  // All SOPs for linking dialog
  const { data: allSops = [] } = useQuery({
    queryKey: ['all-sops-for-link'],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('id, sop_id, name, status, linked_entity_type, linked_entity_id').order('name') as any;
      return data || [];
    },
    enabled: dialogOpen,
  });

  const linkedIds = new Set(sops.map((s: any) => s.id));

  const filteredSops = allSops.filter((s: any) => {
    if (linkedIds.has(s.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.sop_id?.toLowerCase().includes(q);
  });

  const linkMutation = useMutation({
    mutationFn: async (sopId: string) => {
      const { error } = await supabase.from('sops').update({
        linked_entity_type: entityType,
        linked_entity_id: entityId,
      } as any).eq('id', sopId);
      if (error) throw error;

      // When linking to a project with a client, copy portal-visible steps
      if (entityType === 'projeto' && clientId) {
        const copied = await copySopStepsToClient(sopId, clientId, projectStartDate);
        if (copied) {
          return copied; // 'client_onboarding' or 'client_offboarding'
        }
      }
      return null;
    },
    onSuccess: (copied) => {
      qc.invalidateQueries({ queryKey: ['linked-sops', entityType, entityId] });
      if (copied) {
        qc.invalidateQueries({ queryKey: [copied] });
        const label = copied === 'client_onboarding'
          ? 'onboarding'
          : copied === 'client_offboarding'
            ? 'offboarding'
            : 'renovação';
        toast.success(`Processo associado — checklist de ${label} copiada para o cliente`);
      } else {
        toast.success('Processo associado');
      }
    },
    onError: () => toast.error('Erro ao associar processo'),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (sopId: string) => {
      const { error } = await supabase.from('sops').update({
        linked_entity_type: 'geral',
        linked_entity_id: null,
      } as any).eq('id', sopId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['linked-sops', entityType, entityId] });
      toast.success('Processo desassociado');
    },
  });

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title} {sops.length > 0 && `(${sops.length})`}
        </h3>
        <Button size="sm" variant="outline" className="gap-2 h-7 text-xs" onClick={() => { setDialogOpen(true); setSearch(''); }}>
          <Plus className="h-3.5 w-3.5" /> Associar Processo
        </Button>
      </div>

      {sops.length === 0 ? (
        <EmptyHint>Nenhum processo associado.</EmptyHint>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sops.map((sop: any) => {
            const st = getSopStatusInfo(sop.status);
            return (
              <Card key={sop.id} className="group cursor-pointer hover:shadow-md transition-shadow relative">
                <CardContent className="p-4" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-muted-foreground">{sop.sop_id}</span>
                    <div className="flex items-center gap-1">
                      <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
                      <button
                        onClick={e => { e.stopPropagation(); unlinkMutation.mutate(sop.id); }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1"
                        title="Desassociar"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="font-medium text-sm line-clamp-2">{sop.name}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Associar Processo</DialogTitle></DialogHeader>
          <Input
            placeholder="Pesquisar processos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filteredSops.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {search ? 'Nenhum processo encontrado' : 'Todos os processos já estão associados'}
              </p>
            ) : (
              filteredSops.map((sop: any) => {
                const st = getSopStatusInfo(sop.status);
                return (
                  <button
                    key={sop.id}
                    onClick={() => { linkMutation.mutate(sop.id); setDialogOpen(false); }}
                    className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sop.name}</p>
                      <p className="text-xs text-muted-foreground">{sop.sop_id}</p>
                    </div>
                    <Badge className={cn('text-[10px] shrink-0', st.color)}>{st.label}</Badge>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
