/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '{{.SiteName}}'

interface PaymentDueTodayProps {
  clientName?: string
  productName?: string
  amount?: string
  dueDate?: string
  paymentMethod?: string
  iban?: string
  mbwayNumber?: string
  businessName?: string
  primaryColor?: string
  primaryForeground?: string
  textColor?: string
  accentColor?: string
  fontDisplay?: string
  fontBody?: string
  logoUrl?: string
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

function getPaymentMethodLabel(method?: string): string {
  switch (method) {
    case 'cartao': return 'Cartão de crédito/débito'
    case 'debito_direto': return 'Débito direto'
    case 'transferencia': return 'Transferência bancária'
    case 'mbway': return 'MB WAY'
    case 'multibanco': return 'Multibanco'
    default: return method || 'Não definido'
  }
}

const PaymentDueTodayEmail = ({
  clientName, productName, amount, dueDate, paymentMethod, iban, mbwayNumber,
  businessName, primaryColor, primaryForeground, textColor, accentColor,
  fontDisplay, fontBody, logoUrl,
  customTitle, customSubtitle, customCta, customFooter, customEmoji,
}: PaymentDueTodayProps) => {
  const name = clientName || 'Cliente'
  const biz = businessName || SITE_NAME
  const product = productName || 'o seu serviço'
  const value = amount || '—'
  const date = dueDate || '—'

  const brandPrimary = hslToCss(primaryColor, '#1a1f36')
  const brandPrimaryFg = hslToCss(primaryForeground, '#f0f4ff')
  const brandText = '#1a1f36' // neutral dark, ignores textColor to avoid washed-out text
  const brandMuted = '#555770' // neutral muted gray, ignores accentColor to avoid pink/light text
  const bodyFont = fontBody ? `'${fontBody}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif"
  const displayFont = fontDisplay ? `'${fontDisplay}', Georgia, serif` : bodyFont

  const isAutomatic = paymentMethod === 'cartao' || paymentMethod === 'debito_direto'
  const isTransfer = paymentMethod === 'transferencia'
  const isMbway = paymentMethod === 'mbway'
  const isMultibanco = paymentMethod === 'multibanco'

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
  const paymentCard = { backgroundColor: '#f0f4ff', borderRadius: '10px', padding: '20px 24px', marginTop: '12px', border: `1px solid ${brandPrimary}22` }
  const paymentTitle = { fontSize: '13px', fontWeight: '700' as const, color: brandText, margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
  const ibanStyle = { fontSize: '18px', fontWeight: '700' as const, color: brandPrimary, margin: '8px 0 4px', letterSpacing: '1px', fontFamily: "'Courier New', monospace" }
  const footer = { fontSize: '13px', color: '#999', textAlign: 'center' as const, margin: '28px 0 0', lineHeight: '1.6' }

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>O pagamento de {value}€ vence hoje</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            {logoUrl ? (
              <Img src={logoUrl} alt={biz} style={logoStyle} />
            ) : (
            <Text style={headerEmoji}>{customEmoji || '📩'}</Text>
            )}
            <Heading style={h1}>
              {customTitle
                ? customTitle.replace('{name}', name).replace('{amount}', value).replace('{product}', product)
                : `${name}, o pagamento vence hoje`}
            </Heading>
            <Text style={subtitle}>
              {customSubtitle
                ? customSubtitle.replace('{name}', name).replace('{amount}', value).replace('{product}', product)
                : (isAutomatic
                  ? `O pagamento referente a ${product} será processado automaticamente hoje.`
                  : `Passa por aqui um lembrete gentil — o pagamento referente a ${product} vence hoje.`)}
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
            {paymentMethod && (
              <Text style={detailRow}>
                <span style={detailLabel}>Método de pagamento: </span>{getPaymentMethodLabel(paymentMethod)}
              </Text>
            )}
          </Section>

          {isAutomatic && (
            <Section style={paymentCard}>
              <Text style={paymentTitle}>💳 Cobrança automática</Text>
              <Text style={{ ...detailRow, lineHeight: '1.6' }}>
                O valor de {value}€ será debitado automaticamente via {getPaymentMethodLabel(paymentMethod).toLowerCase()}. Não é necessária nenhuma ação da sua parte.
              </Text>
            </Section>
          )}

          {isTransfer && iban && (
            <Section style={paymentCard}>
              <Text style={paymentTitle}>🏦 Dados para transferência</Text>
              <Text style={{ ...detailRow, lineHeight: '1.6', margin: '0 0 8px' }}>
                Para efetuar o pagamento, transfira o valor para o IBAN abaixo:
              </Text>
              <Text style={ibanStyle}>{iban}</Text>
              <Text style={{ fontSize: '12px', color: brandMuted, margin: '4px 0 0' }}>
                Valor: {value}€
              </Text>
            </Section>
          )}

          {isMbway && mbwayNumber && (
            <Section style={paymentCard}>
              <Text style={paymentTitle}>📱 Pagamento por MB WAY</Text>
              <Text style={{ ...detailRow, lineHeight: '1.6', margin: '0 0 8px' }}>
                Será enviado um pedido de pagamento para o seu telemóvel. Confirme no número:
              </Text>
              <Text style={ibanStyle}>{mbwayNumber}</Text>
              <Text style={{ fontSize: '12px', color: brandMuted, margin: '4px 0 0' }}>
                Valor: {value}€
              </Text>
            </Section>
          )}

          {isMultibanco && (
            <Section style={paymentCard}>
              <Text style={paymentTitle}>🏧 Pagamento por Multibanco</Text>
              <Text style={{ ...detailRow, lineHeight: '1.6' }}>
                Os dados para pagamento Multibanco serão enviados em separado ou disponibilizados no portal de cliente.
              </Text>
            </Section>
          )}

          <Hr style={divider} />

          <Text style={{ fontSize: '14px', color: brandMuted, lineHeight: '1.6', margin: '0', textAlign: 'center' as const }}>
            {customFooter
              ? customFooter
              : (isAutomatic
                ? 'Caso tenha alguma questão sobre a cobrança, não hesite em contactar-nos.'
                : 'Se já efetuou o pagamento, por favor ignore este email.')}
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
  component: PaymentDueTodayEmail,
  subject: (data: Record<string, any>) =>
    `📩 Pagamento vence hoje — ${data.amount || ''}€`,
  displayName: 'Pagamento no dia do vencimento',
  previewData: {
    clientName: 'Ana',
    productName: 'Consultoria Digital',
    amount: '350',
    dueDate: '15/04/2026',
    paymentMethod: 'transferencia',
    iban: 'PT50 0000 0000 0000 0000 0001 2',
    businessName: 'O Teu Negócio',
    primaryColor: '351 56% 28%',
    primaryForeground: '0 0% 100%',
    textColor: '222 84% 5%',
    accentColor: '3 42% 74%',
    fontDisplay: 'DM Serif Display',
    fontBody: 'DM Sans',
  },
} satisfies TemplateEntry
