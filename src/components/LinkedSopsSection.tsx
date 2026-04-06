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

const SOP_STATUSES: Record<string, { label: string; color: string }> = {
  para_criar: { label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  em_criacao: { label: 'Em criação', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  em_revisao: { label: 'Em revisão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  off: { label: 'Off', color: 'bg-red-100 text-red-800 border-red-200' },
};

interface LinkedSopsSectionProps {
  entityType: 'produto' | 'cliente' | 'projeto';
  entityId: string;
  productId?: string;
  clientId?: string;
  projectStartDate?: string | null;
  title?: string;
}

/** Copy SOP portal_visible steps → client_onboarding or client_offboarding */
async function copySopStepsToClient(sopId: string, clientId: string, projectStartDate?: string | null) {
  // Fetch SOP to determine type
  const { data: sop } = await supabase.from('sops').select('sop_type, name').eq('id', sopId).single();
  if (!sop) return;

  const isOnboarding = (sop as any).sop_type === 'onboarding' || (sop.name?.toLowerCase().includes('onboarding') && !sop.name?.toLowerCase().includes('offboarding'));
  const isOffboarding = (sop as any).sop_type === 'offboarding' || (sop.name?.toLowerCase().includes('offboarding'));

  if (!isOnboarding && !isOffboarding) return;

  const targetTable = isOnboarding ? 'client_onboarding' : 'client_offboarding';

  // Check if client already has items from this SOP (avoid duplicates)
  const { data: existing } = await supabase.from(targetTable).select('id').eq('client_id', clientId).limit(1) as any;
  if (existing?.length) return; // already has checklist items

  // Fetch portal-visible steps
  const { data: steps } = await supabase
    .from('sop_steps')
    .select('*')
    .eq('sop_id', sopId)
    .eq('portal_visible', true)
    .order('sort_order', { ascending: true });

  if (!steps?.length) return;

  const baseDate = projectStartDate ? parseISO(projectStartDate) : new Date();

  const rows = steps.map((step: any, i: number) => {
    let dueDate: string | null = null;
    if (step.deadline_days != null) {
      const d = step.deadline_unit === 'dias_corridos'
        ? addDays(baseDate, step.deadline_days)
        : addBusinessDays(baseDate, step.deadline_days);
      dueDate = d.toISOString().split('T')[0];
    }
    return {
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
  });

  await supabase.from(targetTable).insert(rows);
  return targetTable;
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
            .eq('linked_entity_id', productId)
            .eq('apply_to_all_active_clients', true) as any;
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
        const label = copied === 'client_onboarding' ? 'onboarding' : 'offboarding';
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
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => { setDialogOpen(true); setSearch(''); }}>
          <Plus className="h-3.5 w-3.5" /> Associar Processo
        </Button>
      </div>

      {sops.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum processo associado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sops.map((sop: any) => {
            const st = SOP_STATUSES[sop.status] || SOP_STATUSES.para_criar;
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
                const st = SOP_STATUSES[sop.status] || SOP_STATUSES.para_criar;
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
