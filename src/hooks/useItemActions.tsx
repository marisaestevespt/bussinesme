import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ResponsibilityDetailDialog } from '@/components/ResponsibilityDetailDialog';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import type { UnifiedItem, ResponsibilitySource } from '@/hooks/useUnifiedResponsibilities';

const DIALOG_SOURCES: ResponsibilitySource[] = ['rotina'];

function getItemRoute(item: UnifiedItem): string | null {
  switch (item.source) {
    case 'tarefa': return `/tarefas`;
    case 'crm': return `/comercial/crm`;
    case 'conteudo': return `/conteudo/${item.sourceId}`;
    case 'reuniao': return `/hub/reunioes/${item.sourceId}`;
    case 'projeto': return `/hub/projetos/${item.sourceId}`;
    case 'acao_venda': return `/comercial/acoes`;
    case 'rotina': return `/executive/planeamento`;
    default: return null;
  }
}

export function useItemActions() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);

  const { data: editTask } = useQuery({
    queryKey: ['task-edit', editTaskId],
    enabled: !!editTaskId,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', editTaskId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const openItem = (item: UnifiedItem) => {
    if (item.source === 'tarefa') { setEditTaskId(item.sourceId); return; }
    if (DIALOG_SOURCES.includes(item.source)) { setSelectedItem(item); return; }
    const route = getItemRoute(item);
    if (route) navigate(route);
  };

  const dialogs = (
    <>
      <ResponsibilityDetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
      />
      <TaskFormDialog
        open={!!editTaskId}
        onOpenChange={(open) => { if (!open) setEditTaskId(null); }}
        editingTask={editTask ?? undefined}
        onSuccess={() => {
          setEditTaskId(null);
          qc.invalidateQueries({ queryKey: ['unified-tasks'] });
        }}
      />
    </>
  );

  return { openItem, dialogs };
}
