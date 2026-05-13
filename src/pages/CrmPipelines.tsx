import { useState, useCallback, useMemo } from 'react';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Search, X, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { PipelineBoard } from '@/components/commercial/crm/PipelineBoard';
import { PipelineFormDialog } from '@/components/commercial/crm/PipelineFormDialog';
import { LeadDetailSheet } from '@/components/commercial/crm/LeadDetailSheet';
import { useCrmData } from '@/hooks/useCrmData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { resolveProductId } from '@/lib/productResolver';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CrmPipelines() {
  const sectorConfig = useSectorConfig();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [openPipelineId, setOpenPipelineId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [createLeadStageId, setCreateLeadStageId] = useState<string | null>(null);
  const [stagesDialogOpen, setStagesDialogOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { allLeads, upsertLead, deleteLead } = useCrmData();
  const { productGoals } = useCommercialData();
  const products = (productGoals.data || []).map(p => p.product_name);

  // Profiles for lead assignment
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

  // Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list-pipelines'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name').is('archived_at', null);
      return (data || []).map(p => ({ id: p.id, name: p.name }));
    },
  });

  // Pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_pipelines').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Stages for all pipelines
  const { data: allStages = [] } = useQuery({
    queryKey: ['crm-pipeline-stages'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_pipeline_stages').select('*').order('sort_order');
      return data || [];
    },
  });

  // Pipeline leads mapping
  const { data: pipelineLeads = [] } = useQuery({
    queryKey: ['crm-pipeline-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_pipeline_leads').select('*').order('sort_order');
      return data || [];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['crm-pipelines'] });
    qc.invalidateQueries({ queryKey: ['crm-pipeline-stages'] });
    qc.invalidateQueries({ queryKey: ['crm-pipeline-leads'] });
  };

  // Create / Update pipeline
  const savePipeline = useMutation({
    mutationFn: async (payload: any) => {
      const resolvedProduct = payload.product === '__none' ? null : payload.product;
      const productId = await resolveProductId(resolvedProduct);
      const cleaned = {
        name: payload.name,
        start_date: payload.start_date,
        end_date: payload.end_date,
        product: resolvedProduct,
        product_id: productId,
        project_id: payload.project_id === '__none' ? null : payload.project_id,
      };
      if (payload.id) {
        const { error } = await supabase.from('crm_pipelines').update(cleaned).eq('id', payload.id);
        if (error) throw error;
        return { id: payload.id };
      } else {
        const { data, error } = await supabase.from('crm_pipelines')
          .insert({ ...cleaned, sort_order: pipelines.length })
          .select('id')
          .single();
        if (error) throw error;
        // Create default stages
        const defaults = [
          { name: 'Entrada', color: '#6366f1', sort_order: 0 },
          { name: 'Em Progresso', color: '#f59e0b', sort_order: 1 },
          { name: 'Concluído', color: '#22c55e', sort_order: 2 },
        ];
        await supabase.from('crm_pipeline_stages')
          .insert(defaults.map(s => ({ ...s, pipeline_id: data.id })));
        return data;
      }
    },
    onSuccess: (data) => {
      invalidateAll();
      setFormOpen(false);
      setEditingPipeline(null);
      setOpenPipelineId(data.id);
      toast.success(editingPipeline ? 'Pipeline atualizado' : 'Pipeline criado');
    },
    onError: () => toast.error('Erro ao guardar pipeline'),
  });

  const deletePipeline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_pipelines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setOpenPipelineId(null);
      toast.success('Pipeline eliminado');
    },
  });

  // Stage mutations
  const addStage = useMutation({
    mutationFn: async ({ pipelineId, name }: { pipelineId: string; name: string }) => {
      const stagesForPipeline = allStages.filter(s => s.pipeline_id === pipelineId);
      const { error } = await supabase.from('crm_pipeline_stages')
        .insert({ pipeline_id: pipelineId, name, sort_order: stagesForPipeline.length });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const deleteStage = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase.from('crm_pipeline_stages').delete().eq('id', stageId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const renameStage = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('crm_pipeline_stages').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  // Reorder stage
  const reorderStage = useMutation({
    mutationFn: async ({ stageId, direction, pipelineId }: { stageId: string; direction: 'left' | 'right'; pipelineId: string }) => {
      const pipelineStages = allStages.filter(s => s.pipeline_id === pipelineId).sort((a, b) => a.sort_order - b.sort_order);
      const idx = pipelineStages.findIndex(s => s.id === stageId);
      if (idx < 0) return;
      const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= pipelineStages.length) return;
      const current = pipelineStages[idx];
      const swap = pipelineStages[swapIdx];
      await Promise.all([
        supabase.from('crm_pipeline_stages').update({ sort_order: swap.sort_order }).eq('id', current.id),
        supabase.from('crm_pipeline_stages').update({ sort_order: current.sort_order }).eq('id', swap.id),
      ]);
    },
    onSuccess: () => invalidateAll(),
  });

  // Move lead
  const moveLeadToStage = useMutation({
    mutationFn: async ({ pipelineId, leadId, stageId }: { pipelineId: string; leadId: string; stageId: string }) => {
      const existing = pipelineLeads.find(pl => pl.pipeline_id === pipelineId && pl.lead_id === leadId);
      if (existing) {
        const { error } = await supabase.from('crm_pipeline_leads')
          .update({ stage_id: stageId, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_pipeline_leads')
          .insert({ pipeline_id: pipelineId, lead_id: leadId, stage_id: stageId });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAll(),
  });

  const removeLeadFromPipeline = useMutation({
    mutationFn: async ({ pipelineId, leadId }: { pipelineId: string; leadId: string }) => {
      const { error } = await supabase.from('crm_pipeline_leads')
        .delete().eq('pipeline_id', pipelineId).eq('lead_id', leadId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const openLead = useCallback((lead: any) => { setSelectedLead(lead); setSheetOpen(true); }, []);

  const handleSaveLead = (lead: any) => {
    upsertLead.mutate(lead, {
      onSuccess: (_, variables) => {
        // If creating a new lead from a pipeline stage, add it to that stage
        if (!variables.id && createLeadStageId && activePipeline) {
          // We need the new lead's id - refetch leads and find the newest one
          qc.invalidateQueries({ queryKey: ['crm'] }).then(() => {
            const freshLeads = qc.getQueryData<any[]>(['crm', 'leads']) || [];
            const newLead = freshLeads.find((l: any) => l.name === variables.name);
            if (newLead) {
              moveLeadToStage.mutate({ pipelineId: activePipeline.id, leadId: newLead.id, stageId: createLeadStageId });
            }
          });
        }
        setSheetOpen(false);
        setSelectedLead(null);
        setCreateLeadStageId(null);
      },
    });
  };

  const handleCreateLead = useCallback((stageId: string) => {
    setCreateLeadStageId(stageId);
    setSelectedLead(null);
    setSheetOpen(true);
  }, []);

  // Toggle open pipeline (only one at a time)
  const togglePipeline = (id: string) => {
    setOpenPipelineId(prev => prev === id ? null : id);
  };

  // Filtered pipelines
  const filteredPipelines = useMemo(() => {
    return pipelines.filter(p => {
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterProduct && filterProduct !== '__all' && p.product !== filterProduct) return false;
      if (filterStatus && filterStatus !== '__all' && p.status !== filterStatus) return false;
      return true;
    });
  }, [pipelines, searchTerm, filterProduct, filterStatus]);

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null;
    return projects.find(p => p.id === projectId)?.name || null;
  };

  const activePipeline = openPipelineId ? pipelines.find(p => p.id === openPipelineId) : null;

  // ── FULL VIEW: pipeline is open ──
  if (activePipeline) {
    const projectName = getProjectName(activePipeline.project_id);
    return (
      <AppLayout>
        <div className="space-y-6 w-full">
          {/* Header with X to close */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">{activePipeline.name}</h1>
                <Badge variant={activePipeline.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  {activePipeline.status === 'active' ? 'Ativo' : 'Arquivado'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {activePipeline.start_date && (
                  <span>{format(new Date(activePipeline.start_date), 'dd/MM/yyyy')} — {activePipeline.end_date ? format(new Date(activePipeline.end_date), 'dd/MM/yyyy') : '...'}</span>
                )}
                {activePipeline.product && <span>• {activePipeline.product}</span>}
                {projectName && <span>• {projectName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setStagesDialogOpen(true)}>
                <Settings2 className="h-3.5 w-3.5 mr-1" /> Editar Etapas
              </Button>
              <Button variant="ghost" aria-label="Editar" size="icon" className="h-8 w-8" onClick={() => { setEditingPipeline(activePipeline); setFormOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                aria-label="Eliminar pipeline"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Eliminar pipeline?',
                    description: `"${activePipeline.name}" e a sua estrutura de etapas serão removidos. Os leads não são eliminados.`,
                    confirmText: 'Eliminar',
                    variant: 'destructive',
                  });
                  if (ok) deletePipeline.mutate(activePipeline.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 ml-2" onClick={() => setOpenPipelineId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Board */}
          <PipelineBoard
            pipeline={activePipeline}
            stages={allStages.filter(s => s.pipeline_id === activePipeline.id)}
            pipelineLeads={pipelineLeads.filter(pl => pl.pipeline_id === activePipeline.id)}
            allLeads={allLeads}
            stagesDialogOpen={stagesDialogOpen}
            onStagesDialogChange={setStagesDialogOpen}
            onMoveLeadToStage={(leadId, stageId) =>
              moveLeadToStage.mutate({ pipelineId: activePipeline.id, leadId, stageId })
            }
            onAddLeadToPipeline={(leadId, stageId) =>
              moveLeadToStage.mutate({ pipelineId: activePipeline.id, leadId, stageId })
            }
            onRemoveLeadFromPipeline={(leadId) =>
              removeLeadFromPipeline.mutate({ pipelineId: activePipeline.id, leadId })
            }
            onOpenLead={openLead}
            onCreateLead={handleCreateLead}
            onAddStage={(name) => {
              addStage.mutate({ pipelineId: activePipeline.id, name });
            }}
            onDeleteStage={(stageId) => deleteStage.mutate(stageId)}
            onRenameStage={(id, newName) => {
              renameStage.mutate({ id, name: newName });
            }}
            onReorderStage={(stageId, direction) =>
              reorderStage.mutate({ stageId, direction, pipelineId: activePipeline.id })
            }
          />

          <PipelineFormDialog
            open={formOpen}
            onOpenChange={v => { setFormOpen(v); if (!v) setEditingPipeline(null); }}
            onSave={(data) => savePipeline.mutate({ ...data, id: editingPipeline?.id })}
            products={products}
            projects={projects}
            initialData={editingPipeline}
          />
          <LeadDetailSheet
            open={sheetOpen}
            onOpenChange={v => { setSheetOpen(v); if (!v) setSelectedLead(null); }}
            lead={selectedLead}
            products={products}
            profiles={profiles}
            onSave={handleSaveLead}
            onDelete={async (id) => {
              const lead = allLeads.find(l => l.id === id);
              const ok = await confirm({
                title: 'Eliminar lead?',
                description: `"${lead?.name || 'Lead sem nome'}" será permanentemente eliminada. Esta ação não pode ser desfeita.`,
                confirmText: 'Eliminar',
                variant: 'destructive',
              });
              if (ok) deleteLead.mutate(id);
            }}
          />
        </div>
      </AppLayout>
    );
  }

  // ── LIST VIEW: search & select ──
  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <BackNavigation parentRoute="/hub/comercial/crm" parentLabel="Voltar ao CRM" />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Pipelines</h1>
          <Button size="sm" onClick={() => { setEditingPipeline(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Pipeline
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={sectorConfig.t('produto')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os produtos</SelectItem>
              {products.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="archived">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Pipeline list */}
        {filteredPipelines.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                {pipelines.length === 0 ? 'Ainda não criaste nenhum pipeline.' : 'Nenhum pipeline encontrado com esses filtros.'}
              </p>
              {pipelines.length === 0 && (
                <Button onClick={() => { setEditingPipeline(null); setFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Criar Pipeline
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg divide-y divide-border overflow-hidden">
            {filteredPipelines.map(p => {
              const leadsCount = pipelineLeads.filter(pl => pl.pipeline_id === p.id).length;
              const projectName = getProjectName(p.project_id);

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setOpenPipelineId(p.id)}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-3">
                    <span className="font-medium truncate">{p.name}</span>
                    {p.product && <span className="text-xs text-muted-foreground shrink-0">• {p.product}</span>}
                    {projectName && <span className="text-xs text-muted-foreground shrink-0">• {projectName}</span>}
                    {p.start_date && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(p.start_date), 'dd/MM/yyyy')} — {p.end_date ? format(new Date(p.end_date), 'dd/MM/yyyy') : '...'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {p.status === 'active' ? 'Ativo' : 'Arquivado'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{leadsCount} leads</Badge>
                    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => { setEditingPipeline(p); setFormOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label="Eliminar pipeline"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Eliminar pipeline?',
                            description: `"${p.name}" e a sua estrutura de etapas serão removidos.`,
                            confirmText: 'Eliminar',
                            variant: 'destructive',
                          });
                          if (ok) deletePipeline.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PipelineFormDialog
          open={formOpen}
          onOpenChange={v => { setFormOpen(v); if (!v) setEditingPipeline(null); }}
          onSave={(data) => savePipeline.mutate({ ...data, id: editingPipeline?.id })}
          products={products}
          projects={projects}
          initialData={editingPipeline}
        />
      </div>
    </AppLayout>
  );
}
