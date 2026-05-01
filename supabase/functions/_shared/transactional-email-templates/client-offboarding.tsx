/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '{{.SiteName}}'

interface ClientOffboardingProps {
  clientName?: string
  portalUrl?: string
  portalDays?: number
  businessName?: string
  ownerName?: string
  supportEmail?: string
  // Brand
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

const ClientOffboardingEmail = ({
  clientName,
  portalUrl,
  portalDays = 30,
  businessName,
  ownerName,
  supportEmail,
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
}: ClientOffboardingProps) => {
  const name = clientName || ''
  const biz = businessName || SITE_NAME
  const owner = ownerName || 'a equipa'
  const support = supportEmail || ''
  const days = portalDays || 30

  const brandPrimary = hslToCss(primaryColor, '#1a1f36')
  const brandPrimaryFg = hslToCss(primaryForeground, '#f0f4ff')
  const brandText = hslToCss(textColor, '#1a1f36')
  const brandMuted = hslToCss(accentColor, '#555770')
  const bodyFont = fontBody ? `'${fontBody}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif"
  const displayFont = fontDisplay ? `'${fontDisplay}', Georgia, serif` : bodyFont

  const main = { backgroundColor: '#ffffff', fontFamily: bodyFont }
  const container = { maxWidth: '540px', margin: '0 auto', padding: '40px 24px' }
  const headerSection = { textAlign: 'center' as const, padding: '0 0 8px' }
  const h1 = { fontSize: '20px', fontWeight: '700' as const, color: brandText, margin: '0 0 10px', lineHeight: '1.3', fontFamily: displayFont }
  const text = { fontSize: '13px', color: brandMuted, lineHeight: '1.7', margin: '0 0 14px' }
  const highlight = { backgroundColor: '#f7f7fa', borderRadius: '10px', padding: '16px 18px', marginBottom: '12px' }
  const highlightTitle = { fontSize: '13px', fontWeight: '600' as const, color: brandText, margin: '0 0 6px' }
  const highlightDesc = { fontSize: '12px', color: brandMuted, lineHeight: '1.6', margin: '0' }
  const divider = { borderColor: '#e8e8ed', margin: '24px 0' }
  const ctaSection = { textAlign: 'center' as const, padding: '8px 0' }
  const ctaButton = { backgroundColor: brandPrimary, color: brandPrimaryFg, fontSize: '13px', fontWeight: '600' as const, padding: '12px 32px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' as const }
  const footer = { fontSize: '11px', color: '#999', textAlign: 'center' as const, margin: '24px 0 0', lineHeight: '1.6' }
  const logoStyle = { width: '48px', height: '48px', borderRadius: '10px', margin: '0 auto 16px' }
  const linkStyle = { color: brandPrimary, textDecoration: 'underline' as const }

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>O nosso projeto juntos chegou ao fim — mas o teu portal continua ativo</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            {logoUrl ? (
              <Img src={logoUrl} alt={biz} style={logoStyle} />
            ) : (
            <Text style={{ fontSize: '48px', margin: '0 0 8px', lineHeight: '1', textAlign: 'center' as const }}>{customEmoji || '🤝'}</Text>
            )}
            <Heading style={h1}>
            {customTitle
              ? customTitle.replace('{name}', name || 'Cliente')
              : (name ? `${name}, obrigado(a) por tudo!` : 'Obrigado(a) por tudo!')}
            </Heading>
          </Section>

          <Text style={text}>
            {customSubtitle
              ? customSubtitle.replace('{name}', name || 'Cliente')
              : 'O nosso projeto juntos chegou ao fim por agora — e queremos agradecer-te por toda a confiança e trabalho em conjunto. Foi um prazer!'}
          </Text>

          <Hr style={divider} />

          {/* Portal info */}
          <Section style={highlight}>
            <Text style={highlightTitle}>📁 O teu portal continua ativo</Text>
            <Text style={highlightDesc}>
              Tens acesso ao teu portal durante mais <strong>{days} dias</strong> para que possas consultar, descarregar e guardar todos os materiais, relatórios e informações do teu projeto.
            </Text>
          </Section>

          <Section style={highlight}>
            <Text style={highlightTitle}>⏰ Após {days} dias</Text>
            <Text style={highlightDesc}>
              O portal será automaticamente desativado. Recomendamos que guardes tudo o que precisares antes dessa data.
            </Text>
          </Section>

          {/* CTA */}
          {portalUrl && (
            <Section style={ctaSection}>
              <Button style={ctaButton} href={portalUrl}>
                {customCta || 'Aceder ao meu portal →'}
              </Button>
            </Section>
          )}

          <Hr style={divider} />

          {/* Closing */}
          <Text style={text}>
            {customFooter || 'Se no futuro precisares de nós, estaremos cá. A porta está sempre aberta. 💛'}
          </Text>

          {support && (
            <Text style={{ ...text, fontSize: '14px' }}>
              Qualquer dúvida, contacta-nos em <a href={`mailto:${support}`} style={linkStyle}>{support}</a>.
            </Text>
          )}

          <Text style={footer}>
            Com carinho,
            <br />
            {owner} e a equipa {biz} 🤍
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ClientOffboardingEmail,
  subject: (data: Record<string, any>) =>
    data.clientName
      ? `${data.clientName}, obrigado(a) — o teu portal continua ativo`
      : 'Obrigado(a) — o teu portal continua ativo',
  displayName: 'Offboarding de cliente',
  previewData: {
    clientName: 'Ana Silva',
    portalUrl: 'https://app.exemplo.com/portal/abc123/view',
    portalDays: 30,
    businessName: 'O Teu Negócio',
    ownerName: 'Mariana',
    supportEmail: 'suporte@exemplo.com',
    primaryColor: '351 56% 28%',
    primaryForeground: '0 0% 100%',
    textColor: '222 84% 5%',
    accentColor: '3 42% 74%',
    fontDisplay: 'DM Serif Display',
    fontBody: 'DM Sans',
  },
} satisfies TemplateEntry
