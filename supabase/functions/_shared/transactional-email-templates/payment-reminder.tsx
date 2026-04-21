/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '{{.SiteName}}'

interface PaymentReminderProps {
  clientName?: string
  productName?: string
  amount?: string
  dueDate?: string
  daysUntil?: number
  businessName?: string
  primaryColor?: string
  primaryForeground?: string
  textColor?: string
  accentColor?: string
  fontDisplay?: string
  fontBody?: string
  logoUrl?: string
}

function hslToCss(hsl: string | undefined, fallback: string): string {
  if (!hsl) return fallback
  return `hsl(${hsl.replace(/ /g, ', ')})`
}

const PaymentReminderEmail = ({
  clientName, productName, amount, dueDate, daysUntil,
  businessName, primaryColor, primaryForeground, textColor, accentColor,
  fontDisplay, fontBody, logoUrl,
}: PaymentReminderProps) => {
  const name = clientName || 'Cliente'
  const biz = businessName || SITE_NAME
  const product = productName || 'o seu serviço'
  const value = amount || '—'
  const date = dueDate || '—'
  const days = daysUntil ?? 3

  const brandPrimary = hslToCss(primaryColor, '#1a1f36')
  const brandText = hslToCss(textColor, '#1a1f36')
  const brandMuted = hslToCss(accentColor, '#555770')
  const bodyFont = fontBody ? `'${fontBody}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif"
  const displayFont = fontDisplay ? `'${fontDisplay}', Georgia, serif` : bodyFont

  const main = { backgroundColor: '#ffffff', fontFamily: bodyFont }
  const container = { maxWidth: '540px', margin: '0 auto', padding: '40px 24px' }
  const headerSection = { textAlign: 'center' as const, padding: '0 0 8px' }
  const logoStyle = { width: '48px', height: '48px', borderRadius: '10px', margin: '0 auto 16px' }
  const headerEmoji = { fontSize: '48px', margin: '0 0 8px', lineHeight: '1' }
  const h1 = { fontSize: '22px', fontWeight: '700' as const, color: brandText, margin: '0 0 12px', lineHeight: '1.3', fontFamily: displayFont }
  const subtitle = { fontSize: '15px', color: brandMuted, lineHeight: '1.6', margin: '0' }
  const divider = { borderColor: '#e8e8ed', margin: '28px 0' }
  const detailCard = { backgroundColor: '#f7f7fa', borderRadius: '10px', padding: '20px 24px', marginBottom: '12px' }
  const detailRow = { fontSize: '14px', color: brandMuted, lineHeight: '2', margin: '0' }
  const detailLabel = { fontWeight: '600' as const, color: brandText }
  const amountHighlight = { fontSize: '28px', fontWeight: '700' as const, color: brandPrimary, textAlign: 'center' as const, margin: '16px 0 4px', fontFamily: displayFont }
  const amountLabel = { fontSize: '12px', color: brandMuted, textAlign: 'center' as const, margin: '0 0 16px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
  const footer = { fontSize: '13px', color: '#999', textAlign: 'center' as const, margin: '28px 0 0', lineHeight: '1.6' }

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>O pagamento de {value}€ vence em {days} dias</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            {logoUrl ? (
              <Img src={logoUrl} alt={biz} style={logoStyle} />
            ) : (
              <Text style={headerEmoji}>🔔</Text>
            )}
            <Heading style={h1}>{name}, lembrete de pagamento</Heading>
            <Text style={subtitle}>
              Enviamos este lembrete para que possa organizar o pagamento referente a {product}, que vence em breve.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={detailCard}>
            <Text style={amountHighlight}>{value}€</Text>
            <Text style={amountLabel}>Valor a pagar</Text>
            <Text style={detailRow}>
              <span style={detailLabel}>Serviço: </span>{product}
            </Text>
            <Text style={detailRow}>
              <span style={detailLabel}>Data de vencimento: </span>{date}
            </Text>
          </Section>

          <Hr style={divider} />

          <Text style={{ fontSize: '14px', color: brandMuted, lineHeight: '1.6', margin: '0', textAlign: 'center' as const }}>
            Se já efetuou o pagamento, por favor ignore este email.
            <br />
            Em caso de dúvida, não hesite em contactar-nos.
          </Text>

          <Text style={footer}>
            Com os melhores cumprimentos,<br />A equipa {biz}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PaymentReminderEmail,
  subject: (data: Record<string, any>) =>
    `🔔 Lembrete: pagamento em ${data.daysUntil || 3} dias — ${data.amount || ''}€`,
  displayName: 'Lembrete de pagamento (3 dias antes)',
  previewData: {
    clientName: 'Ana',
    productName: 'Consultoria Digital',
    amount: '350',
    dueDate: '15/04/2026',
    daysUntil: 3,
    businessName: 'Lyrata®',
    primaryColor: '222 47% 11%',
    textColor: '222 84% 5%',
    accentColor: '215 16% 47%',
    fontDisplay: 'DM Serif Display',
    fontBody: 'DM Sans',
  },
} satisfies TemplateEntry
