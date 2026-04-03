import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    // Get business setup for IBAN
    const { data: bizSetup } = await supabase
      .from('business_setup')
      .select('iban')
      .limit(1)
      .single()

    // Find sales with payment_date matching today or 3 days from now
    // that are not yet paid
    const { data: sales, error: salesError } = await supabase
      .from('commercial_sales')
      .select('id, client, product, invoice_total, payment_date, status')
      .in('payment_date', [todayStr, threeDaysStr])
      .not('status', 'eq', 'pago')

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
        .select('email, full_name, payment_method')
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
        const { error: invokeError } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'payment-reminder',
            recipientEmail: client.email,
            idempotencyKey: `payment-reminder-${sale.id}-${isToday ? 'today' : '3days'}-${todayStr}`,
            templateData: {
              clientName: client.full_name,
              productName: sale.product || 'Serviço',
              amount: String(sale.invoice_total || 0),
              dueDate: formattedDate,
              daysUntil,
              paymentMethod: client.payment_method || '',
              iban: bizSetup?.iban || '',
              businessName: settings?.business_name || '',
              primaryColor: settings?.primary_color || '',
              primaryForeground: settings?.secondary_color || '',
              textColor: settings?.text_color || '',
              accentColor: settings?.accent_color || '',
              fontDisplay: settings?.font_display || '',
              fontBody: settings?.font_body || '',
              logoUrl: settings?.logo_url || '',
            },
          },
        })

        if (invokeError) {
          results.push({ saleId: sale.id, status: 'error', error: invokeError.message })
        } else {
          results.push({ saleId: sale.id, status: 'sent' })
        }
      } catch (err) {
        results.push({ saleId: sale.id, status: 'error', error: String(err) })
      }
    }

    console.log(`Payment reminders processed: ${results.length}`, results)

    return new Response(JSON.stringify({ 
      message: `Processed ${results.length} reminders`,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-payment-reminders error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
