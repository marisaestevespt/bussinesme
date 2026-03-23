import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { PipelineBoard } from '@/components/commercial/crm/PipelineBoard';
import { LeadDetailSheet } from '@/components/commercial/crm/LeadDetailSheet';
import { useCrmData } from '@/hooks/useCrmData';
import { useCommercialData } from '@/hooks/useCommercialData';

export default function CrmPipelines() {
  const qc = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);

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
        const { data: members } = await supabase.from('members').select('user_id').in('custom_role_id', commercialRoleIds);
        commercialUserIds = (members || []).map(m => m.user_id);
      }
      const allUserIds = [...new Set([...ownerIds, ...commercialUserIds])];
      if (allUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name, user_id').in('user_id', allUserIds).order('full_name');
      return (data || []).map(p => ({ id: p.id, full_name: p.full_name }));
    },
  });

  // Pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_pipelines').select('*').order('sort_order');
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

  // Create pipeline
  const createPipeline = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('crm_pipelines')
        .insert({ name, sort_order: pipelines.length })
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
    },
    onSuccess: (data) => {
      invalidateAll();
      setSelectedPipelineId(data.id);
      toast.success('Pipeline criado');
    },
    onError: () => toast.error('Erro ao criar pipeline'),
  });

  const renamePipeline = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('crm_pipelines').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const deletePipeline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_pipelines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setSelectedPipelineId(null);
      toast.success('Pipeline eliminado');
    },
  });

  // Stages
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

  // Move lead to stage
  const moveLeadToStage = useMutation({
    mutationFn: async ({ pipelineId, leadId, stageId }: { pipelineId: string; leadId: string; stageId: string }) => {
      // Upsert
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
        .delete()
        .eq('pipeline_id', pipelineId)
        .eq('lead_id', leadId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const handleNewPipeline = () => {
    const name = window.prompt('Nome do novo pipeline:');
    if (name?.trim()) createPipeline.mutate(name.trim());
  };

  const handleRenamePipeline = (id: string, current: string) => {
    const name = window.prompt('Novo nome:', current);
    if (name?.trim() && name.trim() !== current) renamePipeline.mutate({ id, name: name.trim() });
  };

  const handleDeletePipeline = (id: string, name: string) => {
    if (confirm(`Eliminar pipeline "${name}" e todas as suas etapas?`)) deletePipeline.mutate(id);
  };

  const handleAddStage = (pipelineId: string) => {
    const name = window.prompt('Nome da nova etapa:');
    if (name?.trim()) addStage.mutate({ pipelineId, name: name.trim() });
  };

  const openLead = useCallback((lead: any) => { setSelectedLead(lead); setSheetOpen(true); }, []);

  const handleSaveLead = (lead: any) => {
    upsertLead.mutate(lead, { onSuccess: () => { setSheetOpen(false); setSelectedLead(null); } });
  };

  const activePipeline = pipelines.find(p => p.id === selectedPipelineId) || pipelines[0] || null;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <BackNavigation parentRoute="/hub/comercial/crm" parentLabel="Voltar ao CRM" />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pipelines</h1>
          <Button size="sm" onClick={handleNewPipeline}>
            <Plus className="h-4 w-4 mr-1" /> Novo Pipeline
          </Button>
        </div>

        {pipelines.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">Ainda não criaste nenhum pipeline.</p>
              <Button onClick={handleNewPipeline}><Plus className="h-4 w-4 mr-1" /> Criar Pipeline</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pipeline selector tabs */}
            <div className="flex items-center gap-1 rounded-lg border p-1 flex-wrap">
              {pipelines.map(p => (
                <div key={p.id} className="flex items-center">
                  <Button
                    variant={activePipeline?.id === p.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedPipelineId(p.id)}
                  >
                    {p.name}
                    <Badge variant="secondary" className="ml-1.5 text-xs">
                      {pipelineLeads.filter(pl => pl.pipeline_id === p.id).length}
                    </Badge>
                  </Button>
                  {activePipeline?.id === p.id && (
                    <div className="flex items-center ml-0.5 gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRenamePipeline(p.id, p.name)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeletePipeline(p.id, p.name)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Active pipeline board */}
            {activePipeline && (
              <PipelineBoard
                pipeline={activePipeline}
                stages={allStages.filter(s => s.pipeline_id === activePipeline.id)}
                pipelineLeads={pipelineLeads.filter(pl => pl.pipeline_id === activePipeline.id)}
                allLeads={allLeads}
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
                onAddStage={() => handleAddStage(activePipeline.id)}
                onDeleteStage={(stageId) => deleteStage.mutate(stageId)}
                onRenameStage={(id, current) => {
                  const name = window.prompt('Novo nome:', current);
                  if (name?.trim() && name.trim() !== current) renameStage.mutate({ id, name: name.trim() });
                }}
              />
            )}
          </>
        )}

        <LeadDetailSheet
          open={sheetOpen}
          onOpenChange={v => { setSheetOpen(v); if (!v) setSelectedLead(null); }}
          lead={selectedLead}
          products={products}
          profiles={profiles}
          onSave={handleSaveLead}
          onDelete={(id) => deleteLead.mutate(id)}
        />
      </div>
    </AppLayout>
  );
}
