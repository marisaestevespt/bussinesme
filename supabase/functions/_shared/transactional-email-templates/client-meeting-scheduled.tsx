/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  meetingTitle?: string
  meetingDate?: string
  meetingUrl?: string
  businessName?: string
}

const ClientMeetingScheduledEmail = ({
  clientName, meetingTitle, meetingDate, meetingUrl, businessName,
}: Props) => {
  const biz = businessName || 'A nossa equipa'
  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>Nova reunião agendada: {meetingTitle || ''}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>📅 Nova reunião agendada</Heading>
          <Text style={text}>Olá {clientName || ''},</Text>
          <Text style={text}>
            Foi agendada uma nova reunião consigo: <strong>{meetingTitle || ''}</strong>.
          </Text>
          <Section style={card}>
            <Text style={cardLabel}>Data</Text>
            <Text style={cardValue}>{meetingDate || '—'}</Text>
          </Section>
          {meetingUrl ? (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={meetingUrl} style={button}>Entrar na reunião</Button>
            </Section>
          ) : null}
          <Hr style={hr} />
          <Text style={footer}>Até breve,<br />{biz}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ClientMeetingScheduledEmail,
  subject: (d: Record<string, any>) => `Nova reunião agendada: ${d.meetingTitle || ''}`,
  displayName: 'Cliente — Reunião agendada',
  previewData: { clientName: 'João', meetingTitle: 'Kickoff', meetingDate: '15/01/2026 às 14:00', meetingUrl: 'https://meet.google.com/xyz', businessName: 'Acme' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1a1f36', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#1a1f36', lineHeight: '1.6', margin: '0 0 14px' }
const card = { backgroundColor: '#f6f7fb', borderRadius: '8px', padding: '14px 18px', margin: '18px 0' }
const cardLabel = { fontSize: '12px', color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const cardValue = { fontSize: '16px', color: '#1a1f36', fontWeight: 600, margin: 0 }
const button = { backgroundColor: '#1a1f36', color: '#ffffff', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: 0 }