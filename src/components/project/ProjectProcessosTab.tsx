import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, GripVertical, ChevronDown, Users } from 'lucide-react';
import { toast } from 'sonner';
import { LinkedSopsSection, recalcCascadingDates } from '@/components/LinkedSopsSection';
import { ApplyProductTemplate } from '@/components/project/ApplyProductTemplate';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  clientId: string | undefined;
  productId?: string | null;
  projectStartDate?: string | null;
}

// ─── Checklist Table ─────────────────────────────────────────────
function ChecklistTable({
  title,
  items,
  onAdd,
  onUpdate,
  onDelete,
  emptyText,
}: {
  title: string;
  items: any[];
  onAdd: () => void;
  onUpdate: (id: string, fields: Record<string, any>) => void;
  onDelete: (id: string) => void;
  emptyText: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{title}</CardTitle>
            {items.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {items.filter((i: any) => i.completed).length}/{items.length}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-primary text-primary-foreground px-4 py-2.5 font-medium text-xs grid grid-cols-[32px_1fr_100px_100px_100px_100px_32px] gap-2">
          <span>✓</span>
          <span>Atividade</span>
          <span>Fase</span>
          <span>Responsável</span>
          <span>Prazo</span>
          <span>Docs/Links</span>
          <span></span>
        </div>
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">{emptyText}</p>
        ) : (
          items.map((item: any) => (
            <div key={item.id} className="px-4 py-2 text-xs grid grid-cols-[32px_1fr_100px_100px_100px_100px_32px] gap-2 border-b items-center">
              <Checkbox
                checked={!!item.completed}
                onCheckedChange={(v) => onUpdate(item.id, { completed: !!v })}
              />
              <Input
                className="h-7 text-xs"
                defaultValue={item.activity || ''}
                placeholder="Atividade..."
                onBlur={(e) => onUpdate(item.id, { activity: e.target.value })}
              />
              <Input
                className="h-7 text-xs"
                defaultValue={item.phase || ''}
                placeholder="Fase"
                onBlur={(e) => onUpdate(item.id, { phase: e.target.value })}
              />
              <Input
                className="h-7 text-xs"
                defaultValue={item.responsible || ''}
                placeholder="Quem"
                onBlur={(e) => onUpdate(item.id, { responsible: e.target.value })}
              />
              <Input
                type="date"
                className="h-7 text-xs"
                defaultValue={item.due_date || ''}
                onBlur={(e) => onUpdate(item.id, { due_date: e.target.value || null })}
              />
              <Input
                className="h-7 text-xs"
                defaultValue={item.documents_links || ''}
                placeholder="Link..."
                onBlur={(e) => onUpdate(item.id, { documents_links: e.target.value })}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Activities Table (no checkbox) ──────────────────────────────
function ActivitiesTable({
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  items: any[];
  onAdd: () => void;
  onUpdate: (id: string, fields: Record<string, any>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Mapa de Atividades Base</CardTitle>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-primary text-primary-foreground px-4 py-2.5 font-medium text-xs grid grid-cols-[1fr_120px_120px_120px_32px] gap-2">
          <span>Atividade</span>
          <span>Fase</span>
          <span>Responsável</span>
          <span>Regra</span>
          <span></span>
        </div>
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Sem atividades base</p>
        ) : (
          items.map((item: any) => (
            <div key={item.id} className="px-4 py-2 text-xs grid grid-cols-[1fr_120px_120px_120px_32px] gap-2 border-b items-center">
              <Input
                className="h-7 text-xs"
                defaultValue={item.activity || ''}
                placeholder="Atividade..."
                onBlur={(e) => onUpdate(item.id, { activity: e.target.value })}
              />
              <Input
                className="h-7 text-xs"
                defaultValue={item.phase || ''}
                placeholder="Fase"
                onBlur={(e) => onUpdate(item.id, { phase: e.target.value })}
              />
              <Input
                className="h-7 text-xs"
                defaultValue={item.responsible || ''}
                placeholder="Quem"
                onBlur={(e) => onUpdate(item.id, { responsible: e.target.value })}
              />
              <Input
                className="h-7 text-xs"
                defaultValue={item.rule || ''}
                placeholder="Regra"
                onBlur={(e) => onUpdate(item.id, { rule: e.target.value })}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectProcessosTab({ projectId, clientId, productId, projectStartDate }: Props) {
  const qc = useQueryClient();

  // ─── Onboarding ────────────────────────────────────────────────
  const onbKey = ['client_onboarding', clientId];
  const { data: onboarding = [] } = useQuery({
    queryKey: onbKey,
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await supabase.from('client_onboarding').select('*').eq('client_id', clientId).order('sort_order', { ascending: true });
      return data || [];
    },
    enabled: !!clientId,
  });

  const addOnboarding = useMutation({
    mutationFn: async () => {
      await supabase.from('client_onboarding').insert({ client_id: clientId!, activity: '', sort_order: onboarding.length });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: onbKey }),
  });

  const updateOnboarding = useMutation({
    mutationFn: async ({ id, ...fields }: any) => {
      await supabase.from('client_onboarding').update(fields).eq('id', id);
      // Recalculate cascading dates when completing
      if (fields.completed && clientId) {
        const item = onboarding.find((i: any) => i.id === id);
        if (item) await recalcCascadingDates('client_onboarding', clientId, item.sort_order ?? 0);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: onbKey }),
  });

  const deleteOnboarding = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('client_onboarding').delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: onbKey }),
  });

  // ─── Offboarding ──────────────────────────────────────────────
  const offKey = ['client_offboarding', clientId];
  const { data: offboarding = [] } = useQuery({
    queryKey: offKey,
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await supabase.from('client_offboarding').select('*').eq('client_id', clientId).order('sort_order', { ascending: true });
      return data || [];
    },
    enabled: !!clientId,
  });

  const addOffboarding = useMutation({
    mutationFn: async () => {
      await supabase.from('client_offboarding').insert({ client_id: clientId!, activity: '', sort_order: offboarding.length });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: offKey }),
  });

  const updateOffboarding = useMutation({
    mutationFn: async ({ id, ...fields }: any) => {
      await supabase.from('client_offboarding').update(fields).eq('id', id);
      if (fields.completed && clientId) {
        const item = offboarding.find((i: any) => i.id === id);
        if (item) await recalcCascadingDates('client_offboarding', clientId, item.sort_order ?? 0);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: offKey }),
  });

  const deleteOffboarding = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('client_offboarding').delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: offKey }),
  });

  // ─── Activities ───────────────────────────────────────────────
  const actKey = ['client_activities', clientId];
  const { data: activities = [] } = useQuery({
    queryKey: actKey,
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await supabase.from('client_activities').select('*').eq('client_id', clientId).order('sort_order', { ascending: true });
      return data || [];
    },
    enabled: !!clientId,
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      await supabase.from('client_activities').insert({ client_id: clientId!, activity: '', sort_order: activities.length });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: actKey }),
  });

  const updateActivity = useMutation({
    mutationFn: async ({ id, ...fields }: any) => {
      await supabase.from('client_activities').update(fields).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: actKey }),
  });

  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('client_activities').delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: actKey }),
  });

  if (!clientId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <LinkedSopsSection entityType="projeto" entityId={projectId} productId={productId || undefined} clientId={clientId} projectStartDate={projectStartDate} />
        </div>
        <ApplyProductTemplate projectId={projectId} productId={productId} clientId={clientId} projectStartDate={projectStartDate} />
        <p className="text-sm text-muted-foreground text-center py-6">Associe um cliente a este projeto para ver Onboarding, Offboarding e Atividades.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Apply Template Button */}
      <ApplyProductTemplate projectId={projectId} productId={productId} clientId={clientId} projectStartDate={projectStartDate} />

      {/* Processos e SOPs */}
      <LinkedSopsSection entityType="projeto" entityId={projectId} productId={productId || undefined} clientId={clientId} projectStartDate={projectStartDate} />

      {/* Processos do Cliente — collapsible group */}
      <Collapsible defaultOpen={false}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 bg-muted/30 border-b cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Processos do Cliente</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Onboarding, offboarding e atividades base</p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-4 space-y-4">
              {/* Onboarding */}
              <ChecklistTable
                title="Onboarding"
                items={onboarding}
                onAdd={() => addOnboarding.mutate()}
                onUpdate={(id, fields) => updateOnboarding.mutate({ id, ...fields })}
                onDelete={(id) => deleteOnboarding.mutate(id)}
                emptyText="Sem checklist de onboarding"
              />

              {/* Offboarding */}
              <ChecklistTable
                title="Offboarding"
                items={offboarding}
                onAdd={() => addOffboarding.mutate()}
                onUpdate={(id, fields) => updateOffboarding.mutate({ id, ...fields })}
                onDelete={(id) => deleteOffboarding.mutate(id)}
                emptyText="Sem checklist de offboarding"
              />

              {/* Mapa de Atividades Base */}
              <ActivitiesTable
                items={activities}
                onAdd={() => addActivity.mutate()}
                onUpdate={(id, fields) => updateActivity.mutate({ id, ...fields })}
                onDelete={(id) => deleteActivity.mutate(id)}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
