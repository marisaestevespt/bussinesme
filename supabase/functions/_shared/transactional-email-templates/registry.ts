/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeClient } from './welcome-client.tsx'
import { template as clientOffboarding } from './client-offboarding.tsx'
import { template as paymentReminder } from './payment-reminder.tsx'
import { template as paymentDueToday } from './payment-due-today.tsx'
import { template as invoiceAvailable } from './invoice-available.tsx'
import { template as ownerDigest } from './owner-digest.tsx'
import { template as memberDigest } from './member-digest.tsx'
import { template as ownerEodDigest } from './owner-eod-digest.tsx'
import { template as memberEodDigest } from './member-eod-digest.tsx'
import { template as clientMeetingScheduled } from './client-meeting-scheduled.tsx'
import { template as clientFeedbackRequest } from './client-feedback-request.tsx'
import { template as teamClientRequest } from './team-client-request.tsx'
import { template as teamMeetingPrepTopic } from './team-meeting-prep-topic.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-client': welcomeClient,
  'client-offboarding': clientOffboarding,
  'payment-reminder': paymentReminder,
  'payment-due-today': paymentDueToday,
  'invoice-available': invoiceAvailable,
  'owner-digest': ownerDigest,
  'member-digest': memberDigest,
  'owner-eod-digest': ownerEodDigest,
  'member-eod-digest': memberEodDigest,
  'client-meeting-scheduled': clientMeetingScheduled,
  'client-feedback-request': clientFeedbackRequest,
  'team-client-request': teamClientRequest,
  'team-meeting-prep-topic': teamMeetingPrepTopic,
}
