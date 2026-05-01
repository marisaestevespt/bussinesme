/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '{{.SiteName}}'

interface InvoiceAvailableProps {
  clientName?: string
  productName?: string
  amount?: string
  portalUrl?: string
  businessName?: string
  primaryColor?: string
  primaryForeground?: string
  textColor?: string
  accentColor?: string
  fontDisplay?: string
  fontBody?: string
  logoUrl?: string
  // Custom text overrides from email_template_settings
  customTitle?: string
  customSubtitle?: string
  customCta?: string
  customFooter?: string
  customEmoji?: string
}

function hslToCss(hsl: string | undefined, fallback: string): string {
  if (!hsl) return fallback
  return `hsl(${hsl.replace(/ /g, ', ')})`
}

const InvoiceAvailableEmail = ({
  clientName,
  productName,
  amount,
  portalUrl,
  businessName,
  primaryColor,
  primaryForeground,
  textColor,
  accentColor,
  fontDisplay,
  fontBody,
  logoUrl,
  customTitle,
  customSubtitle,
  customCta,
  customFooter,
  customEmoji,
}: InvoiceAvailableProps) => {
  const name = clientName || 'Cliente'
  const biz = businessName || SITE_NAME
  const product = productName || 'o seu serviço'
  const value = amount || ''
  const emoji = customEmoji || '📄'

  const brandPrimary = hslToCss(primaryColor, '#e04a2f')
  const brandPrimaryFg = hslToCss(primaryForeground, '#ffffff')
  const brandText = '#1a1f36' // neutral dark, ignores textColor to avoid washed-out text
  const brandMuted = '#555770' // neutral muted gray, ignores accentColor to avoid pink/light text
  const bodyFont = fontBody ? `'${fontBody}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif"
  const displayFont = fontDisplay ? `'${fontDisplay}', Georgia, serif` : bodyFont

  const previewText = value
    ? `A sua fatura de ${value}€ já está disponível para consulta`
    : 'A sua fatura já está disponível para consulta'

  const main = { backgroundColor: '#ffffff', fontFamily: bodyFont }
  const container = { maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }
  const headerSection = { textAlign: 'center' as const, padding: '0 0 8px' }
  const logoStyle = { width: '48px', height: '48px', borderRadius: '10px', margin: '0 auto 16px' }
  const headerEmoji = { fontSize: '48px', margin: '0 0 8px', lineHeight: '1' }
  const h1 = { fontSize: '22px', fontWeight: '700' as const, color: brandText, margin: '0 0 12px', lineHeight: '1.3', fontFamily: displayFont }
  const subtitleStyle = { fontSize: '15px', color: brandMuted, lineHeight: '1.6', margin: '0' }
  const divider = { borderColor: '#e5e5e5', margin: '28px 0' }
  const detailCard = { backgroundColor: '#f5f5f5', borderRadius: '10px', padding: '20px 24px', marginBottom: '12px' }
  const detailRow = { fontSize: '14px', color: brandMuted, lineHeight: '2', margin: '0' }
  const detailLabel = { fontWeight: '600' as const, color: brandText }
  const ctaButton = {
    backgroundColor: brandPrimary,
    color: brandPrimaryFg,
    padding: '14px 28px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600' as const,
    textDecoration: 'none',
    display: 'inline-block',
    textAlign: 'center' as const,
  }
  const footerStyle = { fontSize: '13px', color: '#999', textAlign: 'center' as const, margin: '28px 0 0', lineHeight: '1.6' }

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            {logoUrl ? (
              <Img src={logoUrl} alt={biz} style={logoStyle} />
            ) : (
              <Text style={headerEmoji}>{emoji}</Text>
            )}
            <Heading style={h1}>
              {customTitle
                ? customTitle.replace('{name}', name).replace('{amount}', value).replace('{product}', product)
                : `${name}, a sua fatura já está disponível`}
            </Heading>
            <Text style={subtitleStyle}>
              {customSubtitle
                ? customSubtitle.replace('{name}', name).replace('{amount}', value).replace('{product}', product)
                : (value
                  ? `A fatura no valor de ${value}€ referente a ${product} já se encontra disponível para consulta no seu portal de cliente.`
                  : `A fatura referente a ${product} já se encontra disponível para consulta no seu portal de cliente.`)}
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={detailCard}>
            <Text style={detailRow}>
              <span style={detailLabel}>Serviço: </span>{product}
            </Text>
            {value && (
              <Text style={detailRow}>
                <span style={detailLabel}>Valor: </span>{value}€
              </Text>
            )}
          </Section>

          {portalUrl && (
            <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
              <Button href={portalUrl} style={ctaButton}>
                {customCta || 'Consultar no Portal'}
              </Button>
            </Section>
          )}

          <Hr style={divider} />

          <Text style={{ fontSize: '14px', color: brandMuted, lineHeight: '1.6', margin: '0', textAlign: 'center' as const }}>
            {customFooter || 'Pode aceder ao seu portal de cliente a qualquer momento para consultar as suas faturas e documentos.'}
          </Text>

          <Text style={footerStyle}>
            Com os melhores cumprimentos,
            <br />
            A equipa {biz}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: InvoiceAvailableEmail,
  subject: (data: Record<string, any>) =>
    data.amount
      ? `📄 Fatura disponível — ${data.amount}€`
      : '📄 A sua fatura já está disponível',
  displayName: 'Fatura disponível no portal',
  previewData: {
    clientName: 'Ana',
    productName: 'Consultoria Digital',
    amount: '350',
    portalUrl: 'https://exemplo.com/portal/abc',
    businessName: 'O Teu Negócio',
    primaryColor: '351 56% 28%',
    primaryForeground: '0 0% 100%',
    textColor: '20 25% 10%',
    accentColor: '20 10% 46%',
    fontDisplay: 'Plus Jakarta Sans',
    fontBody: 'DM Sans',
  },
} satisfies TemplateEntry
