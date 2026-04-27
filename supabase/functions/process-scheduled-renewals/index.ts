// Cron job: activates scheduled client renewals when their start_date arrives.
// Runs daily. For each project in status 'agendado' with start_date <= today:
//   - Concludes other active projects (snapshot to portal history)
//   - Sets project.status = 'em_onboarding'
//   - Updates client.current_product, start_date, end_of_cycle, renewal_count++
//   - Clears clients.pending_renewal_project_id
//   - Reactivates portal if applicable + copies diagnostic questions if missing
//   - Creates client_renewals checklist from product_renewal_templates (if missing)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";
import { runWithMonitoring } from "../_shared/resilience.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROJETO_TYPES = new Set([
  'projeto_1_1', 'servico_pontual', 'consultoria_individual', 'consultoria_grupo',
  'mentoria_individual', 'mentoria_grupo', 'workshop',
]);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!isAuthorizedCronCall(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await runWithMonitoring(async () => {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const today = new Date().toISOString().slice(0, 10);
      console.log(`[process-scheduled-renewals] Running for ${today}`);

      const { data: scheduled, error } = await supabase
        .from('projects')
        .select('id, name, client_id, product_id, product_name, start_date, deadline')
        .eq('status', 'agendado')
        .lte('start_date', today);

      if (error) throw error;

      const results: any[] = [];

      for (const proj of scheduled || []) {
        try {
          if (!proj.client_id) continue;

          // 0. Validate product still exists (gap #15 partial)
          let product: any = null;
          if (proj.product_id) {
            const { data: p } = await supabase.from('products')
              .select('id, name, product_type, cycle_duration')
              .eq('id', proj.product_id).maybeSingle();
            product = p;
          }

          // 1. Conclude other active projects + snapshot to portal history
          const { data: others } = await supabase
            .from('projects')
            .select('id, name, product_name, start_date, deadline, notes')
            .eq('client_id', proj.client_id)
            .neq('id', proj.id)
            .not('status', 'in', '(concluido,cancelado,arquivo,agendado)');

          const { data: portalRow } = await supabase
            .from('client_portals').select('id, portal_type').eq('client_id', proj.client_id).maybeSingle();
          let portalId = portalRow?.id || null;

          for (const o of others || []) {
            await supabase.from('projects').update({ status: 'concluido' }).eq('id', o.id);
            if (portalId) {
              const { data: phases } = await supabase.from('project_phases')
                .select('name, status, sort_order').eq('project_id', o.id).order('sort_order');
              const { data: summaries } = await supabase.from('portal_monthly_summaries' as any)
                .select('month, year, content').eq('portal_id', portalId)
                .order('year', { ascending: false }).order('month', { ascending: false });
              await supabase.from('portal_project_history' as any).insert({
                portal_id: portalId, project_id: o.id, project_name: o.name,
                product_name: o.product_name, start_date: o.start_date, end_date: today,
                status: 'concluido',
                timeline_phases: (phases || []).map((p: any) => ({ title: p.name, status: p.status, sort_order: p.sort_order })),
                monthly_summaries: summaries || [], notes: o.notes,
              });
              await supabase.from('portal_monthly_summaries' as any).delete().eq('portal_id', portalId);
            }
          }

          // 2. Activate the scheduled project
          await supabase.from('projects').update({ status: 'em_onboarding' }).eq('id', proj.id);

          // 3. Update client
          const { data: clientRow } = await supabase.from('clients')
            .select('id, full_name, email, nif, fiscal_address, renewal_count')
            .eq('id', proj.client_id).maybeSingle();
          const nextCount = (clientRow?.renewal_count || 0) + 1;

          await supabase.from('clients').update({
            current_product: proj.product_name,
            current_product_id: proj.product_id,
            start_date: proj.start_date,
            end_of_cycle: proj.deadline,
            status: 'ativo',
            renewal_count: nextCount,
            pending_renewal_project_id: null,
          }).eq('id', proj.client_id);

          // 4. Create renewal checklist from templates (mirror manual flow) — only if missing for this cycle
          if (proj.product_id) {
            const { data: existing } = await supabase
              .from('client_renewals' as any)
              .select('id')
              .eq('client_id', proj.client_id)
              .eq('cycle_number', nextCount)
              .limit(1);

            if (!existing?.length) {
              const { data: templates } = await supabase
                .from('product_renewal_templates' as any)
                .select('*')
                .eq('product_id', proj.product_id)
                .order('sort_order');

              if (templates && templates.length > 0) {
                const rows = templates.map((t: any, i: number) => {
                  let dueDate: string | null = null;
                  if (t.rule_days && proj.deadline) {
                    const offsetDays = (t.rule_unit === 'semanas' ? t.rule_days * 7 : t.rule_days)
                      * (t.rule_trigger === 'apos_inicio_ciclo' ? 1 : -1);
                    dueDate = addDays(proj.deadline, offsetDays);
                  }
                  return {
                    client_id: proj.client_id,
                    cycle_number: nextCount,
                    activity: t.name,
                    phase: t.notes || null,
                    responsible: t.responsible_type || null,
                    rule_days: t.rule_days,
                    rule_unit: t.rule_unit,
                    rule_trigger: t.rule_trigger,
                    due_date: dueDate,
                    sort_order: t.sort_order ?? i,
                    completed: false,
                  };
                });
                await supabase.from('client_renewals' as any).insert(rows);
              }
            }
          }

          // 5. Reactivate / create portal + copy diagnostic questions (mirror manual flow)
          if (product?.product_type) {
            let portalType: 'projeto_unico' | 'servico_mensal' | null = null;
            if (PROJETO_TYPES.has(product.product_type)) portalType = 'projeto_unico';
            else if (product.product_type === 'servico_mensal') portalType = 'servico_mensal';

            if (portalType) {
              if (!portalId) {
                const { data: newPortal } = await supabase.from('client_portals').insert({
                  client_id: proj.client_id, portal_type: portalType, is_active: true,
                }).select('id').single();
                portalId = newPortal?.id || null;
              } else {
                await supabase.from('client_portals').update({
                  is_active: true, portal_type: portalType,
                }).eq('id', portalId);
              }

              if (portalId) {
                const { data: existingQ } = await supabase.from('portal_initial_questions')
                  .select('id').eq('portal_id', portalId).limit(1);
                if (!existingQ?.length) {
                  const { data: diagQuestions } = await supabase
                    .from('product_diagnostic_questions')
                    .select('question, sort_order, question_group, answer_type, group_sort_order')
                    .eq('product_id', product.id)
                    .order('group_sort_order')
                    .order('sort_order');
                  if (diagQuestions?.length) {
                    const rows = diagQuestions.map((dq: any, i: number) => ({
                      portal_id: portalId!,
                      question: dq.question,
                      sort_order: dq.sort_order ?? i,
                      question_group: dq.question_group || null,
                      answer_type: dq.answer_type || 'text',
                      group_sort_order: dq.group_sort_order ?? 0,
                    }));
                    await supabase.from('portal_initial_questions').insert(rows as any);
                  }
                }
              }
            }
          }

          // 6. History entry
          await supabase.from('client_history').insert({
            client_id: proj.client_id,
            entry_date: today,
            milestone: `Renovação ativada automaticamente: ${proj.product_name}`,
            observations: `Projeto agendado entrou em onboarding (ciclo #${nextCount}).`,
          });

          results.push({ project_id: proj.id, status: 'activated', cycle: nextCount });
        } catch (e: any) {
          console.error('Failed to activate', proj.id, e);
          results.push({ project_id: proj.id, status: 'error', error: e.message });
        }
      }

      return { processed: results.length, results };
    }, { functionName: 'process-scheduled-renewals', maxAttempts: 2 });

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
