/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  meetingTitle?: string
  meetingDate?: string
  topicContent?: string
  authorLabel?: string
  clientName?: string
  businessName?: string
}

const TeamMeetingPrepTopicEmail = ({
  meetingTitle, meetingDate, topicContent, authorLabel, clientName, businessName,
}: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Novo tópico para "{meetingTitle || 'reunião'}"</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>💡 Novo tópico antes da reunião</Heading>
        <Text style={text}>
          <strong>{authorLabel || clientName || 'Cliente'}</strong> adicionou um tópico para discutir em <strong>{meetingTitle || 'a reunião'}</strong>{meetingDate ? ` (${meetingDate})` : ''}.
        </Text>
        <Section style={card}>
          <Text style={cardLabel}>Tópico</Text>
          <Text style={cardMessage}>{topicContent || '—'}</Text>
        </Section>
        <Text style={text}>Aproveita para preparar uma resposta antes da reunião.</Text>
        <Hr style={hr} />
        <Text style={footer}>{businessName || 'Hub'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TeamMeetingPrepTopicEmail,
  subject: (d: Record<string, any>) => `Novo tópico — ${d.meetingTitle || 'reunião'}`,
  displayName: 'Equipa — Tópico de reunião do cliente',
  previewData: { meetingTitle: 'Weekly Sync', meetingDate: '15/01/2026 às 14:00', topicContent: 'Gostaria de rever o roadmap', authorLabel: 'João Silva', clientName: 'João Silva', businessName: 'Acme' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1a1f36', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#1a1f36', lineHeight: '1.6', margin: '0 0 14px' }
const card = { backgroundColor: '#f6f7fb', borderRadius: '8px', padding: '14px 18px', margin: '18px 0' }
const cardLabel = { fontSize: '12px', color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const cardMessage = { fontSize: '14px', color: '#1a1f36', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: 0 }