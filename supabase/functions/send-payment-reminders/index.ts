import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { logRun } from '../_shared/resilience.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isAuthorizedCronCall } from '../_shared/cron-auth.ts'
import { sendTransactionalEmail } from '../_shared/send-email.ts'

/**
 * Edge Function: send-payment-reminders
 * 
 * Checks commercial_sales for payments due in 3 days or today,
 * and sends reminder emails to the client's email address.
 * 
 * Designed to run daily via pg_cron.
 * Will only work once the email domain is configured and
 * send-transactional-email is deployed.
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow service-role / cron / authenticated calls.
  if (!isAuthorizedCronCall(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startedAt = new Date()
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get today's date in YYYY-MM-DD
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Date 3 days from now
    const threeDays = new Date(today)
    threeDays.setDate(threeDays.getDate() + 3)
    const threeDaysStr = threeDays.toISOString().split('T')[0]

    // Get business settings for branding
    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name, primary_color, secondary_color, text_color, accent_color, font_display, font_body, logo_url')
      .limit(1)
      .single()

    // Get business setup for payment details (IBAN, MBWay, etc.)
    const { data: bizSetup } = await supabase
      .from('business_setup')
      .select('iban, payment_methods')
      .limit(1)
      .single()

    // Fetch custom overrides for both templates (one row each, optional)
    const { data: customRows } = await supabase
      .from('email_template_settings')
      .select('*')
      .in('template_key', ['payment-reminder', 'payment-due-today'])
    const customByKey: Record<string, any> = {}
    for (const row of (customRows || []) as any[]) {
      customByKey[row.template_key] = row
    }

    // Extract payment details from payment_methods JSON
    const paymentMethods = (bizSetup?.payment_methods as any[]) || []
    const mbwayEntry = paymentMethods.find((pm: any) => pm.type === 'mbway')
    const mbwayNumber = mbwayEntry?.value || ''

    // Find sales with payment_date matching today or 3 days from now
    // that are not yet paid
    const { data: sales, error: salesError } = await supabase
      .from('commercial_sales')
      .select('id, client, product, invoice_total, payment_date, status, payment_method')
      .in('payment_date', [todayStr, threeDaysStr])
      .in('status', ['aguarda_pagamento', 'em_atraso'])

    if (salesError) {
      console.error('Error fetching sales:', salesError)
      return new Response(JSON.stringify({ error: salesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!sales || sales.length === 0) {
      return new Response(JSON.stringify({ message: 'No reminders to send', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: { saleId: string; status: string; error?: string }[] = []

    for (const sale of sales) {
      // Find the client's email
      const clientName = sale.client
      if (!clientName) {
        results.push({ saleId: sale.id, status: 'skipped', error: 'No client name' })
        continue
      }

      const { data: client } = await supabase
        .from('clients')
        .select('email, full_name')
        .eq('full_name', clientName)
        .limit(1)
        .single()

      if (!client?.email) {
        results.push({ saleId: sale.id, status: 'skipped', error: 'No client email' })
        continue
      }

      const isToday = sale.payment_date === todayStr
      const daysUntil = isToday ? 0 : 3

      // Format the date for display
      const payDate = new Date(sale.payment_date!)
      const formattedDate = `${String(payDate.getDate()).padStart(2, '0')}/${String(payDate.getMonth() + 1).padStart(2, '0')}/${payDate.getFullYear()}`

      try {
        const templateName = isToday ? 'payment-due-today' : 'payment-reminder'
        const custom = customByKey[templateName] || {}
        const templateData: Record<string, any> = {
          clientName: client.full_name,
          productName: sale.product || 'Serviço',
          amount: String(sale.invoice_total || 0),
          dueDate: formattedDate,
          businessName: settings?.business_name || '',
          primaryColor: custom.primary_color || settings?.primary_color || '',
          primaryForeground: custom.primary_foreground || settings?.secondary_color || '',
          textColor: custom.text_color || settings?.text_color || '',
          accentColor: custom.muted_color || settings?.accent_color || '',
          fontDisplay: custom.font_display || settings?.font_display || '',
          fontBody: custom.font_body || settings?.font_body || '',
          logoUrl: settings?.logo_url || '',
          customTitle: custom.title_text || undefined,
          customSubtitle: custom.subtitle_text || undefined,
          customCta: custom.cta_text || undefined,
          customFooter: custom.footer_text || undefined,
          customEmoji: custom.emoji || undefined,
        }

        if (isToday) {
          templateData.paymentMethod = sale.payment_method || ''
          templateData.iban = bizSetup?.iban || ''
          templateData.mbwayNumber = mbwayNumber
        } else {
          templateData.daysUntil = daysUntil
        }

        const sendRes = await sendTransactionalEmail({
          templateName,
          recipientEmail: client.email,
          idempotencyKey: `${templateName}-${sale.id}-${todayStr}`,
          templateData,
        })

        if (!sendRes.ok) {
          results.push({ saleId: sale.id, status: 'error', error: sendRes.details })
        } else {
          results.push({ saleId: sale.id, status: 'sent' })
        }
      } catch (err) {
        results.push({ saleId: sale.id, status: 'error', error: String(err) })
      }
    }

    console.log(`Payment reminders processed: ${results.length}`, results)

    const errors = results.filter((r: any) => r.status === 'error').length
    await logRun({
      functionName: 'send-payment-reminders',
      startedAt,
      status: errors > 0 ? 'warning' : 'success',
      context: { processed: results.length, errors },
    })

    return new Response(JSON.stringify({ 
      message: `Processed ${results.length} reminders`,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-payment-reminders error:', err)
    await logRun({ functionName: 'send-payment-reminders', startedAt, status: 'failed', errorMessage: String(err) })
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
