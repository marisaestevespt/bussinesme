/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

/**
 * Member Digest template — receives pre-built HTML from the send-digest edge function.
 * The digest builder already produces a full styled email body, so this template
 * acts as a thin wrapper to satisfy the registry contract.
 */
interface MemberDigestProps {
  subject?: string
  html?: string
}

const MemberDigestEmail = ({ subject, html }: MemberDigestProps) => {
  const previewText = subject || 'Briefing do dia'

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div dangerouslySetInnerHTML={{ __html: html || '<p>Sem conteúdo disponível.</p>'  }} />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MemberDigestEmail,
  subject: (data: Record<string, any>) => data.subject || 'Briefing do dia',
  displayName: 'Resumo diário (Membro)',
  previewData: {
    subject: 'Briefing do dia — 03/04/2026',
    html: '<div style="padding:24px;font-family:DM Sans,Arial,sans-serif"><h1 style="font-size:22px;margin:0 0 12px">Briefing do dia</h1><p style="color:#555770;font-size:15px">Bom dia! Aqui está o teu briefing para hoje.</p></div>',
  },
} satisfies TemplateEntry
