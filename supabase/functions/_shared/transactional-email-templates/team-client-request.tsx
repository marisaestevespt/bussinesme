/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  requestTitle?: string
  requestMessage?: string
  businessName?: string
}

const TeamClientRequestEmail = ({
  clientName, requestTitle, requestMessage, businessName,
}: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Novo pedido de {clientName || 'cliente'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📩 Novo pedido de cliente</Heading>
        <Text style={text}>
          <strong>{clientName || 'Cliente'}</strong> enviou um pedido através do portal.
        </Text>
        <Section style={card}>
          <Text style={cardLabel}>Assunto</Text>
          <Text style={cardValue}>{requestTitle || '—'}</Text>
          {requestMessage ? (
            <>
              <Text style={{ ...cardLabel, marginTop: 12 }}>Mensagem</Text>
              <Text style={cardMessage}>{requestMessage}</Text>
            </>
          ) : null}
        </Section>
        <Text style={text}>Abre o cliente no Hub para responder ou marcar como resolvido.</Text>
        <Hr style={hr} />
        <Text style={footer}>{businessName || 'Hub'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TeamClientRequestEmail,
  subject: (d: Record<string, any>) => `Novo pedido de ${d.clientName || 'cliente'}: ${d.requestTitle || ''}`,
  displayName: 'Equipa — Novo pedido de cliente',
  previewData: { clientName: 'João Silva', requestTitle: 'Dúvida sobre fatura', requestMessage: 'Boa tarde, gostaria de…', businessName: 'Acme' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1a1f36', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#1a1f36', lineHeight: '1.6', margin: '0 0 14px' }
const card = { backgroundColor: '#f6f7fb', borderRadius: '8px', padding: '14px 18px', margin: '18px 0' }
const cardLabel = { fontSize: '12px', color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const cardValue = { fontSize: '16px', color: '#1a1f36', fontWeight: 600, margin: 0 }
const cardMessage = { fontSize: '14px', color: '#1a1f36', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: 0 }