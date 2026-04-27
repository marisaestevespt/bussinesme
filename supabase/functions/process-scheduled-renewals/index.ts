// Cron job: activates scheduled client renewals when their start_date arrives.
// Runs daily. Delegates the activation to the atomic RPC `activate_renewal_project`,
// which handles: concluding other active projects (with portal snapshot),
// flipping project to em_onboarding, updating client (product/dates/cycle++/clearing pending),
// creating renewal checklist, reactivating portal + copying diagnostic questions, and
// recording a history entry. The RPC is idempotent and transactional, so retries are safe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";
import { runWithMonitoring } from "../_shared/resilience.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        .select('id')
        .eq('status', 'agendado')
        .lte('start_date', today);

      if (error) throw error;

      const results: any[] = [];

      for (const proj of scheduled || []) {
        try {
          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            'activate_renewal_project' as any,
            { _project_id: proj.id },
          );
          if (rpcError) throw rpcError;
          const r = rpcResult as any;
          results.push({
            project_id: proj.id,
            status: r?.activated ? 'activated' : 'skipped',
            cycle: r?.cycle ?? null,
            reason: r?.reason ?? null,
          });
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
