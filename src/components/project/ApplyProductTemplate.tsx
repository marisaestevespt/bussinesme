import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseISO } from 'date-fns';
import { addBusinessDays } from '@/lib/holidays';
import { addDays } from 'date-fns';

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

/** Calculate due date respecting rule_unit */
function calcDueDate(base: Date, days: number, unit?: string): string {
  const d = unit === 'dias_uteis' || !unit ? addBusinessDays(base, days) : addDays(base, days);
  return d.toISOString().split('T')[0];
}

export function ApplyProductTemplate({ projectId, productId, clientId, projectStartDate }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const applyMutation = useMutation({
    mutationFn: async () => {
      // 1. Fetch template tasks
      const { data: templateTasks, error: tErr } = await supabase
        .from('product_project_templates')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });

      if (tErr) throw tErr;

      // 2. Fetch onboarding template rows from product
      if (clientId) {
        const { data: onbTemplates } = await supabase
          .from('product_onboarding_templates')
          .select('*')
          .eq('product_id', productId)
          .order('sort_order');

        if (onbTemplates?.length) {
          const { data: existing } = await supabase
            .from('client_onboarding')
            .select('id')
            .eq('client_id', clientId)
            .limit(1);

          if (!existing?.length) {
            const baseDate = projectStartDate ? parseISO(projectStartDate) : new Date();
            const rows = onbTemplates.map((t: any, i: number) => {
              const ruleDays = t.rule_days ?? parseRuleDays(t.rule);
              return {
                client_id: clientId,
                activity: t.activity || '',
                phase: t.phase || null,
                responsible: t.responsible || null,
                rule: t.rule || null,
                rule_days: t.rule_days ?? null,
                rule_unit: t.rule_unit || 'dias_uteis',
                rule_trigger: t.rule_trigger || 'inicio_cliente',
                documents_links: t.documents_links || null,
                sort_order: i,
                completed: false,
                due_date: ruleDays != null ? calcDueDate(baseDate, ruleDays, t.rule_unit) : null,
              };
            });
            await supabase.from('client_onboarding').insert(rows);
          }
        }

        // 3. Fetch offboarding template rows from product
        const { data: offTemplates } = await supabase
          .from('product_offboarding_templates')
          .select('*')
          .eq('product_id', productId)
          .order('sort_order');

        if (offTemplates?.length) {
          const { data: existing } = await supabase
            .from('client_offboarding')
            .select('id')
            .eq('client_id', clientId)
            .limit(1);

          if (!existing?.length) {
            const rows = offTemplates.map((t: any, i: number) => {
              const ruleDays = t.rule_days ?? parseRuleDays(t.rule);
              return {
                client_id: clientId,
                activity: t.activity || '',
                phase: t.phase || null,
                responsible: t.responsible || null,
                rule: t.rule || null,
                rule_days: t.rule_days ?? null,
                rule_unit: t.rule_unit || 'dias_uteis',
                rule_trigger: t.rule_trigger || 'inicio_cliente',
                documents_links: t.documents_links || null,
                sort_order: i,
                completed: false,
                due_date: ruleDays != null ? calcDueDate(new Date(), ruleDays, t.rule_unit) : null,
              };
            });
            await supabase.from('client_offboarding').insert(rows);
          }
        }
      }

      // Copy product phases + deliverables to project
      const { data: productPhases } = await (supabase as any).from('product_phases').select('*').eq('product_id', productId).order('sort_order');
      if (productPhases?.length) {
        const { data: existingPhases } = await (supabase as any).from('project_phases').select('id').eq('project_id', projectId).limit(1);
        if (!existingPhases?.length) {
          // Fetch client conversion_date for data_conversao trigger
          let conversionDate: Date | null = null;
          if (clientId) {
            const { data: clientRow } = await supabase.from('clients').select('conversion_date, start_date').eq('id', clientId).single();
            const convDateStr = clientRow?.conversion_date || clientRow?.start_date;
            if (convDateStr) conversionDate = parseISO(convDateStr);
          }

          const projectBase = projectStartDate ? parseISO(projectStartDate) : new Date();
          let prevPhaseEnd: Date = projectBase;

          for (const pp of productPhases) {
            // Calculate planned dates from duration rules
            const trigger = pp.offset_trigger || 'inicio_projeto';
            const unit = pp.duration_unit || 'dias_uteis';
            const offsetDays = pp.offset_days ?? 0;

            // Determine base date for this phase
            let phaseBaseDate: Date;
            if (trigger === 'data_conversao' && conversionDate) {
              phaseBaseDate = conversionDate;
            } else if (trigger === 'fase_anterior') {
              phaseBaseDate = prevPhaseEnd;
            } else {
              phaseBaseDate = projectBase;
            }

            let phaseStartDate: Date = unit === 'dias_uteis'
              ? addBusinessDays(phaseBaseDate, offsetDays)
              : addDays(phaseBaseDate, offsetDays);
            let phaseStart: string = phaseStartDate.toISOString().split('T')[0];
            let phaseEndDate: Date = phaseStartDate;
            let phaseEnd: string | null = null;

            if (pp.duration_days != null) {
              phaseEndDate = unit === 'dias_uteis'
                ? addBusinessDays(phaseStartDate, pp.duration_days)
                : addDays(phaseStartDate, pp.duration_days);
              phaseEnd = phaseEndDate.toISOString().split('T')[0];
            }

            prevPhaseEnd = phaseEndDate;

            const { data: insertedPhase } = await (supabase as any).from('project_phases').insert({
              project_id: projectId,
              name: pp.name || '',
              description: pp.description || null,
              sort_order: pp.sort_order,
              linked_sop_id: pp.linked_sop_id || null,
              source_phase_id: pp.id,
              status: 'pendente',
              duration_days: pp.duration_days ?? null,
              duration_unit: unit,
              offset_days: offsetDays,
              offset_trigger: trigger,
              planned_start: phaseStart,
              planned_end: phaseEnd,
              is_onboarding: pp.is_onboarding ?? false,
            }).select('id').single();

            if (insertedPhase) {
              // Copy deliverable templates for this phase
              const { data: phaseDeliverables } = await (supabase as any).from('product_deliverable_templates')
                .select('*').eq('phase_id', pp.id).order('sort_order');
              if (phaseDeliverables?.length) {
                let prevDelEnd: Date = phaseStartDate;

                for (const dt of phaseDeliverables) {
                  let delStart: string | null = null;
                  let delEnd: string | null = null;
                  const dtOffsetDays = dt.offset_days ?? 0;
                  const dtUnit = dt.duration_unit || 'dias_uteis';
                  const dtTrigger = dt.offset_trigger || 'inicio_fase';

                  // Choose reference date based on trigger
                  const refDate = dtTrigger === 'entrega_anterior' ? prevDelEnd : phaseStartDate;
                  const startD = dtUnit === 'dias_uteis' ? addBusinessDays(refDate, dtOffsetDays) : addDays(refDate, dtOffsetDays);
                  delStart = startD.toISOString().split('T')[0];

                  let endD = startD;
                  if (dt.duration_days != null) {
                    endD = dtUnit === 'dias_uteis' ? addBusinessDays(startD, dt.duration_days) : addDays(startD, dt.duration_days);
                    delEnd = endD.toISOString().split('T')[0];
                  }

                  prevDelEnd = endD;

                  await (supabase as any).from('project_deliverables').insert({
                    project_id: projectId,
                    phase_id: insertedPhase.id,
                    name: dt.name || '',
                    description: dt.description || null,
                    sort_order: dt.sort_order,
                    is_recurring: dt.is_recurring || false,
                    linked_sop_id: dt.linked_sop_id || null,
                    portal_visible: dt.portal_visible ?? true,
                    status: 'pendente',
                    source_template_id: dt.id,
                    duration_days: dt.duration_days ?? null,
                    duration_unit: dtUnit,
                    offset_days: dtOffsetDays,
                    offset_trigger: dtTrigger,
                    responsible_type: dt.responsible_type || 'equipa',
                    planned_start: delStart,
                    planned_end: delEnd,
                  });
                }
              }
            }
          }
        }
      }

      // 4. If no template tasks, return 0 (onb/offb may have been copied)
      if (!templateTasks?.length) {
        return 0;
      }

      // 6. Fetch project members with their team_member info (for role matching)
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('profile_id')
        .eq('project_id', projectId);

      const profileIds = (projectMembers || []).map((m: any) => m.profile_id);

      let membersByRole: Record<string, string> = {};
      if (profileIds.length > 0) {
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('profile_id, role_title, work_areas')
          .in('profile_id', profileIds)
          .eq('status', 'ativo');

        for (const tm of teamMembers || []) {
          if (!tm.profile_id) continue;
          if (tm.role_title) {
            const key = tm.role_title.toLowerCase().trim();
            if (!membersByRole[key]) membersByRole[key] = tm.profile_id;
          }
          const areas = Array.isArray(tm.work_areas) ? tm.work_areas : [];
          for (const area of areas) {
            const key = String(area).toLowerCase().trim();
            if (!membersByRole[key]) membersByRole[key] = tm.profile_id;
          }
        }
      }

      // 7. Fetch historical avg times
      const taskNames = templateTasks.map(t => (t as any).task_name).filter(Boolean);
      let historicalAvg: Record<string, { sum: number; count: number }> = {};

      if (taskNames.length > 0) {
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
            .in('task_id', taskIds)
            .not('ended_at', 'is', null)
            .or('is_manual.eq.true');

          if (timeEntries?.length) {
            const taskIdToName: Record<string, string> = {};
            for (const t of historicalTasks) taskIdToName[t.id] = t.name;
            for (const te of timeEntries) {
              const name = taskIdToName[te.task_id];
              if (!name) continue;
              if (!historicalAvg[name]) historicalAvg[name] = { sum: 0, count: 0 };
              historicalAvg[name].sum += (te.duration_minutes || 0) / 60;
              historicalAvg[name].count += 1;
            }
          }
        }
      }

      // 8. Build and insert tasks
      const baseDate = projectStartDate ? parseISO(projectStartDate) : new Date();
      const parentTasks = templateTasks.filter((t: any) => !t.is_subtask);
      const insertedParentIds: Record<string, string> = {};

      for (const tmpl of parentTasks) {
        const t = tmpl as any;
        const responsibleKey = t.responsible?.toLowerCase().trim();
        const assignedTo = responsibleKey ? (membersByRole[responsibleKey] || null) : null;
        const ruleDays = parseRuleDays(t.rule);
        const deadline = ruleDays ? calcDueDate(baseDate, ruleDays) : null;

        const hist = historicalAvg[t.task_name];
        let estimatedTime: number | null = null;
        if (t.estimated_time != null && hist) {
          estimatedTime = Math.round(((hist.sum + Number(t.estimated_time)) / (hist.count + 1)) * 10) / 10;
        } else if (hist) {
          estimatedTime = Math.round((hist.sum / hist.count) * 10) / 10;
        } else if (t.estimated_time != null) {
          estimatedTime = Number(t.estimated_time);
        }

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
            status: 'por_comecar',
          })
          .select('id')
          .single();

        if (error) throw error;
        if (inserted) insertedParentIds[t.id] = inserted.id;
      }

      let lastParentId: string | null = null;
      for (const tmpl of templateTasks) {
        const t = tmpl as any;
        if (!t.is_subtask) {
          lastParentId = insertedParentIds[t.id] || null;
          continue;
        }

        const responsibleKey = t.responsible?.toLowerCase().trim();
        const assignedTo = responsibleKey ? (membersByRole[responsibleKey] || null) : null;
        const ruleDays = parseRuleDays(t.rule);
        const deadline = ruleDays ? calcDueDate(baseDate, ruleDays) : null;

        const histSub = historicalAvg[t.task_name];
        let estimatedTime: number | null = null;
        if (t.estimated_time != null && histSub) {
          estimatedTime = Math.round(((histSub.sum + Number(t.estimated_time)) / (histSub.count + 1)) * 10) / 10;
        } else if (histSub) {
          estimatedTime = Math.round((histSub.sum / histSub.count) * 10) / 10;
        } else if (t.estimated_time != null) {
          estimatedTime = Number(t.estimated_time);
        }

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
            status: 'por_comecar',
          });

        if (error) throw error;
      }

      return templateTasks.length;
    },
    onSuccess: async (count) => {
      if (count > 0) {
        toast.success(`${count} tarefas criadas a partir do template do produto.`);
      } else {
        toast.success('Checklists de onboarding/offboarding copiadas do produto.');
      }

      const refreshPromises = [
        qc.invalidateQueries({ queryKey: ['project-tasks', projectId] }),
        qc.invalidateQueries({ queryKey: ['project-phases', projectId] }),
        qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] }),
      ];

      if (clientId) {
        refreshPromises.push(
          qc.invalidateQueries({ queryKey: ['client_onboarding', clientId] }),
          qc.invalidateQueries({ queryKey: ['client_offboarding', clientId] }),
        );
      }

      await Promise.all(refreshPromises);
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao aplicar template.');
    },
  });

  // Only show if project has a product associated
  if (!productId) return null;

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
              <span className="block mt-2 text-warning font-medium">
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
