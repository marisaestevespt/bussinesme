import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List, SlidersHorizontal, X, Pencil, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCrmData } from '@/hooks/useCrmData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { CrmSummary } from './crm/CrmSummary';
import { CrmPipeline } from './crm/CrmPipeline';
import { CrmListView } from './crm/CrmListView';
import { CrmCustomView, EMPTY_FILTERS } from './crm/CrmCustomView';
import type { Filters } from './crm/CrmCustomView';
import { LeadDetailSheet } from './crm/LeadDetailSheet';
import { toast } from 'sonner';
import { useConfirm, usePrompt } from '@/components/ui/confirm-dialog';

type ViewType = 'pipeline' | 'list' | string; // string = saved view id

export function CommercialCRM() {
  const [view, setView] = useState<ViewType>('pipeline');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [manageStagesOpen, setManageStagesOpen] = useState(false);
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const confirm = useConfirm();
  const askText = usePrompt();

  const { allLeads, activeLeads, leadsToContact, pipelineValue, winsThisMonth, upsertLead, deleteLead } = useCrmData();
  const { productGoals } = useCommercialData();
  const products = (productGoals.data || []).map(p => p.product_name);

  // Saved custom views
  const { data: savedViews = [] } = useQuery({
    queryKey: ['crm-saved-views'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_saved_views').select('*').order('sort_order');
      return data || [];
    },
  });

  const createView = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('crm_saved_views')
        .insert({ name, filters: EMPTY_FILTERS as any, sort_order: savedViews.length })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['crm-saved-views'] });
      setView(data.id);
    },
    onError: () => toast.error('Erro ao criar vista'),
  });

  const updateViewFilters = useMutation({
    mutationFn: async ({ id, filters }: { id: string; filters: Filters }) => {
      const { error } = await supabase.from('crm_saved_views')
        .update({ filters: filters as any, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-saved-views'] });
      toast.success('Filtros guardados');
    },
  });

  const renameView = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('crm_saved_views').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-saved-views'] }),
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_saved_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-saved-views'] });
      setView('pipeline');
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-commercial-team'],
    queryFn: async () => {
      const { data: ownerRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'owner');
      const ownerIds = (ownerRoles || []).map(r => r.user_id);
      const { data: commercialPerms } = await supabase
        .from('role_permissions').select('custom_role_id')
        .eq('module_key', 'comercial').eq('can_view', true);
      const commercialRoleIds = (commercialPerms || []).map(p => p.custom_role_id);
      let commercialUserIds: string[] = [];
      if (commercialRoleIds.length > 0) {
        const { data: tms } = await supabase
          .from('team_members')
          .select('profile_id, profiles!inner(user_id)')
          .in('custom_role_id', commercialRoleIds);
        commercialUserIds = ((tms || []) as any[]).map(t => t.profiles?.user_id).filter(Boolean);
      }
      const allUserIds = [...new Set([...ownerIds, ...commercialUserIds])];
      if (allUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name, user_id').in('user_id', allUserIds).order('full_name');
      return (data || []).map(p => ({ id: p.id, full_name: p.full_name }));
    },
  });

  const openLead = useCallback((lead: any) => { setSelectedLead(lead); setSheetOpen(true); }, []);
  const openNew = () => { setSelectedLead(null); setSheetOpen(true); };

  const handleSave = (lead: any) => {
    upsertLead.mutate(lead, {
      onSuccess: () => {
        setSheetOpen(false); setSelectedLead(null);
        if (lead.status === 'ganho' && !lead.id) toast.info('Lead marcada como Ganha! Pode converter em cliente no módulo de Clientes.');
      },
    });
  };

  const handleUpdateStatus = useCallback((leadId: string, newStatus: string) => {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;
    if (newStatus === 'perdido') { setSelectedLead({ ...lead, status: newStatus }); setSheetOpen(true); return; }
    // 'ganho' requer conversão completa: abrir sheet em vez de update direto
    if (newStatus === 'ganho') {
      setSelectedLead({ ...lead });
      setSheetOpen(true);
      toast.info('Para marcar como ganho, completa a conversão em "Converter em Cliente".');
      return;
    }
    upsertLead.mutate({ id: leadId, status: newStatus }, {
      onError: (err: any) => {
        const msg = err?.message || '';
        if (msg.includes('conversão para cliente')) {
          toast.error('Lead só pode ser marcado como ganho após conversão. Abre o lead e usa "Converter em Cliente".');
        }
      },
    });
  }, [allLeads, upsertLead]);

  const handleDelete = (id: string) => { deleteLead.mutate(id); };

  const handleNewView = async () => {
    const name = await askText({
      title: 'Nova vista',
      label: 'Nome',
      placeholder: 'Ex: Leads em proposta',
      confirmText: 'Criar',
    });
    if (name) createView.mutate(name);
  };

  const handleRenameView = async (id: string, currentName: string) => {
    const name = await askText({
      title: 'Renomear vista',
      label: 'Novo nome',
      defaultValue: currentName,
      confirmText: 'Guardar',
    });
    if (name && name !== currentName) renameView.mutate({ id, name });
  };

  const activeCustomView = savedViews.find(v => v.id === view);

  return (
    <div className="space-y-6">
      <CrmSummary
        activeCount={activeLeads.length}
        toContactToday={leadsToContact}
        pipelineValue={pipelineValue}
        winsThisMonth={winsThisMonth}
        allLeads={allLeads}
        onOpenLead={openLead}
      />

      {/* View tabs + Nova Lead */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-lg border p-1 flex-wrap">
          <Button variant={view === 'pipeline' ? 'default' : 'ghost'} size="sm" onClick={() => setView('pipeline')}>
            <LayoutGrid className="h-4 w-4 mr-1" /> CRM
          </Button>
          <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')}>
            <List className="h-4 w-4 mr-1" /> Lista
          </Button>

          {savedViews.map(sv => (
            <div key={sv.id} className="flex items-center">
              <Button
                variant={view === sv.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView(sv.id)}
                className="pr-1"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                {sv.name}
              </Button>
              {view === sv.id && (
                <div className="flex items-center ml-0.5 gap-0.5">
                  <Button variant="ghost" aria-label="Editar" size="icon" className="h-6 w-6" onClick={() => handleRenameView(sv.id, sv.name)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" aria-label="Eliminar vista" onClick={async () => {
                    const ok = await confirm({
                      title: 'Eliminar vista?',
                      description: `A vista "${sv.name}" e os seus filtros serão removidos.`,
                      confirmText: 'Eliminar',
                      variant: 'destructive',
                    });
                    if (ok) deleteView.mutate(sv.id);
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}

          <Button variant="ghost" size="sm" onClick={handleNewView} className="text-muted-foreground">
            <Plus className="h-4 w-4 mr-1" /> Vista
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setManageStagesOpen(true)}>
              <Settings2 className="h-3.5 w-3.5 mr-1" /> Gerir Etapas
            </Button>
          )}
          <Button size="sm" onClick={openNew} variant="soft"><Plus className="h-4 w-4 mr-1" /> Nova Lead</Button>
        </div>
      </div>

      {/* Views */}
      {view === 'pipeline' ? (
        <CrmPipeline leads={allLeads} onOpenLead={openLead} onUpdateStatus={handleUpdateStatus} manageStagesOpen={manageStagesOpen} onManageStagesChange={setManageStagesOpen} />
      ) : view === 'list' ? (
        <CrmListView leads={allLeads} onOpenLead={openLead} />
      ) : activeCustomView ? (
        <CrmCustomView
          key={activeCustomView.id}
          leads={allLeads}
          onOpenLead={openLead}
          initialFilters={activeCustomView.filters as unknown as Filters}
          onSaveFilters={(filters) => updateViewFilters.mutate({ id: activeCustomView.id, filters })}
          viewName={activeCustomView.name}
        />
      ) : null}

      <LeadDetailSheet
        open={sheetOpen}
        onOpenChange={v => { setSheetOpen(v); if (!v) setSelectedLead(null); }}
        lead={selectedLead}
        products={products}
        profiles={profiles}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
