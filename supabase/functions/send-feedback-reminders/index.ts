import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { logRun } from '../_shared/resilience.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isAuthorizedCronCall } from '../_shared/cron-auth.ts'
import { sendTransactionalEmail } from '../_shared/send-email.ts'

/**
 * Edge Function: send-feedback-reminders
 *
 * Daily cron — sends a reminder email to the client when an NPS or
 * feedback record is due today (expected_date = today, status != feito,
 * source = 'portal'). The client responds via the portal.
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!isAuthorizedCronCall(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startedAt = new Date()
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const today = new Date().toISOString().split('T')[0]

    const { data: settings } = await supabase
      .from('business_settings').select('business_name').limit(1).single()

    const { data: records, error } = await supabase
      .from('client_nps_records')
      .select('id, client_id, expected_date, status, kind, title, source')
      .eq('expected_date', today)
      .eq('source', 'portal')
      .neq('status', 'feito')

    if (error) throw error
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: 'No reminders', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: any[] = []
    for (const r of records) {
      const { data: client } = await supabase
        .from('clients').select('email, full_name').eq('id', r.client_id).single()
      if (!client?.email) {
        results.push({ id: r.id, status: 'skipped', reason: 'no email' })
        continue
      }
      const sendRes = await sendTransactionalEmail({
        templateName: 'client-feedback-request',
        recipientEmail: client.email,
        idempotencyKey: `feedback-request-${r.id}-${today}`,
        templateData: {
          clientName: client.full_name,
          feedbackTitle: r.title || '',
          kind: r.kind,
          businessName: settings?.business_name || '',
        },
      })
      results.push({ id: r.id, status: sendRes.ok ? 'sent' : 'error', error: sendRes.ok ? undefined : sendRes.details })
    }

    const errors = results.filter((r) => r.status === 'error').length
    await logRun({
      functionName: 'send-feedback-reminders', startedAt,
      status: errors > 0 ? 'warning' : 'success',
      context: { processed: results.length, errors },
    })

    return new Response(JSON.stringify({ message: `Processed ${results.length}`, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-feedback-reminders error:', err)
    await logRun({ functionName: 'send-feedback-reminders', startedAt, status: 'failed', errorMessage: String(err) })
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})