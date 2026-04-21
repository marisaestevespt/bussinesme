/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface OwnerEodDigestProps {
  subject?: string
  html?: string
}

const OwnerEodDigestEmail = ({ subject, html }: OwnerEodDigestProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>{subject || 'Wrap-up do dia'}</Preview>
    <Body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
      <Container
        style={{ maxWidth: '600px', margin: '0 auto' }}
        dangerouslySetInnerHTML={{ __html: html || '<p>Sem conteúdo disponível.</p>' }}
      />
    </Body>
  </Html>
)

export const template = {
  component: OwnerEodDigestEmail,
  subject: (data: Record<string, any>) => data.subject || 'Wrap-up do dia',
  displayName: 'Wrap-up do dia (Owner)',
  previewData: {
    subject: 'Wrap-up do dia — sistema Lyrata® — 03/04/2026',
    html: '<div style="padding:24px;font-family:DM Sans,Arial,sans-serif"><h1 style="font-size:22px;margin:0 0 12px">Wrap-up do dia</h1><p style="color:#555770;font-size:15px">Boa noite! Aqui está o resumo do que aconteceu hoje.</p></div>',
  },
} satisfies TemplateEntry
