/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  feedbackTitle?: string
  kind?: string // 'nps' | 'feedback'
  businessName?: string
}

const ClientFeedbackRequestEmail = ({
  clientName, feedbackTitle, kind, businessName,
}: Props) => {
  const biz = businessName || 'A nossa equipa'
  const isNps = kind === 'nps'
  const heading = isNps ? '⭐ Como nos avalia?' : '💬 A sua opinião conta'
  const intro = isNps
    ? 'Gostaríamos de saber a sua opinião através de uma breve avaliação NPS.'
    : 'Reservámos um momento para ouvir o seu feedback.'
  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>{feedbackTitle || heading}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={text}>Olá {clientName || ''},</Text>
          <Text style={text}>{intro}</Text>
          {feedbackTitle ? (
            <Section style={card}>
              <Text style={cardValue}>{feedbackTitle}</Text>
            </Section>
          ) : null}
          <Text style={text}>
            Pode responder diretamente no seu portal — leva apenas 1 minuto.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Obrigado,<br />{biz}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ClientFeedbackRequestEmail,
  subject: (d: Record<string, any>) => d.kind === 'nps' ? 'Como nos avalia?' : 'A sua opinião conta',
  displayName: 'Cliente — Pedido de feedback / NPS',
  previewData: { clientName: 'João', feedbackTitle: 'Avaliação intermédia', kind: 'nps', businessName: 'Acme' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1a1f36', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#1a1f36', lineHeight: '1.6', margin: '0 0 14px' }
const card = { backgroundColor: '#f6f7fb', borderRadius: '8px', padding: '14px 18px', margin: '18px 0' }
const cardValue = { fontSize: '16px', color: '#1a1f36', fontWeight: 600, margin: 0 }
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: 0 }