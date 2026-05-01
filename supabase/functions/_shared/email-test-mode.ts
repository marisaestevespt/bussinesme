// Shared helper to enforce email safety: test-mode redirect and
// global block on client-bound emails until explicitly enabled.
// Read by send-transactional-email so EVERY transactional/digest send
// passes through one chokepoint.

export interface EmailSafetyConfig {
  testMode: boolean
  testRedirect: string
  sendToClientsEnabled: boolean
}

// Treat these template names as client-facing. Anything else (digests,
// internal notifications, member invites) is considered internal/team.
// Add new client-facing templates here when they are created.
export const CLIENT_FACING_TEMPLATES = new Set<string>([
  'payment-reminder',
  'payment-due-today',
  'invoice-available',
  'client-offboarding',
  // Future: meeting confirmations, onboarding completion, etc.
])

export async function loadEmailSafetyConfig(
  supabase: any,
): Promise<EmailSafetyConfig> {
  const { data, error } = await supabase
    .from('business_setup')
    .select('email_test_mode, email_test_redirect, email_send_to_clients_enabled')
    .limit(1)
    .maybeSingle()

  // Fail-safe defaults: if we can't read settings, behave as if test mode
  // is on and clients are blocked. This prevents accidental sends.
  if (error || !data) {
    console.warn('[email-safety] Could not load business_setup, using safe defaults', { error })
    return {
      testMode: true,
      testRedirect: 'amarisaeg@gmail.com',
      sendToClientsEnabled: false,
    }
  }

  return {
    testMode: data.email_test_mode !== false, // default true
    testRedirect: data.email_test_redirect || 'amarisaeg@gmail.com',
    sendToClientsEnabled: data.email_send_to_clients_enabled === true, // default false
  }
}

export interface SafetyDecision {
  action: 'allow' | 'redirect' | 'block'
  effectiveRecipient: string
  subjectPrefix: string
  reason?: string
}

export function applySafetyPolicy(args: {
  templateName: string
  intendedRecipient: string
  config: EmailSafetyConfig
}): SafetyDecision {
  const { templateName, intendedRecipient, config } = args
  const isClientFacing = CLIENT_FACING_TEMPLATES.has(templateName)

  // 1. Block client-bound emails entirely if global switch is off
  if (isClientFacing && !config.sendToClientsEnabled && !config.testMode) {
    return {
      action: 'block',
      effectiveRecipient: intendedRecipient,
      subjectPrefix: '',
      reason: 'client_emails_disabled',
    }
  }

  // 2. Test mode: redirect everything to test address
  if (config.testMode) {
    return {
      action: 'redirect',
      effectiveRecipient: config.testRedirect,
      subjectPrefix: `[TESTE → ${intendedRecipient}] `,
    }
  }

  // 3. Live mode, internal email or clients enabled — pass through
  return {
    action: 'allow',
    effectiveRecipient: intendedRecipient,
    subjectPrefix: '',
  }
}
