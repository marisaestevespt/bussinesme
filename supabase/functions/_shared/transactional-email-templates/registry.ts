/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeMember } from './welcome-member.tsx'
import { template as clientOffboarding } from './client-offboarding.tsx'
import { template as paymentReminder } from './payment-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-member': welcomeMember,
  'client-offboarding': clientOffboarding,
  'payment-reminder': paymentReminder,
}
