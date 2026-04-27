// Cron job: activates scheduled client renewals when their start_date arrives.
// Runs daily. For each project in status 'agendado' with start_date <= today:
//   - Concludes other active projects of the client (snapshot to portal history)
//   - Sets project.status = 'em_onboarding'
//   - Updates client.current_product, start_date, end_of_cycle, renewal_count++
//   - Clears clients.pending_renewal_project_id
//   - Reactivates portal if applicable
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = new Date().toISOString().slice(0, 10);
  console.log(`[process-scheduled-renewals] Running for date ${today}`);

  const { data: scheduled, error } = await supabase
    .from('projects')
    .select('id, name, client_id, product_id, product_name, start_date, deadline')
    .eq('status', 'agendado')
    .lte('start_date', today);

  if (error) {
    console.error('Failed to query scheduled projects:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const results: any[] = [];

  for (const proj of scheduled || []) {
    try {
      if (!proj.client_id) continue;

      // 1. Conclude other active projects + snapshot
      const { data: others } = await supabase
        .from('projects')
        .select('id, name, product_name, start_date, deadline, notes')
        .eq('client_id', proj.client_id)
        .neq('id', proj.id)
        .not('status', 'in', '(concluido,cancelado,arquivo,agendado)');

      const { data: portalRow } = await supabase
        .from('client_portals').select('id').eq('client_id', proj.client_id).maybeSingle();
      const portalId = portalRow?.id;

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
        .select('renewal_count').eq('id', proj.client_id).maybeSingle();
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

      // 4. Reactivate portal if exists
      if (portalId) {
        await supabase.from('client_portals').update({ is_active: true }).eq('id', portalId);
      }

      // 5. History entry
      await supabase.from('client_history').insert({
        client_id: proj.client_id,
        entry_date: today,
        milestone: `Renovação ativada automaticamente: ${proj.product_name}`,
        observations: `Projeto agendado entrou em onboarding (ciclo #${nextCount}).`,
      });

      results.push({ project_id: proj.id, status: 'activated' });
    } catch (e: any) {
      console.error('Failed to activate', proj.id, e);
      results.push({ project_id: proj.id, status: 'error', error: e.message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
