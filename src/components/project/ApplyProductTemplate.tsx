import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, parseISO } from 'date-fns';

interface Props {
  projectId: string;
  productId: string | null | undefined;
  clientId: string | undefined;
  projectStartDate: string | null | undefined;
}

/**
 * Parse a rule string like "+5 dias" into a number of days offset.
 * Returns null if unparseable.
 */
function parseRuleDays(rule: string | null): number | null {
  if (!rule) return null;
  const match = rule.match(/^\+?\s*(\d+)\s*dias?$/i);
  return match ? parseInt(match[1], 10) : null;
}

export function ApplyProductTemplate({ projectId, productId, clientId, projectStartDate }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Only show if project has a product associated
  if (!productId) return null;

  const applyMutation = useMutation({
    mutationFn: async () => {
      // 1. Fetch template tasks
      const { data: templateTasks, error: tErr } = await supabase
        .from('product_project_templates')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });

      if (tErr) throw tErr;
      if (!templateTasks?.length) throw new Error('Este produto não tem template de projeto definido.');

      // 2. Fetch project members with their team_member info (for role matching)
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('profile_id')
        .eq('project_id', projectId);

      const profileIds = (projectMembers || []).map((m: any) => m.profile_id);

      // Get team_members linked to those profiles
      let membersByRole: Record<string, string> = {}; // role_title → profile_id
      if (profileIds.length > 0) {
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('profile_id, role_title, work_areas')
          .in('profile_id', profileIds)
          .eq('status', 'ativo');

        for (const tm of teamMembers || []) {
          if (!tm.profile_id) continue;
          // Index by role_title (lowered)
          if (tm.role_title) {
            const key = tm.role_title.toLowerCase().trim();
            if (!membersByRole[key]) membersByRole[key] = tm.profile_id;
          }
          // Also index by work_areas
          const areas = Array.isArray(tm.work_areas) ? tm.work_areas : [];
          for (const area of areas) {
            const key = String(area).toLowerCase().trim();
            if (!membersByRole[key]) membersByRole[key] = tm.profile_id;
          }
        }
      }

      // 3. Fetch historical avg times for matching task names
      const taskNames = templateTasks.map(t => (t as any).task_name).filter(Boolean);
      let historicalAvg: Record<string, number> = {};

      if (taskNames.length > 0) {
        // Find completed tasks with same names and get their time entries
        const { data: historicalTasks } = await supabase
          .from('tasks')
          .select('id, name')
          .in('name', taskNames)
          .eq('status', 'concluida');

        if (historicalTasks?.length) {
          const taskIds = historicalTasks.map(t => t.id);
          const { data: timeEntries } = await supabase
            .from('task_time_entries')
            .select('task_id, duration_minutes')
            .in('task_id', taskIds);

          if (timeEntries?.length) {
            // Group by task name
            const taskIdToName: Record<string, string> = {};
            for (const t of historicalTasks) taskIdToName[t.id] = t.name;

            const totals: Record<string, { sum: number; count: number }> = {};
            for (const te of timeEntries) {
              const name = taskIdToName[te.task_id];
              if (!name) continue;
              if (!totals[name]) totals[name] = { sum: 0, count: 0 };
              totals[name].sum += te.duration_minutes;
              totals[name].count += 1;
            }

            for (const [name, { sum, count }] of Object.entries(totals)) {
              historicalAvg[name] = Math.round((sum / count / 60) * 10) / 10; // hours, 1 decimal
            }
          }
        }
      }

      // 4. Build tasks to insert
      const baseDate = projectStartDate ? parseISO(projectStartDate) : new Date();
      
      // First pass: create non-subtasks, then subtasks
      const parentTasks = templateTasks.filter((t: any) => !t.is_subtask);
      const subTasks = templateTasks.filter((t: any) => t.is_subtask);

      const insertedParentIds: Record<string, string> = {}; // template_id → new task id

      // Insert parent tasks
      for (const tmpl of parentTasks) {
        const t = tmpl as any;
        const responsibleKey = t.responsible?.toLowerCase().trim();
        const assignedTo = responsibleKey ? (membersByRole[responsibleKey] || null) : null;
        
        const ruleDays = parseRuleDays(t.rule);
        const deadline = ruleDays ? addDays(baseDate, ruleDays).toISOString().split('T')[0] : null;

        // Use template estimated_time, fallback to historical avg
        const estimatedTime = t.estimated_time != null
          ? Number(t.estimated_time)
          : (historicalAvg[t.task_name] ?? null);

        const { data: inserted, error } = await supabase
          .from('tasks')
          .insert({
            name: t.task_name,
            project_id: projectId,
            client_id: clientId || null,
            assigned_to: assignedTo,
            department: t.department || null,
            priority: t.priority || 'media',
            estimated_time: estimatedTime,
            notes: t.notes || null,
            deadline,
            status: 'pendente',
          })
          .select('id')
          .single();

        if (error) throw error;
        if (inserted) insertedParentIds[t.id] = inserted.id;
      }

      // Insert subtasks (link to last parent created before them)
      let lastParentId: string | null = null;
      // We need to figure out which parent each subtask belongs to
      // Logic: a subtask belongs to the parent task above it in sort_order
      for (const tmpl of templateTasks) {
        const t = tmpl as any;
        if (!t.is_subtask) {
          lastParentId = insertedParentIds[t.id] || null;
          continue;
        }

        const responsibleKey = t.responsible?.toLowerCase().trim();
        const assignedTo = responsibleKey ? (membersByRole[responsibleKey] || null) : null;
        
        const ruleDays = parseRuleDays(t.rule);
        const deadline = ruleDays ? addDays(baseDate, ruleDays).toISOString().split('T')[0] : null;

        const estimatedTime = t.estimated_time != null
          ? Number(t.estimated_time)
          : (historicalAvg[t.task_name] ?? null);

        const { error } = await supabase
          .from('tasks')
          .insert({
            name: t.task_name,
            project_id: projectId,
            client_id: clientId || null,
            assigned_to: assignedTo,
            parent_task_id: lastParentId,
            department: t.department || null,
            priority: t.priority || 'media',
            estimated_time: estimatedTime,
            notes: t.notes || null,
            deadline,
            status: 'pendente',
          });

        if (error) throw error;
      }

      return templateTasks.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} tarefas criadas a partir do template do produto.`);
      qc.invalidateQueries({ queryKey: ['project-tasks'] });
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao aplicar template.');
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
          Aplicar Template do Produto
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aplicar Template de Projeto</AlertDialogTitle>
          <AlertDialogDescription>
            Isto vai criar tarefas neste projeto com base no template definido no produto. 
            Os responsáveis serão atribuídos automaticamente com base na função dos participantes do projeto.
            {!projectStartDate && (
              <span className="block mt-2 text-amber-600 font-medium">
                ⚠ O projeto não tem data de início — os deadlines das regras usarão a data de hoje como referência.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
            {applyMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Aplicar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
